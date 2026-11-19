// Capa de datos. Con Supabase configurado guarda en la nube (y la página pública lee
// lo publicado). Sin configuración funciona en "modo local": todo queda en este navegador.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export const isCloud = Boolean(URL && KEY && EMAIL && !URL.includes('xxxxxxxx'));
const sb = isCloud ? createClient(URL, KEY) : null;

// ---------- modo local ----------
const LS = 'fw-admin:';
const LOCAL_PASS_KEY = `${LS}pass`;
const DEFAULT_LOCAL_PASS = 'forwinners';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const lsGet = (k) => {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(LS + k, JSON.stringify(v));
  } catch (e) {
    console.warn('No se pudo guardar localmente', e);
  }
};

// ---------- sesión ----------
export async function currentSession() {
  if (isCloud) {
    const { data } = await sb.auth.getSession();
    return Boolean(data.session);
  }
  return sessionStorage.getItem(`${LS}session`) === '1';
}

export async function login(password) {
  if (isCloud) {
    const { error } = await sb.auth.signInWithPassword({ email: EMAIL, password });
    if (error) throw new Error('Contraseña incorrecta');
    return;
  }
  const stored = localStorage.getItem(LOCAL_PASS_KEY) || (await sha256(DEFAULT_LOCAL_PASS));
  if ((await sha256(password)) !== stored) throw new Error('Contraseña incorrecta');
  sessionStorage.setItem(`${LS}session`, '1');
}

export async function logout() {
  if (isCloud) await sb.auth.signOut();
  sessionStorage.removeItem(`${LS}session`);
}

export async function changePassword(newPassword) {
  if (newPassword.length < 8) throw new Error('Usa al menos 8 caracteres');
  if (isCloud) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }
  localStorage.setItem(LOCAL_PASS_KEY, await sha256(newPassword));
}

// ---------- contenido ----------
export async function load(key) {
  if (!isCloud) return lsGet(key);
  const { data, error } = await sb.from('content').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function save(key, value) {
  if (!isCloud) return lsSet(key, value);
  const { error } = await sb
    .from('content')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function history(key) {
  if (!isCloud) return [];
  const { data, error } = await sb
    .from('content_history')
    .select('id, saved_at, value')
    .eq('key', key)
    .order('saved_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

/** URL pública desde la que la página principal lee el contenido publicado. */
export const publicEndpoint = isCloud
  ? { url: URL, anonKey: KEY }
  : null;

/** Sube una imagen y devuelve su URL pública. En modo local la guarda dentro del contenido. */
export async function uploadImage(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen pesa más de 5 MB');
  if (!isCloud) {
    if (file.size > 400 * 1024) throw new Error('En modo local usa imágenes de menos de 400 KB (o pega un enlace)');
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `site/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
