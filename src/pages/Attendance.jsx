import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Plus, LogOut as LogOutIcon, Pencil, Trash2, Copy, RefreshCw, Download, Link2, Search, Signature as PenLine, UserCheck, Clock, AlertTriangle, ExternalLink, Timer,
} from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db, signatures, loadDoc, saveDoc } from '../lib/backend';
import { byId, today, addDays, startOfWeek, fmtDate, dur, hoursNum, clock, minutesBetween } from '../lib/people';
import { Modal, PageHead, Seg, Text, Num, Select, Check, Kpi, Field } from '../components/ui';

const TYPES = { student: 'Estudiante', teacher: 'Profesor', other: 'No está en la lista' };
const monthStart = (iso = today()) => `${iso.slice(0, 7)}-01`;
const prevMonth = () => { const d = new Date(`${monthStart()}T12:00:00`); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('en-CA'); };
const endOfMonth = (iso) => { const d = new Date(`${iso.slice(0, 7)}-01T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toLocaleDateString('en-CA'); };
const toLocalInput = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
const fromLocal = (day, hhmm) => (day && hhmm ? new Date(`${day}T${hhmm}:00`).toISOString() : null);
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);

export default function Attendance() {
  const { notify } = useStore();
  const [tab, setTab] = useState('hoy');
  const [range, setRange] = useState({ since: addDays(today(), -120) });
  const logs = useTable('attendance_log', [], range);
  const people = useTable('people');
  const [edit, setEdit] = useState(null);
  const [sig, setSig] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  // Se actualiza sola: cada 30 s y al volver a esta pestaña.
  useEffect(() => {
    const tick = () => { setNowTick(Date.now()); if (document.visibilityState === 'visible') logs.reload(); };
    const t = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [logs.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = today();
  const all = logs.rows || [];
  const todays = all.filter((l) => l.day === t).sort((a, b) => b.check_in.localeCompare(a.check_in));
  const inside = todays.filter((l) => !l.check_out);
  const forgotten = all.filter((l) => !l.check_out && l.day < t);
  const monthMin = all.filter((l) => l.day >= monthStart() && l.person_type === 'student').reduce((a, l) => a + (l.minutes || 0), 0);
  const pById = byId(people.rows);

  async function closeNow(l) {
    const now = new Date().toISOString();
    const row = await db.update('attendance_log', l.id, { check_out: now, minutes: minutesBetween(l.check_in, now) });
    logs.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
    notify(`Salida registrada para ${l.person_name}`);
  }
  async function remove(l) {
    if (!confirm(`¿Borrar el registro de ${l.person_name} del ${fmtDate(l.day)}?`)) return;
    try {
      await db.remove('attendance_log', l.id);
      logs.setRows((rs) => rs.filter((x) => x.id !== l.id));
      notify('Registro borrado');
    } catch (e) { notify(`No se pudo borrar: ${e.message}`, 'bad'); }
  }
  async function showSig(l) {
    try { setSig({ log: l, ...(await signatures(l.id)) }); } catch (e) { notify(e.message, 'bad'); }
  }

  if (logs.error) return <div className="alert bad">{logs.error}</div>;
  const rowActions = (l) => (
    <div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
      {(l.has_sign_in || l.has_sign_out) ? <button className="btn sm ghost icon" title="Ver firmas" onClick={() => showSig(l)}><PenLine size={14} /></button> : null}
      {!l.check_out && <button className="btn sm" onClick={() => closeNow(l)} title="Registrar salida ahora"><LogOutIcon size={13} /> Salida</button>}
      <button className="btn sm ghost icon" title="Editar" onClick={() => setEdit({ ...l, inTime: toLocalInput(l.check_in), outTime: toLocalInput(l.check_out) })}><Pencil size={14} /></button>
      <button className="btn sm ghost icon danger" title="Borrar" onClick={() => remove(l)}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <>
      <PageHead title="Asistencia" desc="Cada persona firma su entrada y su salida en el enlace de firma. Aquí ves quién está, cuántas horas asistió cada uno y sus firmas.">
        <button className="btn" onClick={() => setTab('enlace')}><Link2 size={16} /> Enlace de firma</button>
        <button className="btn primary" onClick={() => setEdit({ person_id: '', person_name: '', person_type: 'student', day: t, inTime: new Date().toTimeString().slice(0, 5), outTime: '', notes: '' })}><Plus size={16} /> Registrar a mano</button>
      </PageHead>

      <div className="grid g4 kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={UserCheck} label="Dentro ahora" value={inside.length} sub={inside.slice(0, 3).map((l) => l.person_name.split(' ')[0]).join(', ') || 'Nadie'} tone="ok" />
        <Kpi icon={Clock} label="Asistieron hoy" value={new Set(todays.map((l) => l.person_id || l.person_name)).size} sub={`${todays.length} registros`} />
        <Kpi icon={Timer} label="Horas de estudiantes este mes" value={`${hoursNum(monthMin)} h`} sub="Suma de entradas y salidas" />
        <Kpi icon={AlertTriangle} label="Salidas sin registrar" value={forgotten.length} sub={forgotten.length ? 'De días anteriores' : 'Todo en orden'} tone={forgotten.length ? 'warn' : undefined} />
      </div>

      <div className="tabs">
        <Seg value={tab} onChange={setTab} options={[
          { value: 'hoy', label: 'Hoy' }, { value: 'personas', label: 'Horas por persona' }, { value: 'registro', label: 'Registro completo' }, { value: 'enlace', label: 'Enlace de firma' },
        ]} />
      </div>

      {!logs.rows && tab !== 'enlace' && <div className="empty">Cargando…</div>}

      {logs.rows && tab === 'hoy' && (
        <>
          {forgotten.length > 0 && (
            <div className="alert warn" style={{ marginBottom: 14 }}>
              <AlertTriangle size={18} />
              <div className="grow">
                <b>{forgotten.length} persona{forgotten.length > 1 ? 's' : ''} no registr{forgotten.length > 1 ? 'aron' : 'ó'} su salida</b> en días anteriores. Esas visitas no suman horas hasta que pongas la hora de salida.
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  {forgotten.slice(0, 6).map((l) => <button key={l.id} className="btn sm" onClick={() => setEdit({ ...l, inTime: toLocalInput(l.check_in), outTime: '' })}>{l.person_name} · {fmtDate(l.day)}</button>)}
                </div>
              </div>
            </div>
          )}
          <div className="card table-wrap">
            <table className="t">
              <thead><tr><th>Persona</th><th>Entrada</th><th>Salida</th><th className="num">Tiempo</th><th /></tr></thead>
              <tbody>
                {todays.map((l) => (
                  <tr key={l.id}>
                    <td><Person l={l} /></td>
                    <td className="mono">{clock(l.check_in)}</td>
                    <td>{l.check_out ? <span className="mono">{clock(l.check_out)}</span> : <span className="chip tag-ok"><span className="pulse" /> Dentro</span>}</td>
                    <td className="num">{dur(l.check_out ? l.minutes : minutesBetween(l.check_in, new Date(nowTick).toISOString()))}</td>
                    <td>{rowActions(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!todays.length && <div className="empty">Nadie ha firmado hoy todavía. Comparte el <button className="linkish" onClick={() => setTab('enlace')}>enlace de firma</button> o ponlo en una tablet en recepción.</div>}
          </div>
        </>
      )}

      {logs.rows && tab === 'personas' && <ByPerson logs={all} people={people.rows || []} range={range} setRange={setRange} onSig={showSig} onEdit={(l) => setEdit({ ...l, inTime: toLocalInput(l.check_in), outTime: toLocalInput(l.check_out) })} />}
      {logs.rows && tab === 'registro' && <FullLog logs={all} range={range} setRange={setRange} actions={rowActions} />}
      {tab === 'enlace' && <KioskSettings />}

      {edit && <EditLog edit={edit} setEdit={setEdit} people={(people.rows || []).filter((p) => p.status === 'active')} pById={pById} onSaved={(row, isNew) => {
        logs.setRows((rs) => (isNew ? [row, ...rs] : rs.map((x) => (x.id === row.id ? row : x))));
        setEdit(null);
        notify('Asistencia guardada');
      }} />}

      {sig && (
        <Modal title={`Firmas · ${sig.log.person_name}`} onClose={() => setSig(null)}>
          <div className="small muted">{fmtDate(sig.log.day)} · entrada {clock(sig.log.check_in)}{sig.log.check_out ? ` · salida ${clock(sig.log.check_out)}` : ''}</div>
          <div className="grid g2">
            <Field label="Firma de entrada">{sig.sign_in ? <img className="sig-img" src={sig.sign_in} alt="Firma de entrada" /> : <span className="muted small">Sin firma</span>}</Field>
            <Field label="Firma de salida">{sig.sign_out ? <img className="sig-img" src={sig.sign_out} alt="Firma de salida" /> : <span className="muted small">Sin firma</span>}</Field>
          </div>
        </Modal>
      )}
    </>
  );
}

function Person({ l }) {
  return (
    <div className="person">
      <span className="avatar">{l.person_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
      <div>
        <b>{l.person_name}</b>
        <div className="small muted">
          {TYPES[l.person_type] || l.person_type}
          {l.source === 'manual' && ' · registrado a mano'}
          {!l.person_id && <span className="chip tag-warn" style={{ marginLeft: 6 }}>Vincular</span>}
        </div>
      </div>
    </div>
  );
}

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
      <Seg value={value.key} onChange={(k) => { const o = opts.find((x) => x.value === k); onChange({ key: k, from: o.from, to: o.to }); }} options={[...opts, { value: 'custom', label: 'Otras fechas' }]} />
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

function usePeriod(range, setRange) {
  const [period, setPeriod] = useState({ key: 'month', from: monthStart(), to: today() });
  useEffect(() => { if (period.from < range.since) setRange({ since: period.from }); }, [period.from]); // eslint-disable-line react-hooks/exhaustive-deps
  return [period, setPeriod];
}

async function exportXlsx(name, rows) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Asistencia');
  XLSX.writeFile(wb, name);
}

function ByPerson({ logs, people, range, setRange, onSig, onEdit }) {
  const [period, setPeriod] = usePeriod(range, setRange);
  const [type, setType] = useState('student');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const inPeriod = logs.filter((l) => l.day >= period.from && l.day <= period.to);
  const rows = useMemo(() => {
    const m = new Map();
    for (const l of inPeriod) {
      if (type !== 'all' && l.person_type !== type) continue;
      const k = l.person_id ? `p${l.person_id}` : `n${l.person_name}`;
      const r = m.get(k) || { key: k, name: l.person_name, type: l.person_type, minutes: 0, days: new Set(), visits: 0, open: 0, last: '' };
      r.minutes += l.minutes || 0;
      r.days.add(l.day);
      r.visits++;
      if (!l.check_out) r.open++;
      if (l.day > r.last) r.last = l.day;
      m.set(k, r);
    }
    // Estudiantes activos que no vinieron en el período
    if (type !== 'teacher') for (const p of people) if (p.person_type === 'student' && p.status === 'active' && !m.has(`p${p.id}`)) m.set(`p${p.id}`, { key: `p${p.id}`, name: p.full_name, type: 'student', minutes: 0, days: new Set(), visits: 0, open: 0, last: '' });
    return [...m.values()].filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  }, [inPeriod, people, type, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(60, ...rows.map((r) => r.minutes));
  const detail = open && inPeriod.filter((l) => (l.person_id ? `p${l.person_id}` : `n${l.person_name}`) === open.key).sort((a, b) => b.check_in.localeCompare(a.check_in));

  return (
    <div className="card table-wrap">
      <div className="card-h">
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Seg value={type} onChange={setType} options={[{ value: 'student', label: 'Estudiantes' }, { value: 'teacher', label: 'Profesores' }, { value: 'other', label: 'No están en la lista' }, { value: 'all', label: 'Todos' }]} />
        <div className="search grow" style={{ maxWidth: 320 }}><Search size={15} /><input placeholder="Buscar persona…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className="btn right" onClick={() => exportXlsx(`Asistencia-${period.from}-a-${period.to}.xlsx`, rows.map((r) => ({ Persona: r.name, Tipo: TYPES[r.type], 'Días asistidos': r.days.size, Visitas: r.visits, Horas: hoursNum(r.minutes), 'Última asistencia': r.last })))}><Download size={15} /> Excel</button>
      </div>
      <table className="t">
        <thead><tr><th>Persona</th><th className="num">Días</th><th className="num">Horas</th><th style={{ width: '28%' }} /><th>Última vez</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
              <td><b>{r.name}</b>{r.open > 0 && <span className="chip tag-warn" style={{ marginLeft: 6 }}>{r.open} sin salida</span>}</td>
              <td className="num">{r.days.size}</td>
              <td className="num"><b>{hoursNum(r.minutes)} h</b></td>
              <td><div className="bar"><div style={{ width: `${(r.minutes / max) * 100}%`, background: r.minutes ? 'var(--accent)' : 'transparent' }} /></div></td>
              <td className="small muted">{r.last ? fmtDate(r.last) : <span className="chip tag-bad">No vino</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty">Sin asistencias en este período.</div>}

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} wide>
          <div className="grid g3 kpis">
            <Kpi label="Horas" value={`${hoursNum(open.minutes)} h`} />
            <Kpi label="Días asistidos" value={open.days.size} />
            <Kpi label="Promedio por día" value={open.days.size ? dur(open.minutes / open.days.size) : '—'} />
          </div>
          <table className="t">
            <thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th className="num">Tiempo</th><th /></tr></thead>
            <tbody>
              {detail.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.day)}</td>
                  <td className="mono">{clock(l.check_in)}</td>
                  <td className="mono">{l.check_out ? clock(l.check_out) : <span className="chip tag-warn">Sin salida</span>}</td>
                  <td className="num">{dur(l.minutes)}</td>
                  <td><div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                    {(l.has_sign_in || l.has_sign_out) ? <button className="btn sm ghost icon" onClick={() => onSig(l)} title="Ver firmas"><PenLine size={14} /></button> : null}
                    <button className="btn sm ghost icon" onClick={() => { setOpen(null); onEdit(l); }} title="Editar"><Pencil size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!detail.length && <div className="empty">No asistió en este período.</div>}
        </Modal>
      )}
    </div>
  );
}

function FullLog({ logs, range, setRange, actions }) {
  const [period, setPeriod] = usePeriod(range, setRange);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState('');
  const rows = logs.filter((l) => l.day >= period.from && l.day <= period.to && (!onlyOpen || !l.check_out) && (!q || l.person_name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.check_in.localeCompare(a.check_in));
  return (
    <div className="card table-wrap">
      <div className="card-h"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="search grow" style={{ maxWidth: 320 }}><Search size={15} /><input placeholder="Buscar persona…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Check label="Solo sin salida" checked={onlyOpen} onChange={setOnlyOpen} />
        <button className="btn right" onClick={() => exportXlsx(`Registro-asistencia-${period.from}-a-${period.to}.xlsx`, rows.map((l) => ({ Día: l.day, Persona: l.person_name, Tipo: TYPES[l.person_type], Entrada: clock(l.check_in), Salida: l.check_out ? clock(l.check_out) : '', Minutos: l.minutes || 0, Origen: l.source === 'manual' ? `A mano (${l.created_by || ''})` : 'Firma', Notas: l.notes || '' })))}><Download size={15} /> Excel</button>
      </div>
      <table className="t">
        <thead><tr><th>Día</th><th>Persona</th><th>Entrada</th><th>Salida</th><th className="num">Tiempo</th><th>Origen</th><th /></tr></thead>
        <tbody>
          {rows.slice(0, 500).map((l) => (
            <tr key={l.id}>
              <td className="small">{fmtDate(l.day)}</td>
              <td><b>{l.person_name}</b>{!l.person_id && <span className="chip tag-warn" style={{ marginLeft: 6 }}>Vincular</span>}</td>
              <td className="mono">{clock(l.check_in)}</td>
              <td className="mono">{l.check_out ? clock(l.check_out) : <span className="chip tag-warn">Sin salida</span>}</td>
              <td className="num">{dur(l.minutes)}</td>
              <td className="small muted">{l.source === 'manual' ? `A mano · ${l.created_by || ''}` : (l.has_sign_in ? 'Firma' : 'Enlace')}</td>
              <td>{actions(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 500 && <div className="small muted" style={{ marginTop: 8 }}>Mostrando 500 de {rows.length}. Descarga el Excel para verlos todos.</div>}
      {!rows.length && <div className="empty">Sin registros.</div>}
    </div>
  );
}

function EditLog({ edit, setEdit, people, pById, onSaved }) {
  const { notify } = useStore();
  const isNew = !edit.id;
  const set = (patch) => setEdit({ ...edit, ...patch });
  const minutes = edit.outTime ? minutesBetween(fromLocal(edit.day, edit.inTime), fromLocal(edit.day, edit.outTime)) : null;
  async function save() {
    try {
      if (!edit.person_name) return notify('Elige a la persona', 'bad');
      if (!edit.inTime) return notify('Pon la hora de entrada', 'bad');
      if (edit.outTime && edit.outTime <= edit.inTime) return notify('La salida debe ser después de la entrada', 'bad');
      const payload = {
        person_id: edit.person_id || null, person_name: edit.person_name, person_type: edit.person_type, day: edit.day,
        check_in: fromLocal(edit.day, edit.inTime), check_out: edit.outTime ? fromLocal(edit.day, edit.outTime) : null,
        minutes: edit.outTime ? minutes : null, notes: edit.notes || null,
      };
      const row = isNew ? await db.add('attendance_log', payload) : await db.update('attendance_log', edit.id, payload);
      onSaved(row, isNew);
    } catch (e) { notify(e.message, 'bad'); }
  }
  return (
    <Modal title={isNew ? 'Registrar asistencia a mano' : `Editar asistencia · ${edit.person_name}`} onClose={() => setEdit(null)}
      footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={save}>Guardar</button></>}>
      <Select label={!edit.person_id && !isNew ? `Vincular «${edit.person_name}» a una persona de la lista` : 'Persona'} value={String(edit.person_id || '')}
        onChange={(v) => { const p = pById[v]; set(p ? { person_id: p.id, person_name: p.full_name, person_type: p.person_type } : { person_id: '' }); }}
        options={[{ value: '', label: isNew ? 'Elige…' : (edit.person_id ? 'Elige…' : `${edit.person_name} (no está en la lista)`) }, ...people.filter((p) => ['student', 'teacher'].includes(p.person_type)).sort((a, b) => a.full_name.localeCompare(b.full_name)).map((p) => ({ value: String(p.id), label: `${p.full_name}${p.person_type === 'teacher' ? ' · profesor' : ''}` }))]} />
      <div className="grid g3">
        <Text label="Día" type="date" value={edit.day} onChange={(v) => set({ day: v })} />
        <Text label="Entrada" type="time" value={edit.inTime} onChange={(v) => set({ inTime: v })} />
        <Text label="Salida" type="time" value={edit.outTime} onChange={(v) => set({ outTime: v })} />
      </div>
      {minutes != null && <div className="small muted">Tiempo: <b>{dur(minutes)}</b></div>}
      <Text label="Notas" value={edit.notes} onChange={(v) => set({ notes: v })} placeholder="Ej.: olvidó firmar la salida" />
    </Modal>
  );
}

function KioskSettings() {
  const { notify } = useStore();
  const [cfg, setCfg] = useState(null);
  const [version, setVersion] = useState(null);
  const [qr, setQr] = useState('');
  const link = cfg?.token ? `${location.origin}/firmar?k=${cfg.token}` : '';
  useEffect(() => {
    loadDoc('kiosk').then((r) => { setVersion(r.version); setCfg(kioskDefaults(r.value)); }).catch((e) => notify(e.message, 'bad'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (link) QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#0b2a5b' } }).then(setQr); else setQr(''); }, [link]);

  async function save(next) {
    try {
      const r = await saveDoc('kiosk', next, version);
      setVersion(r.version);
      setCfg(next);
      notify('Guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }
  if (!cfg) return <div className="empty">Cargando…</div>;
  const set = (patch) => save({ ...cfg, ...patch });
  const copy = async () => { try { await navigator.clipboard.writeText(link); notify('Enlace copiado'); } catch { notify('No se pudo copiar', 'bad'); } };

  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-h"><h2 className="grow">Enlace de firma</h2><span className={`chip ${cfg.active && cfg.token ? 'tag-ok' : 'tag-mut'}`}>{cfg.active && cfg.token ? 'Activo' : 'Desactivado'}</span></div>
        {!cfg.token ? (
          <>
            <p className="muted">Crea el enlace para que los estudiantes y profesores firmen su entrada y salida desde una tablet en recepción o desde su celular.</p>
            <button className="btn primary" onClick={() => set({ token: token(), active: true })}><Link2 size={16} /> Crear enlace de firma</button>
          </>
        ) : (
          <div className="col">
            <div className="linkbox"><span className="mono small">{link}</span></div>
            <div className="row">
              <button className="btn" onClick={copy}><Copy size={15} /> Copiar</button>
              <a className="btn" href={link} target="_blank" rel="noopener"><ExternalLink size={15} /> Abrir</a>
              <button className="btn ghost" onClick={() => confirm('El enlace actual dejará de funcionar y tendrás que compartir el nuevo. ¿Continuar?') && set({ token: token() })}><RefreshCw size={15} /> Cambiar enlace</button>
            </div>
            {qr && <img src={qr} alt="Código QR del enlace de firma" className="qr" />}
            <p className="small muted">Imprime el código QR y pégalo en recepción, o abre el enlace en una tablet y déjala ahí: vuelve sola al inicio después de cada firma.</p>
            <Check label="Enlace activo" checked={cfg.active} onChange={(v) => set({ active: v })} />
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-h"><h2>Opciones</h2></div>
        <div className="col">
          <Check label="Pedir firma en pantalla" checked={cfg.needSignature} onChange={(v) => set({ needSignature: v })} />
          <Check label="Pedir los últimos 4 dígitos del celular (evita que alguien firme por otro)" checked={cfg.needPhone} onChange={(v) => set({ needPhone: v })} />
          <Check label="Permitir registrarse a quien no está en la lista" checked={cfg.allowUnknown} onChange={(v) => set({ allowUnknown: v })} />
          <Num label="Máximo de horas por visita" hint="Si alguien olvida firmar la salida, la visita no suma más que esto." value={cfg.maxHours} min={1} max={14} onChange={(v) => setCfg({ ...cfg, maxHours: v })} onBlur={() => save(cfg)} />
          <Text label="Título en la página de firma" value={cfg.title} onChange={(v) => setCfg({ ...cfg, title: v })} onBlur={() => save(cfg)} />
          <p className="small muted">Cada firma guarda la hora, la firma y el equipo desde donde se hizo. Quienes no están en la lista aparecen marcados «Vincular» para que los asocies a un estudiante.</p>
        </div>
      </div>
    </div>
  );
}

/** Opciones del enlace. Si se guardaron con la versión de «solo salida», se vuelve a pedir firma y dígitos. */
function kioskDefaults(v = {}) {
  const old = v && 'graceMinutes' in v && !('needPhone' in v);
  return { active: false, token: '', needPhone: true, needSignature: true, allowUnknown: false, maxHours: 8, title: 'For Winners', ...(v || {}), ...(old ? { needPhone: true, needSignature: true, allowUnknown: false, maxHours: 8 } : {}) };
}
