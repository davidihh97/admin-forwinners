import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTable } from '../lib/store';
import { addDays, today } from '../lib/people';
import { PageHead, Seg } from '../components/ui';

const ACTIONS = { crear: 'creó', editar: 'editó', borrar: 'borró', publicar: 'publicó', ingresar: 'ingresó al panel' };
const ENTITY = {
  people: 'persona', courses: 'curso', course_groups: 'curso', enrollments: 'inscripción', payments: 'pago', exam_scores: 'nota',
  inquiries: 'interesado', teacher_payouts: 'pago a profesor', attendance_log: 'asistencia', expenses: 'gasto',
  operations: 'horario y cursos', site_published: 'la página web', kiosk: 'el enlace de firma', admin_users: 'usuario',
};
const TONE = { crear: 'tag-ok', editar: 'tag-info', borrar: 'tag-bad', publicar: 'tag-warn', ingresar: 'tag-mut' };
const when = (s) => new Date(`${String(s).replace(' ', 'T')}Z`);

export default function Activity() {
  const [days, setDays] = useState('7');
  const logs = useTable('audit_log', [], { since: addDays(today(), -Number(days)).concat(' 00:00:00') });
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const rows = logs.rows || [];
  const users = [...new Set(rows.map((r) => r.username).filter(Boolean))];
  const shown = rows.filter((r) => (!who || r.username === who) && (!q || `${r.summary} ${ENTITY[r.entity]} ${r.username}`.toLowerCase().includes(q.toLowerCase())));
  const grouped = useMemo(() => {
    const m = new Map();
    for (const r of shown) {
      const d = when(r.at).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
      m.set(d, [...(m.get(d) || []), r]);
    }
    return [...m.entries()];
  }, [shown]);

  if (logs.error) return <div className="alert bad">{logs.error}</div>;
  return (
    <>
      <PageHead title="Actividad" desc="Todo lo que se hace en el panel: quién, qué y cuándo. Solo lo ve el administrador." />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <Seg value={days} onChange={setDays} options={[{ value: '1', label: 'Hoy' }, { value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: '90', label: '90 días' }]} />
          <select className="input" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Persona">
            <option value="">Todo el equipo</option>
            {users.map((u) => <option key={u}>{u}</option>)}
          </select>
          <div className="search grow" style={{ maxWidth: 320 }}><Search size={15} /><input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
      </div>
      {!logs.rows && <div className="empty">Cargando…</div>}
      {grouped.map(([day, list]) => (
        <div key={day} className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><h2 style={{ textTransform: 'capitalize' }}>{day}</h2></div>
          <div className="timeline">
            {list.map((r) => (
              <div key={r.id} className="tl-row">
                <span className="mono small muted tl-time">{when(r.at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`chip ${TONE[r.action] || 'tag-mut'}`}>{r.action}</span>
                <span className="grow"><b>{r.username || 'sistema'}</b> {ACTIONS[r.action] || r.action}{r.action !== 'ingresar' && <> {ENTITY[r.entity] || r.entity}</>}{r.summary && r.action !== 'ingresar' ? <span className="muted">: {r.summary}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {logs.rows && !shown.length && <div className="card empty">Sin actividad en este período.</div>}
    </>
  );
}
