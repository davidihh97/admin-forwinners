// Comunicación con el servidor del panel (worker/index.js), que usa la base D1 de For Winners.

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function call(method, path, payload, raw) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (raw) {
    opts.body = raw;
    opts.headers['Content-Type'] = raw.type;
  } else if (payload !== undefined) {
    opts.body = JSON.stringify(payload);
    opts.headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(`/api/${path}`, opts);
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e inténtalo otra vez.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== 'login') window.dispatchEvent(new Event('fw:logout'));
    throw new ApiError(res.status, data.error || 'Algo salió mal', data);
  }
  return data;
}

export const api = {
  get: (p) => call('GET', p),
  post: (p, b) => call('POST', p, b ?? {}),
  patch: (p, b) => call('PATCH', p, b),
  put: (p, b) => call('PUT', p, b),
  del: (p) => call('DELETE', p, {}),
};

export const me = () => api.get('me');
export const login = (username, password) => api.post('login', { username, password });
export const logout = () => api.post('logout');
export const changePassword = (current, password) => api.post('password', { current, password });

export const loadDoc = (key) => api.get(`content/${key}`);
export const saveDoc = (key, value, version) => api.put(`content/${key}`, { value, version });
export const history = (key) => api.get(`history/${key}`);
export const historyItem = (id) => api.get(`history/item/${id}`);

/** Tablas de gestión (estudiantes, pagos, etc.) */
export const db = {
  list: (t, filters = {}, range = {}) =>
    api.get(`t/${t}?${new URLSearchParams([
      ...Object.entries(filters).map(([k, v]) => [`f_${k}`, v]),
      ...Object.entries(range).filter(([, v]) => v),
    ])}`),
  add: (t, row) => api.post(`t/${t}`, row),
  addMany: (t, rows) => api.post(`t/${t}/bulk`, { rows }),
  update: (t, id, row) => api.patch(`t/${t}/${id}`, row),
  remove: (t, id) => api.del(`t/${t}/${id}`),
};

/** Reduce la imagen en el navegador y la sube. Devuelve la ruta pública (/m/…) en forwinnersec.com. */
export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen');
  let blob = file;
  if (!/svg|gif/.test(file.type)) {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82));
  }
  if (blob.size > 1_800_000) throw new Error('La imagen es muy pesada (máximo 1,8 MB)');
  const { url } = await call('POST', 'media', undefined, blob);
  return url;
}

export const signatures = (id) => api.get(`attendance/${id}/signatures`);
export const summary = () => api.get('summary');
