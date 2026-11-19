export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKEND = new Set(['Sábado', 'Domingo']);

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};
export const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const pretty = (hhmm) => {
  const [h, m] = String(hhmm).split(':');
  return `${Number(h)}:${m}`;
};
export const hoursOf = (b) => (toMin(b.end) - toMin(b.start)) / 60;

export const todayName = () => DAYS[(new Date().getDay() + 6) % 7];

export const fmtNum = (n, d = 1) =>
  Number.isInteger(n) ? String(n) : n.toFixed(d).replace('.', ',');
export const fmtH = (h) => `${fmtNum(h)} h`;
export const fmtMoney = (n) => `$${Math.round(n).toLocaleString('es-EC')}`;
export const fmtPct = (x) => `${Math.round(x * 100)}%`;

export const uid = (p = 'id') =>
  `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
