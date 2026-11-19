import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Info } from 'lucide-react';
import { useStore } from '../lib/store';
import { allCourses, routeStats, moduleHours, profitability, FORMATS } from '../lib/calc';
import { fmtH, fmtMoney, fmtPct, fmtNum, uid } from '../lib/time';
import { Modal, PageHead, Seg, Text, Num, occTag } from '../components/ui';

const PALETTE = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#4d7c0f', '#9333ea', '#ea580c'];

export default function Courses() {
  const [tab, setTab] = useState('cursos');
  return (
    <>
      <PageHead title="Cursos y precios" desc="Carga horaria, rutas UTN, módulos y rentabilidad. Los precios se recalculan solos al cambiar horas o tarifas." />
      <div style={{ marginBottom: 14 }}>
        <Seg value={tab} onChange={setTab} options={[
          { value: 'cursos', label: 'Todos los cursos' },
          { value: 'rutas', label: 'Rutas y precios UTN' },
          { value: 'modulos', label: 'Módulos UTN' },
          { value: 'rentabilidad', label: 'Rentabilidad' },
        ]} />
      </div>
      {tab === 'cursos' && <AllCourses goRoutes={() => setTab('rutas')} />}
      {tab === 'rutas' && <Routes />}
      {tab === 'modulos' && <Modules />}
      {tab === 'rentabilidad' && <Profit />}
    </>
  );
}

function AllCourses({ goRoutes }) {
  const { data, ops, notify } = useStore();
  const [edit, setEdit] = useState(null);
  const courses = useMemo(() => allCourses(data), [data]);
  const hidden = new Set(data.hiddenCourses || []);
  const groups = [...new Set(courses.map((c) => c.group))];

  const toggleWeb = (id) =>
    ops.update((d) => {
      const s = new Set(d.hiddenCourses || []);
      s.has(id) ? s.delete(id) : s.add(id);
      d.hiddenCourses = [...s];
    });

  function save(c) {
    const clean = { ...c, hours: Number(c.hours), weeks: Number(c.weeks), price: Number(c.price) };
    ops.update((d) => {
      const i = d.courses.findIndex((x) => x.id === c.id);
      if (i >= 0) d.courses[i] = clean;
      else d.courses.push({ ...clean, id: uid('c') });
    });
    notify('Curso guardado');
    setEdit(null);
  }

  return (
    <>
      <div className="card table-wrap">
        <div className="card-h">
          <h2 className="grow">Carga horaria por curso</h2>
          <button className="btn primary" onClick={() => setEdit({ name: '', group: 'Otros cursos', hours: 40, weeks: 10, price: 100, minStudents: 4, maxStudents: 10, format: '' })}>
            <Plus size={16} /> Nuevo curso
          </button>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Curso</th><th className="num">Horas</th><th className="num">Semanas</th><th className="num">h/semana</th>
              <th className="num">Precio</th><th className="num">$/hora</th><th className="num">Cupo</th><th>Formato y horario</th><th>En la web</th><th />
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr><td colSpan={10} style={{ background: '#f8fafc', fontWeight: 600 }}>{g}</td></tr>
              {courses.filter((c) => c.group === g).map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td className="num">{fmtNum(c.hours)}</td>
                  <td className="num">{c.weeks}</td>
                  <td className="num">{fmtNum(c.hours / c.weeks)}</td>
                  <td className="num"><b>{fmtMoney(c.price)}</b></td>
                  <td className="num">{c.hours ? `$${fmtNum(c.price / c.hours, 2)}` : '—'}</td>
                  <td className="num">{c.minStudents}–{c.maxStudents}</td>
                  <td className="small muted">{c.format}</td>
                  <td>
                    <button className="btn sm ghost" onClick={() => toggleWeb(c.id)} title="Mostrar u ocultar en la página web">
                      {hidden.has(c.id) ? <><EyeOff size={14} /> Oculto</> : <><Eye size={14} color="#059669" /> Visible</>}
                    </button>
                  </td>
                  <td>
                    {c.computed ? (
                      <button className="btn sm ghost" onClick={goRoutes} title="Se calcula desde Rutas y Módulos UTN"><Info size={14} /></button>
                    ) : (
                      <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                        <button className="btn sm ghost" onClick={() => setEdit({ ...c })}><Pencil size={14} /></button>
                        <button className="btn sm ghost danger" onClick={() => confirm(`¿Eliminar ${c.name}?`) && ops.update((d) => { d.courses = d.courses.filter((x) => x.id !== c.id); })}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <p className="small muted" style={{ marginTop: 10 }}>Los cursos UTN se calculan automáticamente desde las pestañas <b>Rutas</b> y <b>Módulos</b>.</p>
      </div>

      {edit && (
        <Modal title={edit.id ? 'Editar curso' : 'Nuevo curso'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.name} onClick={() => save(edit)}>Guardar</button></>}>
          <Text label="Nombre del curso" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} autoFocus />
          <Text label="Grupo" hint="Ej.: Inglés, Preuniversitario, Nivelación" value={edit.group} onChange={(v) => setEdit({ ...edit, group: v })} />
          <div className="grid g3">
            <Num label="Horas totales" value={edit.hours} onChange={(v) => setEdit({ ...edit, hours: v })} />
            <Num label="Semanas" value={edit.weeks} onChange={(v) => setEdit({ ...edit, weeks: v })} />
            <Num label="Precio ($)" value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} />
          </div>
          <div className="grid g2">
            <Num label="Cupo mínimo" value={edit.minStudents} onChange={(v) => setEdit({ ...edit, minStudents: v })} />
            <Num label="Cupo máximo" value={edit.maxStudents} onChange={(v) => setEdit({ ...edit, maxStudents: v })} />
          </div>
          <Text label="Formato y horario" area value={edit.format} onChange={(v) => setEdit({ ...edit, format: v })} />
          {edit.hours > 0 && <div className="small muted">= {fmtNum(edit.hours / (edit.weeks || 1))} h por semana · ${fmtNum(edit.price / edit.hours, 2)} por hora</div>}
        </Modal>
      )}
    </>
  );
}

