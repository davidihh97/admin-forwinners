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
export const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—');
export const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
export const startOfWeek = (iso = today()) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('en-CA');
};

/* ---------- horas en Ecuador ---------- */
export const hmOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }) : '');
export const isoAt = (day, hm) => (day && hm ? new Date(`${day}T${hm}:00-05:00`).toISOString() : null);
export const hmToMin = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + m; };
export const minToHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
export const nowHm = () => hmOf(new Date().toISOString());

/**
 * Clases dictadas por cada profesor: junta (sin contar dos veces) los horarios de los estudiantes
 * que registraron clase con él, más sus registros propios y sus clases grupales.
 */
export function teacherBlocks(logs = [], classes = []) {
  const per = {};
  const add = (tid, name, day, s, e, info) => {
    if (!tid || e <= s) return;
    const k = `${tid}|${day}`;
    (per[k] ||= { teacherId: tid, name, day, items: [] }).items.push({ s, e, ...info });
  };
  for (const l of logs) {
    if (!l.check_out) continue;
    const s = hmToMin(hmOf(l.check_in));
    const e = hmToMin(hmOf(l.check_out));
    if (l.person_type === 'teacher') add(l.person_id, l.person_name, l.day, s, e, { subject: l.subject, topic: l.topic });
    else if (l.teacher_id) add(l.teacher_id, l.teacher_name, l.day, s, e, { subject: l.subject, topic: l.topic, student: l.person_id || l.person_name });
  }
  for (const c of classes) add(c.teacher_id, c.teacher_name, c.day, hmToMin(c.start_time), hmToMin(c.end_time), { subject: c.subject, topic: c.topic });
  const out = [];
  for (const g of Object.values(per)) {
    const items = g.items.sort((a, b) => a.s - b.s);
    let cur = null;
    for (const it of items) {
      if (cur && it.s <= cur.e) {
        cur.e = Math.max(cur.e, it.e);
      } else {
        cur = { teacherId: g.teacherId, name: g.name, day: g.day, s: it.s, e: it.e, subjects: new Set(), topics: new Set(), students: new Set() };
        out.push(cur);
      }
      if (it.subject) cur.subjects.add(it.subject);
      if (it.topic) cur.topics.add(it.topic);
      if (it.student) cur.students.add(it.student);
    }
  }
  return out.map((b) => ({ ...b, minutes: b.e - b.s, start: minToHm(b.s), end: minToHm(b.e) }));
}

/** Alertas para revisar registros de estudiantes que pueden estar mal (o ser trampa). */
export function attendanceFlags(logs = [], classes = []) {
  const flags = {};
  const add = (id, msg) => { (flags[id] ||= []).push(msg); };
  const med = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const groups = {};
  for (const l of logs) {
    if (l.person_type !== 'student') continue;
    if (!l.check_out) { add(l.id, 'No tiene hora de salida'); continue; }
    if (l.source === 'kiosk' && l.teacher_id && l.subject) (groups[`${l.day}|${l.teacher_id}|${l.subject}`] ||= []).push(l);
    if (l.source === 'kiosk' && l.created_at) {
      const late = Math.round((new Date(`${String(l.created_at).replace(' ', 'T')}Z`) - new Date(l.check_out)) / 60000);
      if (late > 45) add(l.id, `Se registró ${late} min después de la hora de salida`);
    }
    if (l.source === 'kiosk' && l.teacher_id) {
      for (const c of classes) {
        if (c.day !== l.day || c.teacher_id !== l.teacher_id) continue;
        const s = hmToMin(hmOf(l.check_in));
        const e = hmToMin(hmOf(l.check_out));
        if (s < hmToMin(c.end_time) && e > hmToMin(c.start_time) && (s < hmToMin(c.start_time) - 10 || e > hmToMin(c.end_time) + 10))
          add(l.id, `El profesor tuvo clase grupal de ${c.start_time} a ${c.end_time}`);
      }
    }
  }
  // Mismo profesor, materia y día: quien pone horas muy distintas a las de sus compañeros.
  for (const list of Object.values(groups)) {
    if (list.length < 3) continue;
    const ms = med(list.map((l) => hmToMin(hmOf(l.check_in))));
    const me = med(list.map((l) => hmToMin(hmOf(l.check_out))));
    for (const l of list) {
      const s = hmToMin(hmOf(l.check_in));
      const e = hmToMin(hmOf(l.check_out));
      if (Math.abs(s - ms) > 20 || Math.abs(e - me) > 20) add(l.id, `Sus compañeros registraron ${minToHm(ms)}–${minToHm(me)}`);
    }
  }
  for (const l of logs) if (l.reviewed) delete flags[l.id];
  return flags;
}
