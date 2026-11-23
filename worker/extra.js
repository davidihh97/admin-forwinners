// Registro de asistencia de estudiantes (enlace público y clases grupales), actividad del equipo y resumen del día.

const TZ = 'America/Guayaquil';
const OFFSET = '-05:00'; // Ecuador no cambia de horario
export const localDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
const localHM = (d = new Date()) => d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const toMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
const isHM = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
const isoAt = (day, hm) => new Date(`${day}T${hm}:00${OFFSET}`).toISOString();
const hmOf = (iso) => localHM(new Date(iso));

// ---------- tablas: se crean y actualizan solas (no hace falta la consola de D1) ----------
const ATT_COLUMNS = {
  teacher_id: 'INTEGER', teacher_name: 'TEXT', subject: 'TEXT', topic: 'TEXT', class_id: 'INTEGER', reviewed: 'INTEGER',
};
let ready = null;
export function ensureSchema(env) {
  ready ||= (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER, person_name TEXT NOT NULL, person_type TEXT NOT NULL DEFAULT 'student',
        day TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT, minutes INTEGER, sign_in TEXT, sign_out TEXT,
        source TEXT NOT NULL DEFAULT 'kiosk', notes TEXT, ip TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_att_person_day ON attendance_log(person_id, day)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_att_day ON attendance_log(day)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_class (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, teacher_id INTEGER, teacher_name TEXT NOT NULL,
        subject TEXT NOT NULL, topic TEXT, day TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
        opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_class_day ON attendance_class(day)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, category TEXT NOT NULL, description TEXT, amount REAL NOT NULL,
        method TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, username TEXT, action TEXT NOT NULL,
        entity TEXT, entity_id TEXT, summary TEXT)`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at)'),
    ]);
    // Columnas nuevas en una tabla que ya existía (se conservan todos los registros anteriores).
    const { results } = await env.DB.prepare('PRAGMA table_info(attendance_log)').all();
    const have = new Set(results.map((r) => r.name));
    const missing = Object.entries(ATT_COLUMNS).filter(([c]) => !have.has(c));
    if (missing.length) await env.DB.batch(missing.map(([c, t]) => env.DB.prepare(`ALTER TABLE attendance_log ADD COLUMN ${c} ${t}`)));
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_att_class ON attendance_log(class_id)').run();
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

// ---------- registro de actividad ----------
const ENTITY = {
  people: 'Persona', courses: 'Curso', course_groups: 'Curso', enrollments: 'Inscripción', payments: 'Pago', exam_scores: 'Nota',
  inquiries: 'Interesado', teacher_payouts: 'Pago a profesor', attendance_log: 'Asistencia', attendance_class: 'Clase grupal', expenses: 'Gasto',
  operations: 'Horario y cursos', site_published: 'Página web', kiosk: 'Enlace de asistencia', admin_users: 'Usuario',
};
export const entityName = (k) => ENTITY[k] || k;

export function describeRow(row = {}) {
  const name = row.full_name || row.person_name || row.group_name || row.exam_name || row.description || row.name || row.username
    || (row.subject ? `${row.subject} · ${row.teacher_name || ''} ${row.start_time || ''}–${row.end_time || ''}` : '');
  const amount = row.amount != null ? ` $${row.amount}` : '';
  return `${name}${amount}`.trim();
}

/** Guarda una acción. Si `merge`, junta acciones repetidas de la misma persona en 10 minutos. */
export async function audit(env, user, action, entity, entityId, summary, merge = false) {
  try {
    if (merge) {
      const last = await env.DB.prepare(
        "SELECT id, summary FROM audit_log WHERE username = ? AND entity = ? AND action = ? AND at > datetime('now', '-10 minutes') ORDER BY id DESC LIMIT 1"
      ).bind(user?.username || null, entity, action).first();
      if (last) {
        const parts = new Set([...String(last.summary || '').split(', '), ...String(summary || '').split(', ')].filter(Boolean));
        await env.DB.prepare('UPDATE audit_log SET summary = ?, at = CURRENT_TIMESTAMP WHERE id = ?').bind([...parts].join(', ').slice(0, 500), last.id).run();
        return;
      }
    }
    await env.DB.prepare('INSERT INTO audit_log (username, action, entity, entity_id, summary) VALUES (?, ?, ?, ?, ?)')
      .bind(user?.username || null, action, entity, entityId == null ? null : String(entityId), String(summary || '').slice(0, 500)).run();
  } catch (e) {
    console.error('audit', e);
  }
}

// ---------- configuración del enlace ----------
export const DEFAULT_SUBJECTS = ['Matemática', 'Física', 'Química', 'Biología', 'Anatomía', 'Lenguaje', 'Estadística', 'Emprendimiento', 'Razonamiento', 'Inglés', 'Nivelación', 'Tareas dirigidas', 'Tutoría', 'Computación', 'Simulacro'];
export const DEFAULT_KIOSK = {
  active: false, token: '', needSignature: false, maxHours: 6, minMinutes: 15, graceMinutes: 90, classOpenBefore: 30,
  subjects: DEFAULT_SUBJECTS, title: 'For Winners',
};
export async function kioskConfig(env) {
  const row = await env.DB.prepare("SELECT value FROM content WHERE key = 'kiosk'").first();
  return { ...DEFAULT_KIOSK, ...(row ? JSON.parse(row.value) : {}) };
}

/** Ventana de una clase grupal: se abre poco antes de terminar y se cierra un rato después. */
export function classWindow(cfg, day, start, end) {
  const opens = Math.max(toMin(start), toMin(end) - (Number(cfg.classOpenBefore) || 30));
  const closes = toMin(end) + (Number(cfg.graceMinutes) || 90);
  const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { opens_at: isoAt(day, hm(opens)), closes_at: new Date(new Date(isoAt(day, end)).getTime() + (closes - toMin(end)) * 60000).toISOString() };
}

// ---------- utilidades de seguridad ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const enc = new TextEncoder();
const digest = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function bump(env, key, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at <= ?3 THEN 1 ELSE n + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END RETURNING n'
  ).bind(key, now + windowSec, now).first();
  return row?.n || 0;
}
async function count(env, key) {
  const row = await env.DB.prepare('SELECT n, reset_at FROM rate_limits WHERE k = ?').bind(key).first();
  return row && row.reset_at > Math.floor(Date.now() / 1000) ? row.n : 0;
}
const ipOf = (request) => request.headers.get('CF-Connecting-IP') || 'local';

const out = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
class KioskError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new KioskError(status, msg); };

// ---------- enlace público de asistencia ----------
export async function kiosk(request, env, url) {
  try {
    return await kioskInner(request, env, url);
  } catch (e) {
    if (e instanceof KioskError) return out({ error: e.message }, e.status);
    throw e;
  }
}

async function access(env, cfg, key, code) {
  if (code) {
    const cls = await env.DB.prepare('SELECT * FROM attendance_class WHERE code = ?').bind(String(code).slice(0, 40)).first();
    if (!cls) fail(404, 'Esta clase no existe. Escanea el código que muestra el profesor.');
    return { cls };
  }
  if (!cfg.active || !cfg.token || !key || !(await sameSecret(key, cfg.token))) fail(403, 'Este enlace no está activo. Pide el enlace nuevo en recepción.');
  return { cls: null };
}

function classState(cls, now = new Date()) {
  if (cls.status === 'closed') return 'closed';
  if (cls.day !== localDay(now)) return now < new Date(cls.opens_at) ? 'early' : 'closed';
  if (now < new Date(cls.opens_at)) return 'early';
  if (now > new Date(cls.closes_at)) return 'closed';
  return 'open';
}
const classPublic = (cls) => ({
  teacher: cls.teacher_name, subject: cls.subject, topic: cls.topic || '', day: cls.day, start: cls.start_time, end: cls.end_time,
  state: classState(cls), opensAt: hmOf(cls.opens_at), closesAt: hmOf(cls.closes_at),
});

async function verifyStudent(env, request, personId, phone4) {
  if (await bump(env, `kiosk-verify:${ipOf(request)}`, 3600) > 300) fail(429, 'Demasiados intentos desde este equipo. Avisa en recepción.');
  const id = Number(personId);
  if (!id) fail(400, 'Elige tu nombre de la lista.');
  const lockKey = `kiosk-pin:${id}`;
  if (await count(env, lockKey) >= 6) fail(429, 'Demasiados intentos con este nombre. Espera una hora o avisa en recepción.');
  const p = await env.DB.prepare("SELECT id, full_name, phone, guardian_phone FROM people WHERE id = ? AND status = 'active' AND person_type = 'student'").bind(id).first();
  if (!p) fail(404, 'No encontramos tu nombre entre los estudiantes. Avisa en recepción.');
  const d = String(phone4 || '').replace(/\D/g, '');
  const phones = [p.phone, p.guardian_phone].map((x) => String(x || '').replace(/\D/g, '')).filter((x) => x.length >= 4);
  if (!phones.length) fail(400, 'No tienes un celular registrado. Avisa en recepción para que lo agreguen.');
  if (d.length !== 4 || !phones.some((x) => x.endsWith(d))) {
    await bump(env, lockKey, 3600);
    fail(400, 'Los 4 dígitos no coinciden con el celular registrado. No se puede registrar la asistencia.');
  }
  return p;
}

async function checkOverlap(env, personId, day, start, end) {
  const { results } = await env.DB.prepare('SELECT check_in, check_out, subject FROM attendance_log WHERE person_id = ? AND day = ? AND check_out IS NOT NULL').bind(personId, day).all();
  const s = toMin(start);
  const e = toMin(end);
  for (const r of results) {
    const rs = toMin(hmOf(r.check_in));
    const re = toMin(hmOf(r.check_out));
    if (s < re && e > rs) fail(409, `Ya registraste ${r.subject || 'una clase'} de ${hmOf(r.check_in)} a ${hmOf(r.check_out)} y se cruza con este horario.`);
  }
}

async function monthMinutes(env, personId, day) {
  return (await env.DB.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM attendance_log WHERE person_id = ? AND day LIKE ?').bind(personId, `${day.slice(0, 7)}%`).first()).m;
}

async function kioskInner(request, env, url) {
  const cfg = await kioskConfig(env);
  const isPost = request.method === 'POST';
  let b = {};
  if (isPost) {
    const t = await request.text();
    if (t.length > 200_000) fail(413, 'Datos demasiado grandes');
    try { b = JSON.parse(t || '{}'); } catch { fail(400, 'Datos inválidos'); }
  }
  const q = isPost ? b : Object.fromEntries(url.searchParams);
  const { cls } = await access(env, cfg, q.k, q.c);
  const p = url.pathname;
  const now = new Date();
  const today = localDay(now);

  if (p === '/api/kiosk/info') {
    if (cls) return out({ title: cfg.title, needSignature: !!cfg.needSignature, class: classPublic(cls), now: localHM(now), today });
    const { results } = await env.DB.prepare("SELECT id, full_name, subjects FROM people WHERE status = 'active' AND person_type = 'teacher' ORDER BY full_name").all();
    return out({
      title: cfg.title, needSignature: !!cfg.needSignature, now: localHM(now), today, maxHours: cfg.maxHours, graceMinutes: cfg.graceMinutes,
      subjects: (cfg.subjects && cfg.subjects.length ? cfg.subjects : DEFAULT_SUBJECTS),
      teachers: results.map((t) => ({ id: t.id, name: t.full_name, subjects: String(t.subjects || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean) })),
    });
  }

  if (p === '/api/kiosk/search') {
    if (await bump(env, `kiosk-search:${ipOf(request)}`, 3600) > 600) fail(429, 'Demasiadas búsquedas. Intenta en un rato.');
    const qq = norm(q.q);
    if (qq.length < 2) return out([]);
    const { results } = await env.DB.prepare("SELECT id, full_name FROM people WHERE status = 'active' AND person_type = 'student'").all();
    const words = qq.split(' ');
    const found = results.filter((r) => { const n = norm(r.full_name); return words.every((w) => n.split(' ').some((x) => x.startsWith(w))); }).slice(0, 8);
    return out(found.map((f) => ({ id: f.id, name: f.full_name })));
  }

  if (p === '/api/kiosk/verify' && isPost) {
    const st = await verifyStudent(env, request, b.person_id, b.phone4);
    return out({ ok: true, name: st.full_name });
  }

  if (p === '/api/kiosk/register' && isPost) {
    if (await bump(env, `kiosk-reg:${ipOf(request)}`, 3600) > 200) fail(429, 'Demasiados registros desde este equipo. Avisa en recepción.');
    const sig = String(b.signature || '');
    if (sig && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig)) fail(400, 'Firma inválida');
    if (cfg.needSignature && sig.length < 400) fail(400, 'Firma en el recuadro antes de continuar.');
    const st = await verifyStudent(env, request, b.person_id, b.phone4);
    let start = String(b.start || '');
    let end = String(b.end || '');
    let teacher = null;
    let subject = String(b.subject || '').trim().slice(0, 60);
    let topic = String(b.topic || '').trim().slice(0, 200);
    let classId = null;

    if (cls) {
      // Clase grupal: profesor, materia, tema y horario los fijó la clase. El estudiante solo puede acortar su tiempo.
      const state = classState(cls, now);
      if (state === 'early') fail(409, `El registro de esta clase se abre a las ${hmOf(cls.opens_at)}.`);
      if (state === 'closed') fail(409, 'El registro de esta clase ya se cerró. Avisa al profesor.');
      start = isHM(start) ? start : cls.start_time;
      end = isHM(end) ? end : cls.end_time;
      if (toMin(start) < toMin(cls.start_time) || toMin(end) > toMin(cls.end_time))
        fail(400, `La clase fue de ${cls.start_time} a ${cls.end_time}. Solo puedes indicar una hora dentro de ese horario.`);
      const dup = await env.DB.prepare('SELECT id FROM attendance_log WHERE class_id = ? AND person_id = ?').bind(cls.id, st.id).first();
      if (dup) fail(409, 'Ya estás registrado en esta clase.');
      teacher = { id: cls.teacher_id, name: cls.teacher_name };
      subject = cls.subject;
      topic = cls.topic || '';
      classId = cls.id;
    } else {
      if (!isHM(start) || !isHM(end)) fail(400, 'Elige la hora de entrada y de salida.');
      const tId = Number(b.teacher_id);
      const t = tId && await env.DB.prepare("SELECT id, full_name FROM people WHERE id = ? AND person_type = 'teacher' AND status = 'active'").bind(tId).first();
      if (!t) fail(400, 'Elige al profesor de la clase.');
      teacher = { id: t.id, name: t.full_name };
      if (!subject) fail(400, 'Elige la materia.');
      // Reglas de horario: no se registra antes de terminar la clase ni mucho después.
      const nowM = toMin(localHM(now));
      if (toMin(end) > nowM + 10) fail(400, `La hora de salida (${end}) todavía no llega. Registra tu asistencia al terminar la clase.`);
      if (nowM - toMin(end) > (Number(cfg.graceMinutes) || 90))
        fail(400, `Solo puedes registrar una clase hasta ${cfg.graceMinutes || 90} minutos después de que termina. Avisa en recepción.`);
    }
    const minutes = toMin(end) - toMin(start);
    if (minutes <= 0) fail(400, 'La hora de salida debe ser después de la hora de entrada.');
    if (minutes < (Number(cfg.minMinutes) || 15)) fail(400, `Una clase debe durar al menos ${cfg.minMinutes || 15} minutos.`);
    if (minutes > (Number(cfg.maxHours) || 6) * 60) fail(400, `Una clase no puede durar más de ${cfg.maxHours || 6} horas.`);
    if (toMin(start) < 6 * 60) fail(400, 'Revisa la hora de entrada.');
    await checkOverlap(env, st.id, today, start, end);

    await env.DB.prepare(`INSERT INTO attendance_log (person_id, person_name, person_type, day, check_in, check_out, minutes, sign_out, source, ip, teacher_id, teacher_name, subject, topic, class_id)
      VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(st.id, st.full_name, today, isoAt(today, start), isoAt(today, end), minutes, sig || null, cls ? 'class' : 'kiosk', ipOf(request),
        teacher.id || null, teacher.name, subject, topic || null, classId).run();
    return out({ ok: true, name: st.full_name, start, end, minutes, teacher: teacher.name, subject, topic, monthMinutes: await monthMinutes(env, st.id, today) });
  }
  return out({ error: 'No encontrado' }, 404);
}

