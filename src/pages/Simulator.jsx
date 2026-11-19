import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { allCourses, profitability } from '../lib/calc';
import { fmtMoney, fmtPct, uid } from '../lib/time';
import { PageHead, Kpi } from '../components/ui';

/** "¿Qué pasa si…?": arma un escenario de grupos y mira ingresos, costo y ganancia. */
export default function Simulator() {
  const { data } = useStore();
  const courses = useMemo(() => allCourses(data), [data]);
  const [rows, setRows] = useState(() => [
    { id: uid('r'), courseId: courses.find((c) => c.id.startsWith('utn-normal'))?.id || courses[0].id, students: 8, discount: 'none' },
    { id: uid('r'), courseId: courses[0].id, students: 6, discount: 'none' },
  ]);
  const p = data.params;
  const disc = { none: 0, seguidores: p.descSeguidores, preventa: p.descPreventa };

  const calc = rows.map((r) => {
    const c = courses.find((x) => x.id === r.courseId) || courses[0];
    const price = Math.round(c.price * (1 - disc[r.discount]));
    const pr = profitability({ ...c, price }, p, r.students);
    return { r, c, price, ...pr };
  });
  const revenue = calc.reduce((a, x) => a + x.revenue, 0);
  const cost = calc.reduce((a, x) => a + x.teacher, 0);
  const set = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  return (
    <>
      <PageHead title="Simulador" desc="Prueba escenarios antes de abrir grupos: cuántos estudiantes, qué descuentos y cuánto queda después de pagar al profesor." />
      <div className="grid g4 kpis">
        <Kpi label="Ingresos del escenario" value={fmtMoney(revenue)} />
        <Kpi label="Costo de profesores" value={fmtMoney(cost)} sub={`$${p.costoProfesorHora} por hora`} />
        <Kpi label="Ganancia" value={fmtMoney(revenue - cost)} />
        <Kpi label="Margen" value={revenue ? fmtPct((revenue - cost) / revenue) : '—'} />
      </div>
      <div className="card table-wrap" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h2 className="grow">Grupos del escenario</h2>
          <button className="btn" onClick={() => setRows((rs) => [...rs, { id: uid('r'), courseId: courses[0].id, students: p.estudiantesEsperados, discount: 'none' }])}>
            <Plus size={15} /> Agregar grupo
          </button>
        </div>
        <table className="t">
          <thead>
            <tr><th>Curso</th><th>Estudiantes</th><th>Precio aplicado</th><th className="num">Ingresos</th><th className="num">Profesor</th><th className="num">Ganancia</th><th>¿Conviene abrir?</th><th /></tr>
          </thead>
          <tbody>
            {calc.map(({ r, c, price, revenue: rev, teacher, profit, breakEven }) => (
              <tr key={r.id}>
                <td>
                  <select className="input" value={r.courseId} onChange={(e) => set(r.id, 'courseId', e.target.value)}>
                    {courses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input type="range" min={1} max={c.maxStudents || 15} value={r.students} onChange={(e) => set(r.id, 'students', Number(e.target.value))} />
                    <b className="mono">{r.students}</b>
                  </div>
                </td>
                <td>
                  <select className="input" value={r.discount} onChange={(e) => set(r.id, 'discount', e.target.value)}>
                    <option value="none">Normal ({fmtMoney(c.price)})</option>
                    <option value="seguidores">Seguidores −{fmtPct(p.descSeguidores)}</option>
                    <option value="preventa">Preventa −{fmtPct(p.descPreventa)}</option>
                  </select>
                  <div className="small muted">{fmtMoney(price)} por estudiante</div>
                </td>
                <td className="num">{fmtMoney(rev)}</td>
                <td className="num">{fmtMoney(teacher)}</td>
                <td className="num"><b style={{ color: profit >= 0 ? '#059669' : '#dc2626' }}>{fmtMoney(profit)}</b></td>
                <td>
                  {r.students < p.cupoMinimo ? (
                    <span className="chip tag-warn">Bajo el cupo mínimo ({p.cupoMinimo})</span>
                  ) : profit >= 0 ? (
                    <span className="chip tag-ok">Sí · cubre desde {breakEven}</span>
                  ) : (
                    <span className="chip tag-bad">No · necesita {breakEven}</span>
                  )}
                </td>
                <td><button className="btn sm ghost danger" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 10 }}>El simulador no guarda cambios: es solo para probar. Solo cuenta el costo del profesor (sin alquiler, servicios ni impuestos).</p>
      </div>
    </>
  );
}
