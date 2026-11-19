import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, CalendarDays } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { STATUS, STATUS_TAG, byId, fmtDate, today } from '../lib/people';
import { PageHead, Select, Text, Kpi } from '../components/ui';

const MARKS = ['present', 'late', 'absent', 'excused'];
const SHORT = { present: 'Asistió', late: 'Atraso', absent: 'Faltó', excused: 'Justif.' };

export default function Attendance() {
  const { data, notify } = useStore();
  const groups = useTable('course_groups');
  const people = useTable('people');
  const enr = useTable('enrollments');
  const sessions = useTable('class_sessions');
  const att = useTable('attendance');
  const [groupId, setGroupId] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [marks, setMarks] = useState({});
  const [newS, setNewS] = useState(null);
  const pById = byId(people.rows);
  const open = (groups.rows || []).filter((g) => ['planned', 'active'].includes(g.status));

  useEffect(() => { if (!groupId && open[0]) setGroupId(String(open[0].id)); }, [open.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = (groups.rows || []).find((x) => String(x.id) === groupId);
  const students = (enr.rows || []).filter((e) => String(e.group_id) === groupId && e.status === 'active').map((e) => pById[e.student_id]).filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const gSessions = (sessions.rows || []).filter((s) => String(s.group_id) === groupId).sort((a, b) => b.session_date.localeCompare(a.session_date));
  const sess = gSessions.find((s) => s.id === sessionId);

  useEffect(() => {
    const m = {};
    for (const a of att.rows || []) if (a.session_id === sessionId) m[a.student_id] = a.status;
    setMarks(m);
  }, [sessionId, att.rows]);

  // Tema sugerido: la clase del plan que toca según la semana del grupo.
  const suggest = (date) => {
    const plan = data.plans.find((p) => p.id === g?.plan_id);
    if (!plan || !g?.start_date) return '';
    const week = Math.floor((new Date(`${date}T12:00:00`) - new Date(`${g.start_date}T12:00:00`)) / (7 * 86400000)) + 1;
    const day = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(`${date}T12:00:00`).getDay()];
    return plan.classes.filter((c) => c.week === week && c.day === day).map((c) => `${c.module}: ${c.content}`).join(' · ');
  };

  const pct = useMemo(() => {
    const m = {};
    const ids = new Set(gSessions.map((s) => s.id));
    for (const a of att.rows || []) {
      if (!ids.has(a.session_id)) continue;
      m[a.student_id] ||= [0, 0];
      m[a.student_id][1]++;
      if (a.status !== 'absent') m[a.student_id][0]++;
    }
    return m;
  }, [att.rows, gSessions]);

  async function createSession() {
    try {
      const row = await db.add('class_sessions', { group_id: Number(groupId), session_date: newS.date, start_time: newS.start, end_time: newS.end, topic: newS.topic, teacher_id: g?.teacher_id || null });
      sessions.setRows((rs) => [row, ...rs]);
      setSessionId(row.id);
      setNewS(null);
    } catch (e) { notify(e.message, 'bad'); }
  }
  async function saveMarks() {
    const rows = students.map((s) => ({ session_id: sessionId, student_id: s.id, status: marks[s.id] || 'present' }));
    try {
      await db.addMany('attendance', rows);
      att.reload();
      notify('Asistencia guardada');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (groups.error) return <div className="alert bad">{groups.error}</div>;
  if (!groups.rows || !people.rows) return <div className="empty">Cargando…</div>;
  if (!open.length) return <><PageHead title="Asistencia" /><div className="card empty">Primero crea un grupo en la sección Grupos.</div></>;

  return (
    <>
      <PageHead title="Asistencia" desc="Pasa lista en cada clase. El tema sugerido sale del plan de clases del grupo." />
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <div style={{ minWidth: 260 }}><Select label="Grupo" value={groupId} onChange={(v) => { setGroupId(v); setSessionId(null); }} options={open.map((x) => ({ value: String(x.id), label: x.group_name }))} /></div>
          <button className="btn primary right" onClick={() => { const d = today(); setNewS({ date: d, start: '', end: '', topic: suggest(d) }); }}><Plus size={16} /> Pasar lista hoy</button>
        </div>
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)' }}>
        <div className="card">
          <div className="card-h"><CalendarDays size={16} /><h2>Clases</h2></div>
          <div className="col" style={{ gap: 2 }}>
            {gSessions.map((s) => (
              <div key={s.id} className={`sec-item ${s.id === sessionId ? 'on' : ''}`} onClick={() => setSessionId(s.id)}>
                <span className="grow"><b>{fmtDate(s.session_date)}</b>{s.topic && <div className="small muted clamp2">{s.topic}</div>}</span>
              </div>
            ))}
            {!gSessions.length && <div className="small muted">Aún no hay clases registradas.</div>}
          </div>
        </div>

        <div className="card">
          {newS ? (
            <>
              <div className="card-h"><h2>Nueva clase</h2></div>
              <div className="grid g3">
                <Text label="Fecha" type="date" value={newS.date} onChange={(v) => setNewS({ ...newS, date: v, topic: suggest(v) || newS.topic })} />
                <Text label="Inicio" type="time" value={newS.start} onChange={(v) => setNewS({ ...newS, start: v })} />
                <Text label="Fin" type="time" value={newS.end} onChange={(v) => setNewS({ ...newS, end: v })} />
              </div>
              <Text label="Tema de la clase" area rows={2} value={newS.topic} onChange={(v) => setNewS({ ...newS, topic: v })} />
              <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={() => setNewS(null)}>Cancelar</button><button className="btn primary" onClick={createSession}>Crear y pasar lista</button></div>
            </>
          ) : sess ? (
            <>
              <div className="card-h">
                <h2 className="grow">{fmtDate(sess.session_date)}</h2>
                <button className="btn sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, 'present'])))}>Todos asistieron</button>
                <button className="btn primary" onClick={saveMarks}><Save size={15} /> Guardar</button>
              </div>
              {sess.topic && <p className="small muted" style={{ marginTop: -6 }}>{sess.topic}</p>}
              <div className="col">
                {students.map((s) => (
                  <div key={s.id} className="row" style={{ flexWrap: 'nowrap', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <span className="grow"><b>{s.full_name}</b> {pct[s.id] && <span className="small muted">· {Math.round((pct[s.id][0] / pct[s.id][1]) * 100)}% asistencia</span>}</span>
                    <div className="seg">
                      {MARKS.map((m) => (
                        <button key={m} className={(marks[s.id] || '') === m ? `on ${STATUS_TAG[m]}` : ''} onClick={() => setMarks({ ...marks, [s.id]: m })} title={STATUS.attendance[m]}>{SHORT[m]}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {!students.length && <div className="empty">Este grupo no tiene estudiantes activos.</div>}
              </div>
            </>
          ) : (
            <div className="grid g3">
              <Kpi label="Clases registradas" value={gSessions.length} />
              <Kpi label="Estudiantes" value={students.length} />
              <Kpi label="Asistencia promedio" value={Object.keys(pct).length ? `${Math.round((Object.values(pct).reduce((a, [x, y]) => a + x / y, 0) / Object.keys(pct).length) * 100)}%` : '—'} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
