// Servidor del panel (admin.forwinnersec.com): sirve la aplicación y su API.
// Usa la misma base D1 que forwinnersec.com.
import { MODULES, OPS_KEYS, CONTENT, TABLES } from './schema.js';
import { ensureSchema, kiosk, audit, describeRow, summary, kioskConfig, classWindow, localDay } from './extra.js';

const COOKIE = 'fw_admin';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
const fail = (status, error) => json({ error }, status);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      const msg = String(e?.message || e);
      if (/FOREIGN KEY/i.test(msg)) return fail(409, 'No se puede borrar: tiene registros relacionados (inscripciones, pagos o asistencia).');
      if (/UNIQUE/i.test(msg)) return fail(409, 'Ya existe un registro igual.');
      if (/no such table|no such column/i.test(msg)) return fail(500, 'Falta aplicar la migración 0004 de la base de datos (ver README).');
      return fail(500, 'Error interno');
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const need = (cond, status, msg) => {
  if (!cond) throw new HttpError(status, msg);
};

// ---------------- utilidades de seguridad ----------------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const sha256 = async (s) => b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));

async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 100000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${b64u(salt)}$${b64u(bits)}`;
}
async function checkPassword(password, stored) {
  const [, it, salt, hash] = String(stored).split('$');
  const again = await hashPassword(password, fromB64u(salt), Number(it));
  const a = enc.encode(again.split('$')[3]);
  const b = enc.encode(hash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
const safeEqual = async (a, b) => (await sha256(String(a))) === (await sha256(String(b)));

function cookieOf(request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
const sessionCookie = (token, maxAge) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

async function tooManyAttempts(env, request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at <= ?3 THEN 1 ELSE n + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END RETURNING n"
  ).bind(`admin-login:${ip}`, now + 900, now).first();
  return row && row.n > 10;
}

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  name: u.display_name || u.username,
  role: u.role,
  perms: u.role === 'owner' ? MODULES : JSON.parse(u.perms || '[]'),
});

async function currentUser(env, request) {
  const token = cookieOf(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1'
  ).bind(await sha256(token), Date.now()).first();
  return row ? publicUser(row) : null;
}
const can = (user, mods) => user.role === 'owner' || (mods || []).some((m) => user.perms.includes(m));

async function body(request) {
  const t = await request.text();
  need(t.length < 4_000_000, 413, 'Demasiado grande');
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    throw new HttpError(400, 'Datos inválidos');
  }
}

// ---------------- API ----------------
async function api(request, env, url) {
  const p = url.pathname;
  const m = request.method;
  need(env.DB, 500, 'Falta la base de datos (binding DB en wrangler.jsonc)');
  await ensureSchema(env);
  // Enlace público de firma de asistencia (protegido por su propia clave, sin sesión).
  if (p.startsWith('/api/kiosk/')) return kiosk(request, env, url);

  if (p === '/api/login' && m === 'POST') return login(request, env);
  if (p === '/api/logout' && m === 'POST') {
    const t = cookieOf(request);
    if (t) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(t)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  const user = await currentUser(env, request);
  if (p === '/api/me') return json({ user, siteUrl: env.SITE_URL || 'https://forwinnersec.com' });
  need(user, 401, 'Inicia sesión');
  // Las escrituras solo se aceptan como JSON (protección extra contra formularios de otros sitios).
  if (m !== 'GET' && p !== '/api/media') need((request.headers.get('Content-Type') || '').includes('application/json'), 415, 'Formato no válido');

  if (p === '/api/password' && m === 'POST') {
    const b = await body(request);
    need(String(b.password || '').length >= 8, 400, 'Usa al menos 8 caracteres');
    const row = await env.DB.prepare('SELECT pass_hash FROM admin_users WHERE id = ?').bind(user.id).first();
    need(await checkPassword(String(b.current || ''), row.pass_hash), 400, 'La contraseña actual no es correcta');
    await env.DB.prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?').bind(await hashPassword(b.password), user.id).run();
    return json({ ok: true });
  }

  let r;
  if (p === '/api/summary' && m === 'GET') return json(await summary(env, (mods) => can(user, mods)));
  if ((r = p.match(/^\/api\/attendance\/(\d+)\/signatures$/)) && m === 'GET') {
    need(can(user, ['asistencia', 'estudiantes', 'profesores']), 403, 'Sin permiso');
    const row = await env.DB.prepare('SELECT sign_in, sign_out FROM attendance_log WHERE id = ?').bind(Number(r[1])).first();
    need(row, 404, 'No encontrado');
    return json(row);
  }
  if ((r = p.match(/^\/api\/content\/([a-z_]+)$/))) return content(request, env, user, r[1]);
  if ((r = p.match(/^\/api\/history\/([a-z_]+)$/)) && m === 'GET') {
    const def = CONTENT[r[1]];
    need(def && (def.read === null || can(user, def.read)), 403, 'Sin permiso');
    const { results } = await env.DB.prepare("SELECT id, saved_at, saved_by, json_extract(value, '$.changeNote') AS note, json_extract(value, '$.changes') AS changes, json_extract(value, '$.publishedAt') AS published_at, json_extract(value, '$.publishedBy') AS published_by FROM content_history WHERE key = ? ORDER BY id DESC LIMIT 60").bind(r[1]).all();
    return json(results);
  }
  if ((r = p.match(/^\/api\/history\/item\/(\d+)$/)) && m === 'GET') {
    const row = await env.DB.prepare('SELECT key, value FROM content_history WHERE id = ?').bind(r[1]).first();
    need(row, 404, 'No encontrado');
    const def = CONTENT[row.key];
    need(def.read === null || can(user, def.read), 403, 'Sin permiso');
    return json(JSON.parse(row.value));
  }
  if (p === '/api/media' && m === 'POST') return uploadMedia(request, env, user);
  if (p.startsWith('/api/users')) return users(request, env, user, p);
  if ((r = p.match(/^\/api\/t\/([a-z_]+)(?:\/(bulk|[\w-]+))?$/))) return table(request, env, user, r[1], r[2], url);
  return fail(404, 'No encontrado');
}

async function login(request, env) {
  if (await tooManyAttempts(env, request)) return fail(429, 'Demasiados intentos. Espera 15 minutos.');
  const b = await body(request);
  const username = String(b.username || 'admin').trim().toLowerCase() || 'admin';
  const password = String(b.password || '');
  let u = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ? AND active = 1').bind(username).first();
  if (!u) {
    // Primer ingreso: si aún no hay usuarios, la contraseña inicial es el secreto ADMIN_PASSWORD.
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
    if (n === 0 && username === 'admin') {
      need(env.ADMIN_PASSWORD, 500, 'Falta configurar ADMIN_PASSWORD (ver README)');
      need(await safeEqual(password, env.ADMIN_PASSWORD), 401, 'Usuario o contraseña incorrectos');
      await env.DB.prepare("INSERT INTO admin_users (username, display_name, pass_hash, role, perms) VALUES ('admin', 'Administrador', ?, 'owner', '[]')")
        .bind(await hashPassword(password)).run();
      u = await env.DB.prepare("SELECT * FROM admin_users WHERE username = 'admin'").first();
    }
  } else if (!(await checkPassword(password, u.pass_hash))) {
    u = null;
  }
  need(u, 401, 'Usuario o contraseña incorrectos');
  await audit(env, u, 'ingresar', 'admin_users', u.id, u.display_name || u.username, true);
  const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const maxAge = SESSION_DAYS * 86400;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), u.id, Date.now() + maxAge * 1000),
  ]);
  return json({ user: publicUser(u) }, 200, { 'Set-Cookie': sessionCookie(token, maxAge) });
}

// ---------------- documentos (horario/cursos, diseño de la web) ----------------
async function content(request, env, user, key) {
  const def = CONTENT[key];
  need(def, 404, 'No encontrado');
  const row = await env.DB.prepare('SELECT value, updated_at FROM content WHERE key = ?').bind(key).first();
  if (request.method === 'GET') {
    need(def.read === null || can(user, def.read), 403, 'Sin permiso');
    return json({ value: row ? JSON.parse(row.value) : null, version: row?.updated_at || null });
  }
  need(request.method === 'PUT', 405, 'Método no permitido');
  const b = await body(request);
  need(b.value && typeof b.value === 'object', 400, 'Datos inválidos');
  // Evita pisar cambios de otra persona hechos mientras tanto.
  if (row && b.version !== undefined && b.version !== row.updated_at)
    return json({ error: 'Alguien más guardó cambios. Se cargó la versión más reciente.', value: JSON.parse(row.value), version: row.updated_at }, 409);

  const changedKeys = [];
  if (def.write === 'ops' && row) {
    // (Si aún no existe, es la primera copia de los datos iniciales del Excel.)
    const old = JSON.parse(row.value);
    for (const k of new Set([...Object.keys(old), ...Object.keys(b.value)])) {
      if (JSON.stringify(old[k]) === JSON.stringify(b.value[k])) continue;
      changedKeys.push(k);
      need(can(user, OPS_KEYS[k] || ['ajustes']), 403, `No tienes permiso para cambiar "${k}"`);
    }
  } else if (def.write !== 'ops') {
    need(can(user, def.write), 403, 'Sin permiso');
  }
  const value = JSON.stringify(b.value);
  const now = new Date().toISOString();
  const stmts = [];
  // Historial: como máximo una copia cada 10 minutos por documento (y siempre al publicar).
  if (row) {
    const recent = await env.DB.prepare("SELECT id FROM content_history WHERE key = ? AND saved_at > datetime('now', '-10 minutes') LIMIT 1").bind(key).first();
    if (!recent || key === 'site_published')
      stmts.push(env.DB.prepare('INSERT INTO content_history (key, value, saved_by) VALUES (?, ?, ?)').bind(key, row.value, user.username));
  }
  stmts.push(
    env.DB.prepare('INSERT INTO content (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
      .bind(key, value, now, user.username)
  );
  stmts.push(env.DB.prepare("DELETE FROM content_history WHERE key = ? AND id NOT IN (SELECT id FROM content_history WHERE key = ? ORDER BY id DESC LIMIT 200)").bind(key, key));
  await env.DB.batch(stmts);
  const OPS_NAMES = { schedule: 'Horario', spaces: 'Espacios', categories: 'Categorías', params: 'Tarifas y parámetros', courses: 'Cursos', routes: 'Rutas UTN', modules: 'Módulos UTN', hiddenCourses: 'Cursos visibles', plans: 'Plan de clases' };
  if (key === 'operations' && changedKeys.length) await audit(env, user, 'editar', key, null, changedKeys.map((k) => OPS_NAMES[k] || k).join(', '), true);
  if (key === 'site_published') await audit(env, user, 'publicar', key, null, b.value.changeNote || `${(b.value.changes || []).length} cambios`);
  if (key === 'kiosk') await audit(env, user, 'editar', key, null, b.value.active ? 'Enlace activo' : 'Enlace desactivado', true);
  return json({ ok: true, version: now });
}

// ---------------- imágenes ----------------
async function uploadMedia(request, env, user) {
  need(can(user, ['web']), 403, 'Sin permiso');
  const type = (request.headers.get('Content-Type') || '').split(';')[0];
  need(/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(type), 415, 'Solo imágenes PNG, JPG, WEBP, GIF o SVG');
  need(type !== 'image/svg+xml' || user.role === 'owner', 403, 'Solo el administrador puede subir SVG');
  const buf = await request.arrayBuffer();
  need(buf.byteLength > 0 && buf.byteLength <= 1_800_000, 413, 'La imagen debe pesar menos de 1,8 MB');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.DB.prepare('INSERT INTO media (id, mime, data) VALUES (?, ?, ?)').bind(id, type, buf).run();
  return json({ url: `/m/${id}` });
}

// ---------------- usuarios del panel ----------------
async function users(request, env, user, p) {
  need(user.role === 'owner', 403, 'Solo el administrador gestiona usuarios');
  const m = request.method;
  const id = Number(p.split('/')[3] || 0);
  if (m === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, username, display_name, role, perms, active, created_at FROM admin_users ORDER BY id').all();
    return json(results.map((u) => ({ ...u, perms: JSON.parse(u.perms || '[]') })));
  }
  const b = m === 'DELETE' ? {} : await body(request);
  const perms = JSON.stringify((b.perms || []).filter((x) => MODULES.includes(x)));
  if (m === 'POST') {
    const username = String(b.username || '').trim().toLowerCase();
    need(/^[a-z0-9._-]{3,30}$/.test(username), 400, 'Usuario: 3 a 30 letras o números, sin espacios');
    need(String(b.password || '').length >= 8, 400, 'La contraseña debe tener al menos 8 caracteres');
    await env.DB.prepare("INSERT INTO admin_users (username, display_name, pass_hash, role, perms) VALUES (?, ?, ?, 'staff', ?)")
      .bind(username, String(b.name || username).slice(0, 60), await hashPassword(b.password), perms).run();
    await audit(env, user, 'crear', 'admin_users', null, username);
    return json({ ok: true });
  }
  need(id, 400, 'Falta el usuario');
  need(id !== user.id || m === 'PATCH', 400, 'No puedes borrarte a ti mismo');
  if (m === 'PATCH') {
    const stmts = [];
    if (b.perms) stmts.push(env.DB.prepare("UPDATE admin_users SET perms = ? WHERE id = ? AND role = 'staff'").bind(perms, id));
    if (b.name !== undefined) stmts.push(env.DB.prepare('UPDATE admin_users SET display_name = ? WHERE id = ?').bind(String(b.name).slice(0, 60), id));
    if (b.active !== undefined && id !== user.id) {
      stmts.push(env.DB.prepare('UPDATE admin_users SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id));
      if (!b.active) stmts.push(env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(id));
    }
    if (b.password) {
      need(String(b.password).length >= 8, 400, 'La contraseña debe tener al menos 8 caracteres');
      stmts.push(env.DB.prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?').bind(await hashPassword(b.password), id));
      stmts.push(env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(id));
    }
    if (stmts.length) await env.DB.batch(stmts);
    await audit(env, user, 'editar', 'admin_users', id, b.password ? 'permisos / contraseña' : 'permisos');
    return json({ ok: true });
  }
  if (m === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(id),
      env.DB.prepare("DELETE FROM admin_users WHERE id = ? AND role = 'staff'").bind(id),
    ]);
    await audit(env, user, 'borrar', 'admin_users', id, '');
    return json({ ok: true });
  }
  return fail(405, 'Método no permitido');
}

// ---------------- tablas de gestión ----------------
function clean(def, row) {
  const out = {};
  for (const c of def.cols) if (row[c] !== undefined) out[c] = row[c] === '' ? null : row[c];
  return out;
}
function insertStmt(env, name, def, row) {
  const data = clean(def, row);
  const cols = Object.keys(data);
  need(cols.length, 400, 'Sin datos');
  let sql = `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
  if (def.upsert) {
    const upd = cols.filter((c) => !def.upsert.includes(c));
    sql += ` ON CONFLICT(${def.upsert.join(', ')}) DO ${upd.length ? `UPDATE SET ${upd.map((c) => `${c} = excluded.${c}`).join(', ')}` : 'NOTHING'}`;
  }
  return env.DB.prepare(`${sql} RETURNING ${def.select || '*'}`).bind(...cols.map((c) => data[c]));
}

