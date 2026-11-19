// Ayudas compartidas por las pantallas de estudiantes, pagos, asistencia, etc.
import { db } from './backend';
import { allCourses } from './calc';

export const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local
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

export const money = (n) => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Índices rápidos por id. */
export const byId = (rows) => Object.fromEntries((rows || []).map((r) => [r.id, r]));
