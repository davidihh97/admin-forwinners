import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { spaceStats, findConflicts, categoryHours, allCourses } from '../lib/calc';
import { DAYS, todayName, toMin, fmtH, fmtPct, pretty } from '../lib/time';
import { Kpi, PageHead, Bar, occTag } from '../components/ui';

export default function Dashboard({ go }) {
  const { data } = useStore();
  const [day, setDay] = useState(todayName());
  const stats = useMemo(() => spaceStats(data), [data]);
  const conflicts = useMemo(() => findConflicts(data), [data]);
  const catH = useMemo(() => categoryHours(data), [data]);
  const courses = useMemo(() => allCourses(data), [data]);
  const cat = (id) => data.categories.find((c) => c.id === id) || { name: id, color: '#94a3b8' };
  const space = (id) => data.spaces.find((s) => s.id === id)?.name || id;

  const totalH = Object.values(catH).reduce((a, b) => a + b, 0);
  const avgOcc = stats.reduce((a, s) => a + s.occupancy, 0) / (stats.length || 1);
  const todays = data.schedule
    .filter((b) => b.day === day)
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  const progress = data.plans.map((p) => ({
    p,
    done: p.classes.filter((c) => c.done).length,
    total: p.classes.length,
  }));

  return (
    <>
      <PageHead title="Inicio" desc="Resumen de For Winners: espacios, horario y avance de los cursos." />

      <div className="grid g4 kpis">
        <Kpi label="Horas de clase por semana" value={fmtH(totalH)} sub={`${data.schedule.length} bloques en el horario`} />
        <Kpi label="Ocupación promedio" value={fmtPct(avgOcc)} sub={`${data.spaces.length} espacios`} />
        <Kpi label="Cursos y rutas" value={courses.length} sub={`${data.modules.length} módulos UTN`} />
        <Kpi
          label="Choques de horario"
          value={conflicts.size}
          sub={conflicts.size ? 'Revisa el horario' : 'Todo en orden'}
        />
      </div>

      {conflicts.size > 0 && (
        <div className="alert warn" style={{ marginTop: 16 }}>
          <AlertTriangle size={18} />
          <div>
            Hay {conflicts.size} bloques con problemas (se cruzan o están fuera del horario de atención).{' '}
            <a href="#/horario" onClick={() => go('horario')}>Ver en el horario</a>
          </div>
        </div>
      )}

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h2 className="grow">Clases del día</h2>
            <select className="input" style={{ width: 'auto' }} value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}{d === todayName() ? ' (hoy)' : ''}</option>)}
            </select>
          </div>
          {todays.length === 0 && <div className="empty">No hay clases este día.</div>}
          <table className="t">
            <tbody>
              {todays.map((b) => (
                <tr key={b.id}>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{pretty(b.start)}–{pretty(b.end)}</td>
                  <td>
                    <span className="dot" style={{ background: cat(b.categoryId).color, marginRight: 8 }} />
                    {b.service}
                    {conflicts.has(b.id) && <AlertTriangle size={14} color="#dc2626" style={{ marginLeft: 6 }} />}
                  </td>
                  <td className="muted small">{space(b.spaceId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-h"><h2>Ocupación de espacios</h2></div>
            <div className="col" style={{ gap: 14 }}>
              {stats.map((s) => (
                <div key={s.space.id}>
                  <div className="row" style={{ marginBottom: 5 }}>
                    <b>{s.space.name}</b>
                    <span className="muted small">cap. {s.space.capacity}</span>
                    <span className={`chip right ${occTag(s.occupancy)}`}>{fmtPct(s.occupancy)}</span>
                    <span className="muted small mono">{fmtH(s.used)} / {fmtH(s.avail)}</span>
                  </div>
                  <Bar
                    max={s.avail}
                    parts={Object.entries(s.byCat).map(([id, h]) => ({ value: h, color: cat(id).color, title: `${cat(id).name}: ${fmtH(h)}` }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h2>Horas por categoría</h2></div>
            <div className="col" style={{ gap: 8 }}>
              {data.categories.map((c) => (
                <div key={c.id} className="row">
                  <span className="dot" style={{ background: c.color }} />
                  <span className="grow">{c.name}</span>
                  <span className="mono">{fmtH(catH[c.id] || 0)}</span>
                  <div style={{ width: 120 }}>
                    <Bar max={totalH} parts={[{ value: catH[c.id] || 0, color: c.color }]} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h2 className="grow">Avance de los planes de clase</h2>
          <button className="btn sm" onClick={() => go('temas')}>Abrir plan de clases</button>
        </div>
        <div className="grid g3">
          {progress.map(({ p, done, total }) => (
            <div key={p.id} className="sub-card">
              <div className="row">
                <b className="grow">{p.name}</b>
                {done === total && total > 0 && <CheckCircle2 size={16} color="#059669" />}
              </div>
              <Bar max={total || 1} parts={[{ value: done, color: '#059669' }]} />
              <span className="small muted">{done} de {total} clases dictadas · {fmtH(p.classes.filter((c) => c.done).reduce((a, c) => a + c.hours, 0))}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
