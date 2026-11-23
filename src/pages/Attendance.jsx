import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Plus, Pencil, Trash2, Copy, RefreshCw, Download, Link2, Search, Signature, Users, Clock, AlertTriangle, ExternalLink, Timer,
  QrCode, Lock, Unlock, Check, Presentation, Maximize2,
} from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db, signatures, loadDoc, saveDoc } from '../lib/backend';
import {
  byId, today, addDays, startOfWeek, fmtDate, dur, hoursNum, clock, hmOf, isoAt, hmToMin, nowHm, teacherBlocks, attendanceFlags,
} from '../lib/people';
import { Modal, PageHead, Seg, Text, Num, Select, Check as CheckBox, Kpi } from '../components/ui';

const SOURCE = { kiosk: 'Individual', class: 'Clase grupal', manual: 'A mano' };
const monthStart = (iso = today()) => `${iso.slice(0, 7)}-01`;
const prevMonth = () => { const d = new Date(`${monthStart()}T12:00:00`); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('en-CA'); };
const endOfMonth = (iso) => { const d = new Date(`${iso.slice(0, 7)}-01T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toLocaleDateString('en-CA'); };
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
const classLink = (c) => `${location.origin}/firmar?c=${c.code}`;
const classState = (c) => {
  const now = new Date();
  if (c.status === 'closed' || now > new Date(c.closes_at)) return { key: 'closed', label: 'Cerrada', tone: 'tag-mut' };
  if (c.day !== today() || now < new Date(c.opens_at)) return { key: 'early', label: `Se abre ${hmOf(c.opens_at)}`, tone: 'tag-info' };
  return { key: 'open', label: `Abierta hasta ${hmOf(c.closes_at)}`, tone: 'tag-ok' };
};
const DEFAULT_SUBJECTS = ['Matemática', 'Física', 'Química', 'Biología', 'Anatomía', 'Lenguaje', 'Estadística', 'Emprendimiento', 'Razonamiento', 'Inglés', 'Nivelación', 'Tareas dirigidas', 'Tutoría', 'Computación', 'Simulacro'];

export default function Attendance() {
  const { notify } = useStore();
  const [tab, setTab] = useState('hoy');
  const [range, setRange] = useState({ since: addDays(today(), -120) });
  const logs = useTable('attendance_log', [], range);
  const classes = useTable('attendance_class', [], range);
  const people = useTable('people');
  const [kcfg, setKcfg] = useState(null);
  const [edit, setEdit] = useState(null);
  const [sig, setSig] = useState(null);
  const [showClass, setShowClass] = useState(null);
  const [newClass, setNewClass] = useState(null);

  useEffect(() => { loadDoc('kiosk').then((r) => setKcfg({ subjects: DEFAULT_SUBJECTS, ...(r.value || {}) })).catch(() => setKcfg({ subjects: DEFAULT_SUBJECTS })); }, []);
  // Se actualiza sola: cada 30 s y al volver a esta pestaña.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') { logs.reload(); classes.reload(); } };
    const t = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [logs.reload, classes.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = today();
  const all = logs.rows || [];
  const cls = classes.rows || [];
  const flags = useMemo(() => attendanceFlags(all, cls), [all, cls]);
  const todays = all.filter((l) => l.day === t).sort((a, b) => String(b.check_out || b.check_in).localeCompare(String(a.check_out || a.check_in)));
  const todayStudents = todays.filter((l) => l.person_type === 'student');
  const openClasses = cls.filter((c) => c.day === t && classState(c).key !== 'closed');
  const reviewN = Object.keys(flags).length;
  const pById = byId(people.rows);
  const teachers = (people.rows || []).filter((p) => p.person_type === 'teacher' && p.status === 'active');
  const subjects = kcfg?.subjects?.length ? kcfg.subjects : DEFAULT_SUBJECTS;

  async function remove(l) {
    if (!confirm(`¿Borrar el registro de ${l.person_name} del ${fmtDate(l.day)}?`)) return;
    await db.remove('attendance_log', l.id);
    logs.setRows((rs) => rs.filter((x) => x.id !== l.id));
  }
  async function showSig(l) {
    try { setSig({ log: l, ...(await signatures(l.id)) }); } catch (e) { notify(e.message, 'bad'); }
  }
  const openEdit = (l) => setEdit({ ...l, inTime: hmOf(l.check_in), outTime: hmOf(l.check_out) });
  const rowActions = (l) => (
    <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
      {(l.has_sign_in || l.has_sign_out) ? <button className="btn sm ghost icon" title="Ver firma" onClick={() => showSig(l)}><Signature size={14} /></button> : null}
      <button className="btn sm ghost icon" title="Editar" onClick={() => openEdit(l)}><Pencil size={14} /></button>
      <button className="btn sm ghost icon danger" title="Borrar" onClick={() => remove(l)}><Trash2 size={14} /></button>
    </div>
  );
  const ctx = { all, cls, flags, rowActions, pById, range, setRange, openEdit, onSig: showSig, remove };

  if (logs.error) return <div className="alert bad">{logs.error}</div>;
  return (
    <>
      <PageHead title="Asistencia" desc="Los estudiantes registran su asistencia al terminar la clase con el enlace o con el QR de una clase grupal. Aquí ves todo: estudiantes, profesores y horas.">
        <button className="btn" onClick={() => setEdit({ person_id: '', person_name: '', person_type: 'student', day: t, inTime: '', outTime: nowHm(), teacher_id: '', subject: '', topic: '', notes: '' })}><Plus size={16} /> Registrar a mano</button>
        <button className="btn primary" onClick={() => setNewClass({ teacher_id: '', subject: '', topic: '', day: t, start_time: '', end_time: '' })}><QrCode size={16} /> Nueva clase grupal</button>
      </PageHead>

      <div className="grid g4 kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={Users} label="Estudiantes hoy" value={new Set(todayStudents.map((l) => l.person_id || l.person_name)).size} sub={`${todayStudents.length} registros`} tone="ok" />
        <Kpi icon={Timer} label="Horas de estudiantes hoy" value={`${hoursNum(todayStudents.reduce((a, l) => a + (l.minutes || 0), 0))} h`} />
        <Kpi icon={QrCode} label="Clases grupales abiertas" value={openClasses.length} sub={openClasses.map((c) => c.subject).slice(0, 3).join(', ') || 'Ninguna'} onClick={() => setTab('clases')} />
        <Kpi icon={AlertTriangle} label="Por revisar" value={reviewN} sub={reviewN ? 'Horarios dudosos' : 'Todo en orden'} tone={reviewN ? 'warn' : undefined} onClick={() => setTab('revisar')} />
      </div>

      <div className="tabs">
        <Seg value={tab} onChange={setTab} options={[
          { value: 'hoy', label: 'Hoy' }, { value: 'clases', label: 'Clases grupales' }, { value: 'revisar', label: `Por revisar${reviewN ? ` (${reviewN})` : ''}` },
          { value: 'estudiantes', label: 'Horas de estudiantes' }, { value: 'profesores', label: 'Profesores' }, { value: 'registro', label: 'Registro completo' }, { value: 'enlace', label: 'Enlace y opciones' },
        ]} />
      </div>

      {!logs.rows && tab !== 'enlace' && <div className="empty">Cargando…</div>}
      {logs.rows && tab === 'hoy' && (
        <div className="card table-wrap">
          <LogTable rows={todays} ctx={ctx} showDay={false} />
          {!todays.length && <div className="empty">Nadie ha registrado asistencia hoy. Comparte el <button className="linkish" onClick={() => setTab('enlace')}>enlace</button> o crea una clase grupal.</div>}
        </div>
      )}
      {logs.rows && tab === 'clases' && <Classes cls={cls} all={all} onShow={setShowClass} onNew={() => setNewClass({ teacher_id: '', subject: '', topic: '', day: t, start_time: '', end_time: '' })} reload={classes.reload} />}
      {logs.rows && tab === 'revisar' && <Review ctx={ctx} logs={logs} />}
      {logs.rows && tab === 'estudiantes' && <Students ctx={ctx} people={people.rows || []} />}
      {logs.rows && tab === 'profesores' && <Teachers ctx={ctx} />}
      {logs.rows && tab === 'registro' && <FullLog ctx={ctx} />}
      {tab === 'enlace' && kcfg && <KioskSettings cfg={kcfg} setCfg={setKcfg} />}

      {edit && <EditLog edit={edit} setEdit={setEdit} people={(people.rows || []).filter((p) => p.status === 'active')} teachers={teachers} subjects={subjects} pById={pById} onSaved={(row, isNew) => {
        logs.setRows((rs) => (isNew ? [row, ...rs] : rs.map((x) => (x.id === row.id ? row : x))));
        setEdit(null);
        notify('Asistencia guardada');
      }} />}
      {newClass && <NewClass value={newClass} setValue={setNewClass} teachers={teachers} subjects={subjects} onCreated={(row) => { classes.setRows((rs) => [row, ...rs]); setNewClass(null); setShowClass(row); setTab('clases'); }} />}
      {showClass && <ClassScreen cls={cls.find((c) => c.id === showClass.id) || showClass} logs={all.filter((l) => l.class_id === showClass.id)} onClose={() => setShowClass(null)}
        reload={() => { logs.reload(); classes.reload(); }} onRemove={remove} />}
      {sig && (
        <Modal title={`Firma · ${sig.log.person_name}`} onClose={() => setSig(null)}>
          <div className="small muted">{fmtDate(sig.log.day)} · {clock(sig.log.check_in)}–{clock(sig.log.check_out)}</div>
          {sig.sign_out || sig.sign_in ? <img className="sig-img" src={sig.sign_out || sig.sign_in} alt="Firma" /> : <span className="muted small">Sin firma</span>}
        </Modal>
      )}
    </>
  );
}

/* ---------- tabla de registros ---------- */
function LogTable({ rows, ctx, showDay = true }) {
  return (
    <table className="t">
      <thead><tr>{showDay && <th>Día</th>}<th>Persona</th><th>Clase</th><th>Horario</th><th className="num">Tiempo</th><th>Origen</th><th /></tr></thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id}>
            {showDay && <td className="small">{fmtDate(l.day)}</td>}
            <td>
              <div className="person">
                <span className="avatar">{l.person_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                <div><b>{l.person_name}</b><div className="small muted">{l.person_type === 'teacher' ? 'Profesor' : l.person_type === 'student' ? 'Estudiante' : 'No está en la lista'}</div></div>
              </div>
            </td>
            <td>
              {l.subject ? <><b>{l.subject}</b>{l.topic && <span className="muted"> · {l.topic}</span>}</> : <span className="muted">—</span>}
              {l.teacher_name && <div className="small muted">Prof. {l.teacher_name}</div>}
            </td>
            <td className="mono" style={{ whiteSpace: 'nowrap' }}>{clock(l.check_in)} – {l.check_out ? clock(l.check_out) : <span className="chip tag-warn">sin salida</span>}</td>
            <td className="num">{dur(l.minutes)}</td>
            <td>
              <span className={`chip ${l.source === 'class' ? 'tag-info' : l.source === 'manual' ? 'tag-mut' : 'tag-ok'}`}>{SOURCE[l.source] || 'Enlace'}</span>
              {ctx.flags[l.id] && <div className="chip tag-warn" style={{ marginTop: 4 }} title={ctx.flags[l.id].join('\n')}><AlertTriangle size={12} /> Revisar</div>}
            </td>
            <td>{ctx.rowActions(l)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- clases grupales ---------- */
function Classes({ cls, all, onShow, onNew, reload }) {
  const { notify } = useStore();
  const list = [...cls].sort((a, b) => `${b.day}${b.start_time}`.localeCompare(`${a.day}${a.start_time}`)).slice(0, 60);
  const count = (c) => all.filter((l) => l.class_id === c.id).length;
  async function setStatus(c, patch) {
    try { await db.update('attendance_class', c.id, patch); reload(); } catch (e) { notify(e.message, 'bad'); }
  }
  return (
    <>
      <div className="alert info" style={{ marginBottom: 16 }}>
        <QrCode size={18} />
        <div><b>Para grupos grandes:</b> crea la clase con su profesor, materia y horario, y muestra el QR en la pantalla o el proyector. Todos lo escanean a la vez y solo ponen su nombre y los 4 dígitos. Nadie puede cambiar las horas: solo acortarlas si llegó tarde o salió antes. Desde aquí ves en vivo quién se registró y quitas a quien no estuvo.</div>
      </div>
      <div className="grid g3">
        {list.map((c) => {
          const st = classState(c);
          return (
            <div key={c.id} className="card">
              <div className="card-h" style={{ marginBottom: 4 }}>
                <h2 className="grow">{c.subject}</h2>
                <span className={`chip ${st.tone}`}>{st.label}</span>
              </div>
              <div className="small muted">{fmtDate(c.day)} · {c.start_time}–{c.end_time} · Prof. {c.teacher_name}</div>
              {c.topic && <div className="small" style={{ marginTop: 4 }}>{c.topic}</div>}
              <div className="row" style={{ marginTop: 12 }}>
                <span className="chip tag-mut"><Users size={12} /> {count(c)} registrados</span>
                <div className="row right" style={{ gap: 4 }}>
                  <button className="btn sm" onClick={() => onShow(c)}><Maximize2 size={13} /> QR y lista</button>
                  {st.key === 'closed'
                    ? <button className="btn sm ghost" title="Reabrir 15 minutos" onClick={() => setStatus(c, { status: 'open', closes_at: new Date(Date.now() + 15 * 60000).toISOString() })}><Unlock size={13} /></button>
                    : <button className="btn sm ghost" title="Cerrar el registro" onClick={() => setStatus(c, { status: 'closed' })}><Lock size={13} /></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <div className="card empty">Aún no hay clases grupales. <button className="linkish" onClick={onNew}>Crear la primera</button></div>}
    </>
  );
}

function NewClass({ value: v, setValue, teachers, subjects, onCreated }) {
  const { notify } = useStore();
  const set = (patch) => setValue({ ...v, ...patch });
  const teacher = teachers.find((t) => String(t.id) === String(v.teacher_id));
  const mine = String(teacher?.subjects || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  async function create() {
    try {
      if (!v.teacher_id || !v.subject || !v.start_time || !v.end_time) return notify('Completa profesor, materia y horario', 'bad');
      if (v.end_time <= v.start_time) return notify('La hora de fin debe ser después del inicio', 'bad');
      onCreated(await db.add('attendance_class', { teacher_id: Number(v.teacher_id), subject: v.subject, topic: v.topic, day: v.day, start_time: v.start_time, end_time: v.end_time }));
    } catch (e) { notify(e.message, 'bad'); }
  }
  return (
    <Modal title="Nueva clase grupal" onClose={() => setValue(null)}
      footer={<><button className="btn" onClick={() => setValue(null)}>Cancelar</button><button className="btn primary" onClick={create}><QrCode size={15} /> Crear y mostrar QR</button></>}>
      <Select label="Profesor" value={String(v.teacher_id)} onChange={(x) => set({ teacher_id: x })} options={[{ value: '', label: 'Elige…' }, ...teachers.map((t) => ({ value: String(t.id), label: t.full_name }))]} />
      {!teachers.length && <div className="alert warn small">Primero agrega a los profesores en la sección Profesores.</div>}
      <Select label="Materia" value={v.subject} onChange={(x) => set({ subject: x })} options={[{ value: '', label: 'Elige…' }, ...[...mine, ...subjects.filter((s) => !mine.includes(s))].map((s) => ({ value: s, label: s }))]} />
      <Text label="Tema (opcional)" value={v.topic} onChange={(x) => set({ topic: x })} placeholder="Ej.: Simulacro 2 · Ecuaciones" />
      <div className="grid g3">
        <Text label="Día" type="date" value={v.day} onChange={(x) => set({ day: x })} />
        <Text label="Inicio" type="time" value={v.start_time} onChange={(x) => set({ start_time: x })} />
        <Text label="Fin" type="time" value={v.end_time} onChange={(x) => set({ end_time: x })} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>El QR acepta registros desde un rato antes de que termine la clase hasta un rato después (se configura en «Enlace y opciones»). Puedes cerrarlo o reabrirlo cuando quieras.</p>
    </Modal>
  );
}

function ClassScreen({ cls: c, logs, onClose, reload, onRemove }) {
  const [qr, setQr] = useState('');
  const link = classLink(c);
  const st = classState(c);
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 520, color: { dark: '#0b2a5b' } }).then(setQr); }, [link]);
  useEffect(() => { const t = setInterval(reload, 5000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = [...logs].sort((a, b) => a.person_name.localeCompare(b.person_name));
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal class-screen" role="dialog" aria-modal="true">
        <div className="cs-qr">
          <small>Escanea para registrar tu asistencia</small>
          <h2>{c.subject}{c.topic ? ` · ${c.topic}` : ''}</h2>
          <div className="muted">Prof. {c.teacher_name} · {c.start_time} a {c.end_time}</div>
          {qr && <img src={qr} alt="Código QR de la clase" />}
          <span className={`chip ${st.tone}`}>{st.label}</span>
          <span className="mono small muted" style={{ overflowWrap: 'anywhere' }}>{link}</span>
        </div>
        <div className="cs-list">
          <div className="row"><h2 className="grow">Registrados ({logs.length})</h2><button className="btn sm ghost" onClick={onClose}>Cerrar</button></div>
          <p className="small muted" style={{ margin: 0 }}>Se actualiza sola. Quita a quien no estuvo en clase.</p>
          <div className="list" style={{ overflow: 'auto' }}>
            {sorted.map((l) => (
              <div key={l.id} className="list-row">
                <Check size={16} color="var(--ok)" />
                <span className="grow"><b>{l.person_name}</b>{(hmOf(l.check_in) !== c.start_time || hmOf(l.check_out) !== c.end_time) && <span className="small muted"> · {hmOf(l.check_in)}–{hmOf(l.check_out)}</span>}</span>
                <button className="btn sm ghost icon danger" title="Quitar" onClick={() => onRemove(l).then(reload)}><Trash2 size={14} /></button>
              </div>
            ))}
            {!logs.length && <div className="empty small">Todavía nadie se registra.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- por revisar ---------- */
function Review({ ctx, logs }) {
  const { notify } = useStore();
  const rows = ctx.all.filter((l) => ctx.flags[l.id]).sort((a, b) => b.day.localeCompare(a.day));
  async function approve(l) {
    try { const row = await db.update('attendance_log', l.id, { reviewed: 1 }); logs.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x))); notify('Marcado como revisado'); } catch (e) { notify(e.message, 'bad'); }
  }
  return (
    <div className="card">
      <div className="card-h"><h2 className="grow">Registros por revisar</h2></div>
      <p className="small muted" style={{ marginTop: -8 }}>El sistema marca horarios distintos a los de sus compañeros o a la clase grupal del profesor, registros tardíos y entradas sin salida. Corrige la hora, apruébalo o bórralo.</p>
      <div className="list">
        {rows.map((l) => (
          <div key={l.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="var(--warn)" style={{ marginTop: 2 }} />
            <div className="grow">
              <b>{l.person_name}</b> <span className="muted">· {fmtDate(l.day)} · {l.subject || 'sin materia'} · {clock(l.check_in)}–{l.check_out ? clock(l.check_out) : '?'}</span>
              <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--warn)' }}>{ctx.flags[l.id].map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button className="btn sm" onClick={() => ctx.openEdit(l)}><Pencil size={13} /> Corregir</button>
              <button className="btn sm" onClick={() => approve(l)}><Check size={13} /> Está bien</button>
              <button className="btn sm ghost icon danger" title="Borrar" onClick={() => ctx.remove(l)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <div className="empty">Nada por revisar. 👍</div>}
    </div>
  );
}

/* ---------- períodos ---------- */
function PeriodPicker({ value, onChange }) {
  const t = today();
  const opts = [
    { value: 'week', label: 'Esta semana', from: startOfWeek(t), to: t },
    { value: 'month', label: 'Este mes', from: monthStart(t), to: t },
    { value: 'prev', label: 'Mes anterior', from: prevMonth(), to: endOfMonth(prevMonth()) },
    { value: '90', label: 'Últimos 90 días', from: addDays(t, -89), to: t },
  ];
  return (
    <div className="row">
      <Seg value={value.key} onChange={(k) => { const o = opts.find((x) => x.value === k); onChange(o ? { key: k, from: o.from, to: o.to } : { ...value, key: k }); }} options={[...opts, { value: 'custom', label: 'Otras fechas' }]} />
      {value.key === 'custom' && (
        <>
          <input className="input" style={{ width: 'auto' }} type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Desde" />
          <span className="muted">a</span>
          <input className="input" style={{ width: 'auto' }} type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Hasta" />
        </>
      )}
    </div>
  );
}
function usePeriod(ctx) {
  const [period, setPeriod] = useState({ key: 'month', from: monthStart(), to: today() });
  useEffect(() => { if (period.from < ctx.range.since) ctx.setRange({ since: period.from }); }, [period.from]); // eslint-disable-line react-hooks/exhaustive-deps
  return [period, setPeriod];
}
async function exportXlsx(name, sheets) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const [title, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), title.slice(0, 31));
  XLSX.writeFile(wb, name);
}

/* ---------- horas de estudiantes ---------- */
function Students({ ctx, people }) {
  const [period, setPeriod] = usePeriod(ctx);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const inPeriod = ctx.all.filter((l) => l.person_type !== 'teacher' && l.day >= period.from && l.day <= period.to);
  const rows = useMemo(() => {
    const m = new Map();
    for (const l of inPeriod) {
      const k = l.person_id ? `p${l.person_id}` : `n${l.person_name}`;
      const r = m.get(k) || { key: k, name: l.person_name, minutes: 0, days: new Set(), classes: 0, subjects: {}, last: '' };
      r.minutes += l.minutes || 0;
      r.days.add(l.day);
      r.classes++;
      if (l.subject) r.subjects[l.subject] = (r.subjects[l.subject] || 0) + (l.minutes || 0);
      if (l.day > r.last) r.last = l.day;
      m.set(k, r);
    }
    for (const p of people) if (p.person_type === 'student' && p.status === 'active' && !m.has(`p${p.id}`)) m.set(`p${p.id}`, { key: `p${p.id}`, name: p.full_name, minutes: 0, days: new Set(), classes: 0, subjects: {}, last: '' });
    return [...m.values()].filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  }, [inPeriod, people, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(60, ...rows.map((r) => r.minutes));
  const detail = open && inPeriod.filter((l) => (l.person_id ? `p${l.person_id}` : `n${l.person_name}`) === open.key).sort((a, b) => `${b.day}${b.check_in}`.localeCompare(`${a.day}${a.check_in}`));
  return (
    <div className="card table-wrap">
      <div className="card-h"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="search grow" style={{ maxWidth: 320 }}><Search size={15} /><input placeholder="Buscar estudiante…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn right" onClick={() => exportXlsx(`Horas-estudiantes-${period.from}-a-${period.to}.xlsx`, {
          Resumen: rows.map((r) => ({ Estudiante: r.name, 'Días': r.days.size, Clases: r.classes, Horas: hoursNum(r.minutes), ...Object.fromEntries(Object.entries(r.subjects).map(([s, m]) => [s, hoursNum(m)])), 'Última asistencia': r.last })),
        })}><Download size={15} /> Excel</button>
      </div>
      <table className="t">
        <thead><tr><th>Estudiante</th><th className="num">Días</th><th className="num">Clases</th><th className="num">Horas</th><th style={{ width: '26%' }} /><th>Materias</th><th>Última vez</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
              <td><b>{r.name}</b></td>
              <td className="num">{r.days.size}</td>
              <td className="num">{r.classes}</td>
              <td className="num"><b>{hoursNum(r.minutes)} h</b></td>
              <td><div className="bar"><div style={{ width: `${(r.minutes / max) * 100}%`, background: r.minutes ? 'var(--accent)' : 'transparent' }} /></div></td>
              <td className="small muted">{Object.keys(r.subjects).slice(0, 3).join(', ')}</td>
              <td className="small muted">{r.last ? fmtDate(r.last) : <span className="chip tag-bad">No vino</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">Sin estudiantes.</div>}
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} wide>
          <div className="grid g3 kpis">
            <Kpi label="Horas" value={`${hoursNum(open.minutes)} h`} />
            <Kpi label="Clases" value={open.classes} />
            <Kpi label="Días asistidos" value={open.days.size} />
          </div>
          <div className="row" style={{ gap: 6 }}>{Object.entries(open.subjects).map(([s, m]) => <span key={s} className="chip tag-info">{s}: {hoursNum(m)} h</span>)}</div>
          <LogTable rows={detail} ctx={ctx} />
        </Modal>
      )}
    </div>
  );
}

/* ---------- profesores ---------- */
function Teachers({ ctx }) {
  const [period, setPeriod] = usePeriod(ctx);
  const [open, setOpen] = useState(null);
  const blocks = useMemo(() => teacherBlocks(ctx.all, ctx.cls).filter((b) => b.day >= period.from && b.day <= period.to), [ctx.all, ctx.cls, period]);
  const rows = useMemo(() => {
    const m = {};
    for (const b of blocks) {
      const r = (m[b.teacherId] ||= { id: b.teacherId, name: b.name, minutes: 0, days: new Set(), blocks: [], students: new Set() });
      r.minutes += b.minutes;
      r.days.add(b.day);
      r.blocks.push(b);
      b.students.forEach((s) => r.students.add(s));
    }
    return Object.values(m).sort((a, b) => b.minutes - a.minutes);
  }, [blocks]);
  return (
    <div className="card table-wrap">
      <div className="card-h"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <p className="small muted" style={{ marginTop: -6 }}>Las horas de cada profesor salen de las clases que registraron sus estudiantes (sin contar dos veces el mismo horario), de sus clases grupales y de lo que registres a mano.</p>
      <div className="row" style={{ marginBottom: 12, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => exportXlsx(`Horas-profesores-${period.from}-a-${period.to}.xlsx`, {
          Resumen: rows.map((r) => ({ Profesor: r.name, 'Días': r.days.size, Clases: r.blocks.length, Horas: hoursNum(r.minutes), Estudiantes: r.students.size })),
          Clases: blocks.map((b) => ({ Profesor: b.name, Día: b.day, Inicio: b.start, Fin: b.end, Horas: hoursNum(b.minutes), Materias: [...b.subjects].join(', '), Temas: [...b.topics].join(', '), Estudiantes: b.students.size })),
        })}><Download size={15} /> Excel</button>
      </div>
      <table className="t">
        <thead><tr><th>Profesor</th><th className="num">Días</th><th className="num">Clases</th><th className="num">Horas</th><th className="num">Estudiantes distintos</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
              <td><div className="person"><span className="avatar"><Presentation size={15} /></span><b>{r.name}</b></div></td>
              <td className="num">{r.days.size}</td>
              <td className="num">{r.blocks.length}</td>
              <td className="num"><b>{hoursNum(r.minutes)} h</b></td>
              <td className="num">{r.students.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">No hay clases registradas en este período.</div>}
      {open && (
        <Modal title={`Prof. ${open.name}`} onClose={() => setOpen(null)} wide>
          <div className="grid g3 kpis">
            <Kpi label="Horas" value={`${hoursNum(open.minutes)} h`} />
            <Kpi label="Clases" value={open.blocks.length} />
            <Kpi label="Estudiantes distintos" value={open.students.size} />
          </div>
          <table className="t">
            <thead><tr><th>Día</th><th>Horario</th><th className="num">Tiempo</th><th>Materia y tema</th><th className="num">Estudiantes</th></tr></thead>
            <tbody>
              {[...open.blocks].sort((a, b) => `${b.day}${b.start}`.localeCompare(`${a.day}${a.start}`)).map((b, i) => (
                <tr key={i}>
                  <td>{fmtDate(b.day)}</td>
                  <td className="mono">{b.start}–{b.end}</td>
                  <td className="num">{dur(b.minutes)}</td>
                  <td>{[...b.subjects].join(', ')}{b.topics.size ? <span className="muted"> · {[...b.topics].join(', ')}</span> : ''}</td>
                  <td className="num">{b.students.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

/* ---------- registro completo ---------- */
function FullLog({ ctx }) {
  const [period, setPeriod] = usePeriod(ctx);
  const [q, setQ] = useState('');
  const [who, setWho] = useState('all');
  const rows = ctx.all
    .filter((l) => l.day >= period.from && l.day <= period.to)
    .filter((l) => who === 'all' || (who === 'teacher' ? l.person_type === 'teacher' : l.person_type !== 'teacher'))
    .filter((l) => !q || `${l.person_name} ${l.teacher_name} ${l.subject} ${l.topic}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => `${b.day}${b.check_in}`.localeCompare(`${a.day}${a.check_in}`));
  return (
    <div className="card table-wrap">
      <div className="card-h"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Seg value={who} onChange={setWho} options={[{ value: 'all', label: 'Todos' }, { value: 'student', label: 'Estudiantes' }, { value: 'teacher', label: 'Profesores' }]} />
        <div className="search grow" style={{ maxWidth: 340 }}><Search size={15} /><input placeholder="Buscar persona, profesor, materia o tema…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn right" onClick={() => exportXlsx(`Registro-asistencia-${period.from}-a-${period.to}.xlsx`, {
          Registro: rows.map((l) => ({ Día: l.day, Persona: l.person_name, Tipo: l.person_type === 'teacher' ? 'Profesor' : 'Estudiante', Profesor: l.teacher_name || '', Materia: l.subject || '', Tema: l.topic || '', Entrada: hmOf(l.check_in), Salida: hmOf(l.check_out), Minutos: l.minutes || 0, Origen: SOURCE[l.source] || l.source, 'Registrado por': l.created_by || '', Alertas: (ctx.flags[l.id] || []).join('; ') })),
        })}><Download size={15} /> Excel</button>
      </div>
      <LogTable rows={rows.slice(0, 500)} ctx={ctx} />
      {rows.length > 500 && <div className="small muted" style={{ marginTop: 8 }}>Mostrando 500 de {rows.length}. Descarga el Excel para verlos todos.</div>}
      {!rows.length && <div className="empty">Sin registros.</div>}
    </div>
  );
}

