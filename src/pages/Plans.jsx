import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, CheckCircle2, Circle, Printer } from 'lucide-react';
import { useStore } from '../lib/store';
import { fmtH, uid, DAYS } from '../lib/time';
import { Modal, PageHead, Seg, Text, Num, Select, Bar } from '../components/ui';

const MOD_COLORS = {
  Matemática: '#2563eb', Física: '#7c3aed', Química: '#dc2626', Biología: '#059669', Anatomía: '#db2777',
  Lenguaje: '#d97706', Estadística: '#0891b2', Emprendimiento: '#4d7c0f', Simulacro: '#0f172a', Razonamiento: '#d97706',
};
const modColor = (m) => MOD_COLORS[m] || '#64748b';

export default function Plans() {
  const { data, ops, notify } = useStore();
  const [planId, setPlanId] = useState(data.plans[0]?.id);
  const [week, setWeek] = useState(1);
  const [mode, setMode] = useState('week');
  const [q, setQ] = useState('');
  const [mod, setMod] = useState('');
  const [edit, setEdit] = useState(null);

  const pi = data.plans.findIndex((p) => p.id === planId);
  const plan = data.plans[pi];
  const weeks = Math.max(plan.weeks, ...plan.classes.map((c) => c.week));
  const modules = [...new Set(plan.classes.map((c) => c.module))];

  const shown = useMemo(() => {
    let list = plan.classes;
    if (mode === 'week') list = list.filter((c) => c.week === week);
    if (mod) list = list.filter((c) => c.module === mod);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((c) => `${c.module} ${c.content} ${c.topics} ${c.routes}`.toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => a.week - b.week || DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.time).localeCompare(String(b.time), 'es', { numeric: true }));
  }, [plan, mode, week, mod, q]);

  const doneCount = plan.classes.filter((c) => c.done).length;
  const toggleDone = (id) =>
    ops.update((d) => {
      const c = d.plans[pi].classes.find((x) => x.id === id);
      c.done = !c.done;
    });
  const weekStats = (w) => {
    const cs = plan.classes.filter((c) => c.week === w);
    return { total: cs.length, done: cs.filter((c) => c.done).length };
  };

  function save(c) {
    ops.update((d) => {
      const list = d.plans[pi].classes;
      const i = list.findIndex((x) => x.id === c.id);
      if (i >= 0) list[i] = c;
      else list.push({ ...c, id: uid('cl') });
    });
    notify('Clase guardada');
    setEdit(null);
  }

  return (
    <>
      <PageHead title="Plan de clases" desc="Qué se enseña cada semana. Marca las clases ya dictadas para llevar el avance.">
        <button className="btn no-print" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
        <button className="btn primary no-print" onClick={() => setEdit({ week, day: 'Lunes', time: '', hours: 2, module: modules[0] || '', content: '', topics: '', routes: '', done: false })}>
          <Plus size={16} /> Nueva clase
        </button>
      </PageHead>

      <div className="card no-print" style={{ marginBottom: 14 }}>
        <div className="row">
          <Seg value={planId} onChange={(v) => { setPlanId(v); setWeek(1); setMod(''); }} options={data.plans.map((p) => ({ value: p.id, label: p.name }))} />
          <span className="right small muted">{doneCount} de {plan.classes.length} clases dictadas</span>
          <div style={{ width: 160 }}><Bar max={plan.classes.length || 1} parts={[{ value: doneCount, color: '#059669' }]} /></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Seg value={mode} onChange={setMode} options={[{ value: 'week', label: 'Por semana' }, { value: 'all', label: 'Todo el curso' }]} />
          <select className="input" style={{ width: 'auto' }} value={mod} onChange={(e) => setMod(e.target.value)}>
            <option value="">Todos los módulos</option>
            {modules.map((m) => <option key={m}>{m}</option>)}
          </select>
          <div className="row grow" style={{ maxWidth: 340 }}>
            <Search size={16} className="muted" />
            <input className="input grow" placeholder="Buscar tema… (ej. vectores)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {mode === 'week' && (
          <div className="weeks" style={{ marginTop: 12 }}>
            {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
              const s = weekStats(w);
              return (
                <button key={w} className={`wk ${w === week ? 'on' : ''}`} onClick={() => setWeek(w)} title={`Semana ${w}: ${s.done}/${s.total} dictadas`}>
                  {w}
                  <span className="p"><i style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} /></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mode === 'week' && <h2 style={{ margin: '4px 0 12px' }}>Semana {week} <span className="muted small">· {fmtH(shown.reduce((a, c) => a + c.hours, 0))}</span></h2>}

      <div className="col">
        {shown.map((c) => (
          <div key={c.id} className={`class-card ${c.done ? 'done' : ''}`}>
            <button className="btn ghost icon" onClick={() => toggleDone(c.id)} title={c.done ? 'Marcar como pendiente' : 'Marcar como dictada'}>
              {c.done ? <CheckCircle2 size={22} color="#059669" /> : <Circle size={22} color="#94a3b8" />}
            </button>
            <div>
              <div className="row" style={{ gap: 8 }}>
                <span className="chip" style={{ background: modColor(c.module), color: '#fff' }}>{c.module}</span>
                <span className="small muted">{mode === 'all' && `Semana ${c.week} · `}{c.day} · {c.time} · {fmtH(c.hours)}</span>
              </div>
              <div className="ct" style={{ fontWeight: 600, marginTop: 6 }}>{c.content}</div>
              {c.topics && c.topics !== 'Continuación' && <div className="topics">{c.topics}</div>}
              {c.routes && <div className="small" style={{ marginTop: 6 }}>👥 {c.routes}</div>}
            </div>
            <div className="row no-print" style={{ gap: 2 }}>
              <button className="btn sm ghost" onClick={() => setEdit({ ...c })}><Pencil size={14} /></button>
              <button className="btn sm ghost danger" onClick={() => confirm('¿Eliminar esta clase del plan?') && ops.update((d) => { d.plans[pi].classes = d.plans[pi].classes.filter((x) => x.id !== c.id); })}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="card empty">No hay clases que coincidan.</div>}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Editar clase' : 'Nueva clase'} onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" onClick={() => save(edit)}>Guardar</button></>}>
          <div className="grid g4">
            <Num label="Semana" value={edit.week} onChange={(v) => setEdit({ ...edit, week: v })} min={1} />
            <Select label="Día" value={edit.day} onChange={(v) => setEdit({ ...edit, day: v })} options={DAYS} />
            <Text label="Horario" placeholder="15:00 a 17:00" value={edit.time} onChange={(v) => setEdit({ ...edit, time: v })} />
            <Num label="Horas" step="0.5" value={edit.hours} onChange={(v) => setEdit({ ...edit, hours: v })} />
          </div>
          <Text label="Módulo / actividad" value={edit.module} onChange={(v) => setEdit({ ...edit, module: v })} list="fw-mods" />
          <datalist id="fw-mods">{modules.map((m) => <option key={m} value={m} />)}</datalist>
          <Text label="Contenido de la clase" area value={edit.content} onChange={(v) => setEdit({ ...edit, content: v })} />
          <Text label="Temas del temario" area value={edit.topics} onChange={(v) => setEdit({ ...edit, topics: v })} />
          <Text label="Rutas / grupos que asisten" value={edit.routes} onChange={(v) => setEdit({ ...edit, routes: v })} />
        </Modal>
      )}
    </>
  );
}
