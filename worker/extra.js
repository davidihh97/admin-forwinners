// Asistencia con firma (enlace público), registro de actividad y resumen del día.

const TZ = 'America/Guayaquil';
export const localDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });

// ---------- tablas nuevas: se crean solas la primera vez (no hace falta la consola de D1) ----------
let ready = null;
export function ensureSchema(env) {
  ready ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS attendance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, person_id INTEGER, person_name TEXT NOT NULL, person_type TEXT NOT NULL DEFAULT 'student',
      day TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT, minutes INTEGER, sign_in TEXT, sign_out TEXT,
      source TEXT NOT NULL DEFAULT 'kiosk', notes TEXT, ip TEXT, created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_att_person_day ON attendance_log(person_id, day)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_att_day ON attendance_log(day)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, category TEXT NOT NULL, description TEXT, amount REAL NOT NULL,
      method TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, username TEXT, action TEXT NOT NULL,
      entity TEXT, entity_id TEXT, summary TEXT)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at)'),
  ]).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

// ---------- registro de actividad ----------
const ENTITY = {
  people: 'Persona', courses: 'Curso', course_groups: 'Curso', enrollments: 'Inscripción', payments: 'Pago', exam_scores: 'Nota',
  inquiries: 'Interesado', teacher_payouts: 'Pago a profesor', attendance_log: 'Asistencia', expenses: 'Gasto',
  operations: 'Horario y cursos', site_published: 'Página web', kiosk: 'Enlace de firma', admin_users: 'Usuario',
};
export const entityName = (k) => ENTITY[k] || k;

export function describeRow(row = {}) {
  const name = row.full_name || row.person_name || row.group_name || row.exam_name || row.description || row.name || row.username || '';
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

// ---------- enlace público de firma ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const enc = new TextEncoder();
const digest = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export const DEFAULT_KIOSK = { active: false, token: '', needPhone: false, needSignature: true, allowUnknown: true, maxHours: 8, title: 'For Winners' };

async function kioskConfig(env) {
  const row = await env.DB.prepare("SELECT value FROM content WHERE key = 'kiosk'").first();
  return { ...DEFAULT_KIOSK, ...(row ? JSON.parse(row.value) : {}) };
}

async function limited(env, request, kind, max) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (k, n, reset_at) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN reset_at <= ?3 THEN 1 ELSE n + 1 END, reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END RETURNING n'
  ).bind(`kiosk-${kind}:${ip}`, now + 3600, now).first();
  return row && row.n > max;
}

const out = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