/* ---------- registrar o corregir a mano ---------- */
function EditLog({ edit, setEdit, people, teachers, subjects, pById, onSaved }) {
  const { notify } = useStore();
  const isNew = !edit.id;
  const set = (patch) => setEdit({ ...edit, ...patch });
  const minutes = edit.inTime && edit.outTime ? hmToMin(edit.outTime) - hmToMin(edit.inTime) : null;
  const isTeacher = edit.person_type === 'teacher';
  async function save() {
    try {
      if (!edit.person_name) return notify('Elige a la persona', 'bad');
      if (!edit.inTime || !edit.outTime) return notify('Pon la hora de entrada y de salida', 'bad');
      if (minutes <= 0) return notify('La salida debe ser después de la entrada', 'bad');
      const t = teachers.find((x) => String(x.id) === String(edit.teacher_id));
      const payload = {
        person_id: edit.person_id || null, person_name: edit.person_name, person_type: edit.person_type, day: edit.day,
        check_in: isoAt(edit.day, edit.inTime), check_out: isoAt(edit.day, edit.outTime), minutes,
        teacher_id: isTeacher ? null : (t?.id || null), teacher_name: isTeacher ? null : (t?.full_name || null),
        subject: edit.subject || null, topic: edit.topic || null, notes: edit.notes || null, reviewed: isNew ? 0 : 1,
      };
      const row = isNew ? await db.add('attendance_log', payload) : await db.update('attendance_log', edit.id, payload);
      onSaved(row, isNew);
    } catch (e) { notify(e.message, 'bad'); }
  }
  return (
    <Modal title={isNew ? 'Registrar asistencia a mano' : `Corregir · ${edit.person_name}`} onClose={() => setEdit(null)}
      footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <Select label={!edit.person_id && !isNew ? `Vincular «${edit.person_name}» a una persona` : 'Persona'} value={String(edit.person_id || '')}
        onChange={(v) => { const p = pById[v]; set(p ? { person_id: p.id, person_name: p.full_name, person_type: p.person_type } : { person_id: '' }); }}
        options={[{ value: '', label: isNew || edit.person_id ? 'Elige…' : `${edit.person_name} (no está en la lista)` }, ...people.filter((p) => ['student', 'teacher'].includes(p.person_type)).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((p) => ({ value: String(p.id), label: `${p.full_name}${p.person_type === 'teacher' ? ' · profesor' : ''}` }))]} />
      <div className="grid g3">
        <Text label="Día" type="date" value={edit.day} onChange={(v) => set({ day: v })} />
        <Text label="Entrada" type="time" value={edit.inTime} onChange={(v) => set({ inTime: v })} />
        <Text label="Salida" type="time" value={edit.outTime} onChange={(v) => set({ outTime: v })} />
      </div>
      {minutes > 0 && <div className="small muted">Tiempo: <b>{dur(minutes)}</b></div>}
      <div className="grid g2">
        {!isTeacher && <Select label="Profesor" value={String(edit.teacher_id || '')} onChange={(v) => set({ teacher_id: v })} options={[{ value: '', label: '—' }, ...teachers.map((t) => ({ value: String(t.id), label: t.full_name }))]} />}
        <Select label="Materia" value={edit.subject || ''} onChange={(v) => set({ subject: v })} options={[{ value: '', label: '—' }, ...subjects.map((s) => ({ value: s, label: s }))]} />
      </div>
      <Text label="Tema" value={edit.topic} onChange={(v) => set({ topic: v })} />
      <Text label="Notas" value={edit.notes} onChange={(v) => set({ notes: v })} placeholder="Ej.: corregido porque se equivocó de hora" />
    </Modal>
  );
}

