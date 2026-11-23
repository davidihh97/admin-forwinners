// Ayudas compartidas por las pantallas de estudiantes, pagos, asistencia, etc.
import { db } from './backend';
import { allCourses } from './calc';

// Fechas siempre en hora de Ecuador, igual que el servidor y la página de firma.
export const TZ = 'America/Guayaquil';
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // AAAA-MM-DD
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
export const addMonths = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('en-CA');
};
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : `${String(iso).replace(' ', 'T')}${/Z|[+-]\d\d:?\d\d$/.test(iso) ? '' : 'Z'}`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Celular ecuatoriano (09…) o internacional → enlace de WhatsApp con mensaje. */
export function waLink(phone, msg = '') {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 && d.startsWith('0')) d = `593${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('9')) d = `593${d}`;
  return `https://wa.me/${d}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}
export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

export const STATUS = {
  inquiry: { new: 'Nuevo', contacted: 'Contactado', enrolled: 'Inscrito', closed: 'Cerrado' },
  enrollment: { pending: 'Por confirmar', active: 'Activo', completed: 'Terminó', cancelled: 'Retirado' },
  group: { planned: 'Por abrir', active: 'En curso', completed: 'Terminado', cancelled: 'Cancelado' },
  payment: { pending: 'Pendiente', paid: 'Pagado', void: 'Anulado' },
  attendance: { present: 'Asistió', late: 'Atrasado', absent: 'Faltó', excused: 'Justificado' },
};
export const STATUS_TAG = {
  new: 'tag-warn', contacted: 'tag-info', enrolled: 'tag-ok', closed: 'tag-mut',
  pending: 'tag-warn', active: 'tag-ok', completed: 'tag-mut', cancelled: 'tag-bad',
  planned: 'tag-info', paid: 'tag-ok', void: 'tag-mut',
  present: 'tag-ok', late: 'tag-warn', absent: 'tag-bad', excused: 'tag-info',
};

const category = (key) => (/ingles/.test(key) ? 'english' : /utn|razonamiento|yachay/.test(key) ? 'pre_university' : 'other');

/** Devuelve el id (tabla courses) de un curso del catálogo del panel; lo crea si aún no existe. */
export async function ensureCourse(data, key, courses) {
  const found = courses.find((c) => c.course_key === key);
  if (found) return found.id;
  const c = allCourses(data).find((x) => x.id === key);
  if (!c) throw new Error('Curso no encontrado');
  const row = await db.add('courses', { name: c.name, category: category(key), price: c.price, status: 'published', course_key: key, modality: 'in_person', description: c.format });
  courses.push(row);
  return row.id;
}

/** Cuotas de una inscripción: reparte el precio en n pagos mensuales desde la primera fecha. */
export function installmentRows(enrollmentId, total, n, firstDue) {
  const count = Math.max(1, Number(n) || 1);
  const base = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    enrollment_id: enrollmentId,
    amount: i === count - 1 ? Math.round((total - base * (count - 1)) * 100) / 100 : base,
    due_date: addMonths(firstDue, i),
    installment_no: i + 1,
    status: 'pending',
  }));
}

export const money = (n) => `${Number(n) < 0 ? '-' : ''}$${Math.abs(Number(n || 0)).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Índices rápidos por id. */
export const byId = (rows) => Object.fromEntries((rows || []).map((r) => [r.id, r]));

/** Grupo interno de un curso (los estudiantes se inscriben al curso; el grupo se crea solo). */
export async function ensureCourseGroup(data, key, courses, groups) {
  const courseId = await ensureCourse(data, key, courses);
  const g = groups.find((x) => x.course_id === courseId && ['planned', 'active'].includes(x.status));
  if (g) return g;
  const c = allCourses(data).find((x) => x.id === key);
  const row = await db.add('course_groups', { course_id: courseId, group_name: c?.name || 'Curso', status: 'active', start_date: today() });
  groups.push(row);
  return row;
}

/** Duración legible: 2 h 05 min */
export const dur = (min) => {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
};
export const hoursNum = (min) => Math.round(((min || 0) / 60) * 10) / 10;
export const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—');
export const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
export const startOfWeek = (iso = today()) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('en-CA');
};