// ---------- resumen para el Inicio (según permisos) ----------
export async function summary(env, can) {
  const today = localDay();
  const month = today.slice(0, 7);
  const res = { today };
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  if (can(['asistencia'])) {
    const t = await q("SELECT COUNT(*) AS n, COUNT(DISTINCT person_id) AS p, COALESCE(SUM(minutes), 0) AS m FROM attendance_log WHERE day = ? AND person_type = 'student'", today);
    res.todayRecords = t.n;
    res.todayStudents = t.p;
    res.todayHours = Math.round((t.m / 60) * 10) / 10;
    res.monthHours = Math.round(((await q("SELECT COALESCE(SUM(minutes), 0) AS m FROM attendance_log WHERE day LIKE ? AND person_type = 'student'", `${month}%`)).m / 60) * 10) / 10;
    res.openClasses = (await q("SELECT COUNT(*) AS n FROM attendance_class WHERE day = ? AND status = 'open' AND closes_at > ?", today, new Date().toISOString())).n;
    res.absent7 = (await q(
      `SELECT COUNT(*) AS n FROM people p WHERE p.person_type = 'student' AND p.status = 'active'
       AND EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = p.id AND e.status = 'active')
       AND NOT EXISTS (SELECT 1 FROM attendance_log a WHERE a.person_id = p.id AND a.day >= date(?, '-7 days'))`, today)).n;
  }
  if (can(['pagos'])) {
    const late = await q("SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'pending' AND due_date < ?", today);
    res.overdue = { n: late.n, amount: late.s };
    res.dueWeek = (await q("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'pending' AND due_date >= ? AND due_date <= date(?, '+7 days')", today, today)).s;
    res.collectedMonth = (await q("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'paid' AND payment_date LIKE ?", `${month}%`)).s;
  }
  if (can(['interesados'])) res.newLeads = (await q("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'")).n;
  if (can(['estudiantes'])) res.students = (await q("SELECT COUNT(*) AS n FROM people WHERE person_type = 'student' AND status = 'active'")).n;
  if (can(['finanzas'])) res.expensesMonth = (await q('SELECT COALESCE(SUM(amount), 0) AS s FROM expenses WHERE date LIKE ?', `${month}%`)).s;
  return res;
}