/* ---------- enlace y opciones ---------- */
function KioskSettings({ cfg, setCfg }) {
  const { notify } = useStore();
  const [version, setVersion] = useState(undefined);
  const [qr, setQr] = useState('');
  const [subjectsText, setSubjectsText] = useState((cfg.subjects || DEFAULT_SUBJECTS).join('\n'));
  const link = cfg?.token ? `${location.origin}/firmar?k=${cfg.token}` : '';
  useEffect(() => { loadDoc('kiosk').then((r) => setVersion(r.version)).catch(() => setVersion(null)); }, []);
  useEffect(() => { if (link) QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#0b2a5b' } }).then(setQr); else setQr(''); }, [link]);
  const full = { active: false, token: '', needSignature: false, maxHours: 6, minMinutes: 15, graceMinutes: 90, classOpenBefore: 30, title: 'For Winners', ...cfg };
  async function save(next) {
    try {
      const r = await saveDoc('kiosk', next, version);
      setVersion(r.version);
      setCfg(next);
      notify('Guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }
  if (version === undefined) return <div className="empty">Cargando…</div>;
  const set = (patch) => save({ ...full, ...patch });
  const copy = async () => { try { await navigator.clipboard.writeText(link); notify('Enlace copiado'); } catch { notify('No se pudo copiar', 'bad'); } };
  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-h"><h2 className="grow">Enlace de asistencia individual</h2><span className={`chip ${full.active && full.token ? 'tag-ok' : 'tag-mut'}`}>{full.active && full.token ? 'Activo' : 'Desactivado'}</span></div>
        {!full.token ? (
          <>
            <p className="muted">Crea el enlace para que cada estudiante registre su asistencia al terminar la clase: nombre, 4 últimos dígitos del celular, horario, profesor, materia y tema.</p>
            <button className="btn primary" onClick={() => set({ token: token(), active: true })}><Link2 size={16} /> Crear enlace</button>
          </>
        ) : (
          <div className="col">
            <div className="linkbox"><span className="mono small">{link}</span></div>
            <div className="row">
              <button className="btn" onClick={copy}><Copy size={15} /> Copiar</button>
              <a className="btn" href={link} target="_blank" rel="noopener"><ExternalLink size={15} /> Abrir</a>
              <button className="btn ghost" onClick={() => confirm('El enlace actual dejará de funcionar. ¿Continuar?') && set({ token: token() })}><RefreshCw size={15} /> Cambiar enlace</button>
            </div>
            {qr && <img src={qr} alt="Código QR del enlace de asistencia" className="qr" />}
            <p className="small muted">Pega este QR en recepción o en las aulas. Para grupos grandes usa mejor una <b>clase grupal</b>: tiene su propio QR con el horario fijado.</p>
            <CheckBox label="Enlace activo" checked={full.active} onChange={(v) => set({ active: v })} />
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-h"><h2>Reglas</h2></div>
        <div className="col">
          <div className="alert info small"><Clock size={16} /> La fecha y la hora la pone el servidor. Siempre se piden los 4 últimos dígitos del celular: si no coinciden, no se registra.</div>
          <CheckBox label="Pedir firma en pantalla" checked={full.needSignature} onChange={(v) => set({ needSignature: v })} />
          <div className="grid g2">
            <Num label="Registrar hasta (min) después de la salida" value={full.graceMinutes} min={10} max={240} onChange={(v) => setCfg({ ...full, graceMinutes: v })} onBlur={() => save(full)} />
            <Num label="Clase grupal: abrir (min) antes del fin" value={full.classOpenBefore} min={0} max={240} onChange={(v) => setCfg({ ...full, classOpenBefore: v })} onBlur={() => save(full)} />
            <Num label="Duración mínima (min)" value={full.minMinutes} min={5} max={120} onChange={(v) => setCfg({ ...full, minMinutes: v })} onBlur={() => save(full)} />
            <Num label="Duración máxima (horas)" value={full.maxHours} min={1} max={12} onChange={(v) => setCfg({ ...full, maxHours: v })} onBlur={() => save(full)} />
          </div>
          <Text label="Materias (una por línea)" area rows={6} value={subjectsText} onChange={setSubjectsText} onBlur={() => save({ ...full, subjects: subjectsText.split('\n').map((s) => s.trim()).filter(Boolean) })} />
          <Text label="Título en la página" value={full.title} onChange={(v) => setCfg({ ...full, title: v })} onBlur={() => save(full)} />
        </div>
      </div>
    </div>
  );
}