export async function kiosk(request, env, url) {
  const cfg = await kioskConfig(env);
  const isPost = request.method === 'POST';
  let b = {};
  if (isPost) {
    const t = await request.text();
    if (t.length > 200_000) return out({ error: 'Firma demasiado grande' }, 413);
    try { b = JSON.parse(t || '{}'); } catch { return out({ error: 'Datos inválidos' }, 400); }
  }
  const key = isPost ? b.k : url.searchParams.get('k');
  if (!cfg.active || !cfg.token || !key || !(await sameSecret(key, cfg.token)))
    return out({ error: 'Este enlace no está activo. Pide el enlace nuevo en recepción.' }, 403);

  const p = url.pathname;
  if (p === '/api/kiosk/info') {
    return out({ title: cfg.title, needPhone: !!cfg.needPhone, needSignature: !!cfg.needSignature, allowUnknown: !!cfg.allowUnknown, today: localDay() });
  }

  if (p === '/api/kiosk/search') {
    if (await limited(env, request, 'search', 400)) return out({ error: 'Demasiadas búsquedas. Intenta en un rato.' }, 429);
    const q = norm(url.searchParams.get('q'));
    if (q.length < 2) return out([]);
    const { results } = await env.DB.prepare("SELECT id, full_name, person_type FROM people WHERE status = 'active' AND person_type IN ('student', 'teacher')").all();
    const words = q.split(' ');
    const found = results.filter((r) => { const n = norm(r.full_name); return words.every((w) => n.split(' ').some((x) => x.startsWith(w))); }).slice(0, 8);
    const today = localDay();
    const open = found.length
      ? (await env.DB.prepare(`SELECT person_id FROM attendance_log WHERE check_out IS NULL AND day = ? AND person_id IN (${found.map(() => '?').join(',')})`).bind(today, ...found.map((f) => f.id)).all()).results.map((r) => r.person_id)
      : [];
    return out(found.map((f) => ({ id: f.id, name: f.full_name, type: f.person_type, inside: open.includes(f.id) })));
  }

  if (p === '/api/kiosk/sign' && isPost) {
    if (await limited(env, request, 'sign', 120)) return out({ error: 'Demasiados registros desde este equipo. Avisa en recepción.' }, 429);
    const sig = String(b.signature || '');
    if (sig && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig)) return out({ error: 'Firma inválida' }, 400);
    if (cfg.needSignature && sig.length < 400) return out({ error: 'Firma en el recuadro antes de continuar' }, 400);
    let person = null;
    let name = '';
    if (b.person_id) {
      person = await env.DB.prepare("SELECT id, full_name, person_type, phone, guardian_phone FROM people WHERE id = ? AND status = 'active'").bind(Number(b.person_id)).first();
      if (!person) return out({ error: 'No te encontramos. Avisa en recepción.' }, 404);
      if (cfg.needPhone) {
        const d = String(b.phone4 || '').replace(/\D/g, '');
        const ok = [person.phone, person.guardian_phone].some((ph) => ph && d.length === 4 && String(ph).replace(/\D/g, '').endsWith(d));
        if (!ok) return out({ error: 'Los 4 dígitos no coinciden con tu celular registrado.' }, 400);
      }
      name = person.full_name;
    } else {
      if (!cfg.allowUnknown) return out({ error: 'Busca tu nombre en la lista. Si no apareces, avisa en recepción.' }, 400);
      name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      if (name.split(' ').filter((w) => w.length >= 2).length < 2) return out({ error: 'Escribe tu nombre y apellido' }, 400);
    }
    const now = new Date();
    const iso = now.toISOString();
    const today = localDay(now);
    const ip = request.headers.get('CF-Connecting-IP') || null;
    const who = person ? ['person_id = ?', person.id] : ['person_id IS NULL AND person_name = ?', name];
    const open = await env.DB.prepare(`SELECT * FROM attendance_log WHERE ${who[0]} AND check_out IS NULL AND day = ? ORDER BY id DESC LIMIT 1`).bind(who[1], today).first();
    const last = await env.DB.prepare(`SELECT check_in, check_out FROM attendance_log WHERE ${who[0]} ORDER BY id DESC LIMIT 1`).bind(who[1]).first();
    const lastTime = last ? new Date(last.check_out || last.check_in).getTime() : 0;
    if (now - lastTime < 60_000) return out({ error: 'Ya registramos tu firma hace un momento.' }, 409);

    const month = today.slice(0, 7);
    const monthMinutes = async () =>
      (await env.DB.prepare(`SELECT COALESCE(SUM(minutes), 0) AS m FROM attendance_log WHERE ${who[0]} AND day LIKE ?`).bind(who[1], `${month}%`).first()).m;

    if (open) {
      const minutes = Math.max(0, Math.min(Math.round((now - new Date(open.check_in)) / 60000), (Number(cfg.maxHours) || 12) * 60));
      await env.DB.prepare('UPDATE attendance_log SET check_out = ?, sign_out = ?, minutes = ? WHERE id = ?').bind(iso, sig || null, minutes, open.id).run();
      return out({ action: 'out', name, check_in: open.check_in, check_out: iso, minutes, monthMinutes: await monthMinutes() });
    }
    await env.DB.prepare('INSERT INTO attendance_log (person_id, person_name, person_type, day, check_in, sign_in, source, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(person?.id || null, name, person?.person_type || 'other', today, iso, sig || null, 'kiosk', ip).run();
    return out({ action: 'in', name, check_in: iso, monthMinutes: await monthMinutes() });
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
    res.inside = (await q('SELECT COUNT(*) AS n FROM attendance_log WHERE day = ? AND check_out IS NULL', today)).n;
    res.todayVisits = (await q('SELECT COUNT(DISTINCT COALESCE(person_id, person_name)) AS n FROM attendance_log WHERE day = ?', today)).n;
    res.monthHours = Math.round(((await q("SELECT COALESCE(SUM(minutes), 0) AS m FROM attendance_log WHERE day LIKE ? AND person_type = 'student'", `${month}%`)).m / 60) * 10) / 10;
    res.forgotten = (await q('SELECT COUNT(*) AS n FROM attendance_log WHERE day < ? AND check_out IS NULL', today)).n;
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