function Routes() {
  const { data, ops } = useStore();
  const stats = useMemo(() => routeStats(data), [data]);
  const toggle = (mid, rid) =>
    ops.update((d) => {
      const m = d.modules.find((x) => x.id === mid);
      m.routeIds = m.routeIds.includes(rid) ? m.routeIds.filter((x) => x !== rid) : [...m.routeIds, rid];
    });
  const rows = [
    ['Horas de módulos', (s) => fmtH(s.moduleHours)],
    ['Horas de simulacros', (s) => fmtH(s.simHours)],
    ['Horas totales', (s) => <b>{fmtH(s.total)}</b>],
    ['Horas por semana', (s) => fmtH(s.perWeek)],
    ['Precio', (s) => <b style={{ color: '#0b3b8c', fontSize: '1.05rem' }}>{fmtMoney(s.price)}</b>],
    ['Cuota', (s) => `${fmtMoney(s.cuota)} × ${s.cuotas}`],
    ['Precio seguidores', (s) => fmtMoney(s.seguidores)],
    ['Precio preventa', (s) => fmtMoney(s.preventa)],
    ['Precio por hora real', (s) => `$${fmtNum(s.perHour, 2)}`],
  ];

  return (
    <>
      <div className="card table-wrap">
        <div className="card-h">
          <h2 className="grow">¿Qué módulos lleva cada ruta?</h2>
          <span className="small muted">Haz clic en un cuadro para incluir o quitar el módulo</span>
        </div>
        <table className="t matrix">
          <thead>
            <tr>
              <th>Módulo</th><th className="num">Horas Normal</th><th className="num">Horas Intensivo</th>
              {data.routes.map((r) => <th key={r.id} style={{ textAlign: 'center' }}>{r.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.modules.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b></td>
                <td className="num">{fmtNum(moduleHours(m, 'normal'))}</td>
                <td className="num">{fmtNum(moduleHours(m, 'intensivo'))}</td>
                {data.routes.map((r) => (
                  <td key={r.id} className="tog">
                    <button className={`mx ${m.routeIds.includes(r.id) ? 'on' : ''}`} onClick={() => toggle(m.id, r.id)}>
                      {m.routeIds.includes(r.id) ? '✓' : '·'}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td><b>Simulacros (cantidad)</b></td><td /><td />
              {data.routes.map((r, i) => (
                <td key={r.id} className="tog">
                  <input className="cell-input num" style={{ width: 60, textAlign: 'center' }} type="number" min={0} value={r.simulacros}
                    onChange={(e) => ops.update((d) => { d.routes[i].simulacros = Number(e.target.value); })} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        {FORMATS.map(({ id: fmt, label }) => (
          <div key={fmt} className="card table-wrap">
            <div className="card-h">
              <h2 className="grow">Curso {label}</h2>
              <span className="small muted">
                {fmt === 'normal'
                  ? `${data.params.semanasNormal} semanas · $${data.params.tarifaNormal}/h`
                  : `${data.params.semanasIntensivo} semanas · $${data.params.tarifaIntensivo}/h`}
              </span>
            </div>
            <table className="t">
              <thead><tr><th />{stats.map((s) => <th key={s.route.id} className="num">{s.route.name}</th>)}</tr></thead>
              <tbody>
                {rows.map(([label2, f]) => (
                  <tr key={label2}><td>{label2}</td>{stats.map((s) => <td key={s.route.id} className="num">{f(s[fmt])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="small muted">Las tarifas por hora, descuentos y redondeo se cambian en <a href="#/ajustes">Ajustes</a>.</p>
    </>
  );
}

function Modules() {
  const { data, ops } = useStore();
  const [fmt, setFmt] = useState('normal');
  const totalWeeks = fmt === 'normal' ? data.params.semanasNormal : data.params.semanasIntensivo;
  const setM = (i, path, v) =>
    ops.update((d) => {
      const m = d.modules[i];
      if (path.length === 1) m[path[0]] = v;
      else m[path[0]][path[1]] = v;
    });
  const addModule = () =>
    ops.update((d) => {
      d.modules.push({ id: uid('m'), name: 'Nuevo módulo', realMinHours: 0, normal: { hoursPerWeek: 1, weeks: 10, startWeek: 1 }, intensivo: { hoursPerWeek: 1, weeks: 5, startWeek: 1 }, routeIds: [] });
    });
  const total = data.modules.reduce((a, m) => a + moduleHours(m, fmt), 0);
  const hpw = data.modules.reduce((a, m) => a + m[fmt].hoursPerWeek, 0);

  return (
    <>
      <div className="card table-wrap">
        <div className="card-h">
          <h2 className="grow">Carga horaria por módulo</h2>
          <Seg value={fmt} onChange={setFmt} options={FORMATS.map((f) => ({ value: f.id, label: f.label }))} />
          <button className="btn" onClick={addModule}><Plus size={15} /> Módulo</button>
        </div>
        <table className="t">
          <thead>
            <tr><th>Módulo</th><th className="num">Mín. real (h)</th><th className="num">h por semana</th><th className="num">Semanas</th><th className="num">Semana de inicio</th><th className="num">Horas planificadas</th><th className="num">Costo profesor</th><th /></tr>
          </thead>
          <tbody>
            {data.modules.map((m, i) => {
              const h = moduleHours(m, fmt);
              const short = fmt === 'normal' && h < m.realMinHours;
              const overflow = m[fmt].startWeek + m[fmt].weeks - 1 > totalWeeks;
              return (
                <tr key={m.id}>
                  <td><input className="cell-input" value={m.name} onChange={(e) => setM(i, ['name'], e.target.value)} /></td>
                  <td className="num"><input className="cell-input num" type="number" value={m.realMinHours} onChange={(e) => setM(i, ['realMinHours'], Number(e.target.value))} /></td>
                  <td className="num"><input className="cell-input num" type="number" step="0.5" value={m[fmt].hoursPerWeek} onChange={(e) => setM(i, [fmt, 'hoursPerWeek'], Number(e.target.value))} /></td>
                  <td className="num"><input className="cell-input num" type="number" value={m[fmt].weeks} onChange={(e) => setM(i, [fmt, 'weeks'], Number(e.target.value))} /></td>
                  <td className="num"><input className={`cell-input num ${overflow ? 'tag-bad' : ''}`} type="number" min={1} value={m[fmt].startWeek} onChange={(e) => setM(i, [fmt, 'startWeek'], Number(e.target.value))} /></td>
                  <td className="num"><b>{fmtNum(h)}</b>{short && <span className="chip tag-warn" style={{ marginLeft: 6 }} title="Por debajo de las horas mínimas estimadas">bajo</span>}</td>
                  <td className="num">{fmtMoney(h * data.params.costoProfesorHora)}</td>
                  <td><button className="btn sm ghost danger" onClick={() => confirm(`¿Eliminar el módulo ${m.name}?`) && ops.update((d) => { d.modules.splice(i, 1); })}><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td><td className="num">{data.modules.reduce((a, m) => a + m.realMinHours, 0)}</td><td className="num">{fmtNum(hpw)}</td><td /><td />
              <td className="num">{fmtNum(total)}</td><td className="num">{fmtMoney(total * data.params.costoProfesorHora)}</td><td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h2 className="grow">Calendario de módulos ({totalWeeks} semanas)</h2><span className="small muted">Cada barra muestra en qué semanas se dicta el módulo</span></div>
        <div className="gantt">
          <div className="gantt-row">
            <span />
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }} className="small muted">
              {Array.from({ length: totalWeeks }, (_, i) => <span key={i} style={{ textAlign: 'center', fontSize: '.68rem' }}>{i + 1}</span>)}
            </div>
          </div>
          {data.modules.map((m, i) => {
            const s = m[fmt];
            const left = ((s.startWeek - 1) / totalWeeks) * 100;
            const w = (Math.min(s.weeks, totalWeeks - s.startWeek + 1) / totalWeeks) * 100;
            return (
              <div key={m.id} className="gantt-row">
                <span>{m.name}</span>
                <div className="gantt-track">
                  <div className="gantt-bar" style={{ left: `${left}%`, width: `${Math.max(w, 2)}%`, background: PALETTE[i % PALETTE.length] }}>
                    S{s.startWeek}–{s.startWeek + s.weeks - 1} · {fmtNum(s.hoursPerWeek)} h/sem
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Profit() {
  const { data } = useStore();
  const [n, setN] = useState(data.params.estudiantesEsperados);
  const courses = useMemo(() => allCourses(data), [data]);
  return (
    <div className="card table-wrap">
      <div className="card-h">
        <h2 className="grow">Rentabilidad por estudiante</h2>
        <label className="row small">Estudiantes por grupo:
          <input type="range" min={1} max={15} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <b className="mono" style={{ width: 24 }}>{n}</b>
        </label>
      </div>
      <p className="small muted" style={{ marginTop: -6 }}>Costo del profesor repartido entre los estudiantes. No incluye alquiler, servicios, marketing ni impuestos.</p>
      <table className="t">
        <thead>
          <tr>
            <th>Curso</th><th className="num">Horas</th><th className="num">Precio</th><th className="num">Costo profesor</th>
            <th className="num">Costo por estudiante</th><th className="num">Margen por estudiante</th><th className="num">Margen</th>
            <th className="num">Margen con cupo mín.</th><th className="num">Estudiantes para cubrir</th><th className="num">Ganancia del grupo</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((c) => {
            const r = profitability(c, data.params, n);
            return (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td className="num">{fmtNum(c.hours)}</td>
                <td className="num">{fmtMoney(c.price)}</td>
                <td className="num">{fmtMoney(r.teacher)}</td>
                <td className="num">{fmtMoney(r.costPer)}</td>
                <td className="num">{fmtMoney(r.margin)}</td>
                <td className="num"><span className={`chip ${occTag(1 - r.marginPct)}`}>{fmtPct(r.marginPct)}</span></td>
                <td className="num">{fmtPct(r.marginMinPct)}</td>
                <td className="num">{r.breakEven}</td>
                <td className="num"><b style={{ color: r.profit >= 0 ? '#059669' : '#dc2626' }}>{fmtMoney(r.profit)}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