async function table(request, env, user, name, sub, url) {
  const def = TABLES[name];
  need(def, 404, 'No encontrado');
  const m = request.method;
  if (m === 'GET') {
    need(can(user, def.read), 403, 'Sin permiso');
    const where = [];
    const args = [];
    for (const [k, v] of url.searchParams) {
      if (!k.startsWith('f_')) continue;
      const col = k.slice(2);
      need([...def.cols, 'id'].includes(col), 400, 'Filtro no válido');
      where.push(`${col} = ?`);
      args.push(v);
    }
    if (def.dateCol) {
      const since = url.searchParams.get('since');
      const until = url.searchParams.get('until');
      if (since) { where.push(`${def.dateCol} >= ?`); args.push(since); }
      if (until) { where.push(`${def.dateCol} <= ?`); args.push(until); }
    }
    const limit = Math.min(Number(url.searchParams.get('limit')) || 5000, 5000);
    const { results } = await env.DB.prepare(
      `SELECT ${def.select || '*'} FROM ${name}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${name === 'assessments' ? 'created_at' : 'id'} DESC LIMIT ${limit}`
    ).bind(...args).all();
    return json(results);
  }
  need(can(user, def.write), 403, 'Sin permiso');
  if (m === 'POST' && sub === 'bulk') {
    const b = await body(request);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
    need(rows.length, 400, 'Sin datos');
    const res = await env.DB.batch(rows.map((r) => insertStmt(env, name, def, r)));
    if (!def.quiet) await audit(env, user, 'crear', name, null, `${rows.length} registros`);
    return json(res.map((x) => x.results?.[0]));
  }
  if (m === 'POST' && !sub) {
    const data = await body(request);
    if (name === 'attendance_log') { data.source = data.source || 'manual'; data.created_by = user.username; }
    if (name === 'attendance_class') {
      // La clave del QR y la ventana para registrarse las pone el servidor.
      need(/^\d\d:\d\d$/.test(data.start_time || '') && /^\d\d:\d\d$/.test(data.end_time || '') && data.start_time < data.end_time, 400, 'Revisa la hora de inicio y fin de la clase');
      need(data.subject, 400, 'Elige la materia');
      const t = data.teacher_id && await env.DB.prepare("SELECT full_name FROM people WHERE id = ? AND person_type = 'teacher'").bind(Number(data.teacher_id)).first();
      need(t, 400, 'Elige al profesor');
      data.teacher_name = t.full_name;
      data.day = data.day || localDay();
      data.code = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join('');
      Object.assign(data, classWindow(await kioskConfig(env), data.day, data.start_time, data.end_time));
      data.status = 'open';
      data.created_by = user.username;
    }
    const row = await insertStmt(env, name, def, data).first();
    if (!def.quiet) await audit(env, user, 'crear', name, row?.id, describeRow(row));
    return json(row);
  }
  need(sub && /^\d+$/.test(sub), 400, 'Falta el id');
  if (m === 'PATCH') {
    const data = clean(def, await body(request));
    const cols = Object.keys(data);
    need(cols.length, 400, 'Sin cambios');
    const row = await env.DB.prepare(`UPDATE ${name} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? RETURNING ${def.select || '*'}`)
      .bind(...cols.map((c) => data[c]), Number(sub)).first();
    need(row, 404, 'No encontrado');
    if (!def.quiet) await audit(env, user, 'editar', name, row.id, `${describeRow(row)} (${cols.join(', ')})`);
    return json(row);
  }
  if (m === 'DELETE') {
    const old = await env.DB.prepare(`SELECT ${def.select || '*'} FROM ${name} WHERE id = ?`).bind(Number(sub)).first();
    await env.DB.prepare(`DELETE FROM ${name} WHERE id = ?`).bind(Number(sub)).run();
    if (!def.quiet) await audit(env, user, 'borrar', name, sub, describeRow(old || {}));
    return json({ ok: true });
  }
  return fail(405, 'Método no permitido');
}
