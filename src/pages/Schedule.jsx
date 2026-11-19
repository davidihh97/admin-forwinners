import { useMemo, useState } from 'react';
import { Plus, Printer, AlertTriangle, Trash2, Copy, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { findConflicts, openHours } from '../lib/calc';
import { DAYS, todayName, toMin, toHHMM, hoursOf, fmtH, pretty, uid } from '../lib/time';
import { Modal, PageHead, Seg, Select, Text, Field } from '../components/ui';

const SLOT = 30; // minutos por fila
const ROW_H = 22; // px por fila

export default function Schedule() {
  const { data, ops, notify } = useStore();
  const [view, setView] = useState('space');
  const [spaceId, setSpaceId] = useState(data.spaces[0]?.id);
  const [day, setDay] = useState(todayName());
  const [hidden, setHidden] = useState(new Set());
  const [edit, setEdit] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const [q, setQ] = useState('');

  const conflicts = useMemo(() => findConflicts(data), [data]);
  const cat = (id) => data.categories.find((c) => c.id === id) || { name: '—', color: '#64748b' };
  const spaceName = (id) => data.spaces.find((s) => s.id === id)?.name || '—';

  const p = data.params;
  const startMin = Math.min(toMin(p.aperturaSemana), toMin(p.aperturaFinde), ...data.schedule.map((b) => toMin(b.start)));
  const endMin = Math.max(toMin(p.cierreSemana), toMin(p.cierreFinde), ...data.schedule.map((b) => toMin(b.end)));
  const first = Math.floor(startMin / 60) * 60;
  const last = Math.ceil(endMin / 60) * 60;
  const slots = [];
  for (let m = first; m < last; m += SLOT) slots.push(m);

  const columns =
    view === 'space'
      ? DAYS.map((d) => ({ key: d, day: d, spaceId, label: d, sub: d === todayName() ? 'hoy' : '', today: d === todayName() }))
      : data.spaces.map((s) => ({ key: s.id, day, spaceId: s.id, label: s.name, sub: `cap. ${s.capacity}` }));

  const blocksFor = (col) => data.schedule.filter((b) => b.day === col.day && b.spaceId === col.spaceId);

  function openNew(col, m) {
    setEdit({ id: null, day: col.day, spaceId: col.spaceId, start: toHHMM(m), end: toHHMM(Math.min(m + 60, last)), service: '', categoryId: data.categories[0]?.id, notes: '' });
  }

  function drop(col, m) {
    const b = data.schedule.find((x) => x.id === dragId);
    setDropKey(null);
    setDragId(null);
    if (!b) return;
    const dur = toMin(b.end) - toMin(b.start);
    ops.update((d) => {
      const x = d.schedule.find((y) => y.id === b.id);
      x.day = col.day;
      x.spaceId = col.spaceId;
      x.start = toHHMM(m);
      x.end = toHHMM(m + dur);
    });
    notify(`Movido: ${b.service} → ${col.day} ${toHHMM(m)}`);
  }

  const services = [...new Set(data.schedule.map((b) => b.service))].sort();
  const list = data.schedule
    .filter((b) => !q || `${b.service} ${b.day} ${spaceName(b.spaceId)} ${cat(b.categoryId).name} ${b.notes}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start));

  return (
    <>
      <PageHead title="Horario semanal" desc="Haz clic en un espacio vacío para crear una clase, en una clase para editarla, o arrástrala para moverla.">
        <button className="btn no-print" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
        <button className="btn primary no-print" onClick={() => openNew(columns[0], toMin(p.aperturaSemana))}><Plus size={16} /> Nueva clase</button>
      </PageHead>

      <div className="card no-print" style={{ marginBottom: 14 }}>
        <div className="row">
          <Seg value={view} onChange={setView} options={[{ value: 'space', label: 'Por espacio' }, { value: 'day', label: 'Por día' }, { value: 'list', label: 'Lista' }]} />
          {view === 'space' && <Seg value={spaceId} onChange={setSpaceId} options={data.spaces.map((s) => ({ value: s.id, label: s.name }))} />}
          {view === 'day' && <Seg value={day} onChange={setDay} options={DAYS.map((d) => ({ value: d, label: d.slice(0, 3) }))} />}
          {view === 'list' && (
            <div className="row grow" style={{ maxWidth: 360 }}>
              <Search size={16} className="muted" />
              <input className="input grow" placeholder="Buscar clase, día, espacio…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          {data.categories.map((c) => {
            const on = !hidden.has(c.id);
            return (
              <button
                key={c.id}
                className={`chip toggle ${on ? 'on' : ''}`}
                style={on ? { background: c.color, borderColor: c.color } : {}}
                onClick={() => setHidden((h) => { const n = new Set(h); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                title="Mostrar u ocultar esta categoría"
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {view !== 'list' ? (
        <div className="sched-wrap">
          <div className="sched" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(110px, 1fr))` }}>
            <div className="sched-col-h" />
            {columns.map((c) => (
              <div key={c.key} className={`sched-col-h ${c.today ? 'today' : ''}`}>
                {c.label}
                <span className="sub">{c.sub || fmtH(blocksFor(c).reduce((a, b) => a + hoursOf(b), 0))}</span>
              </div>
            ))}
            <div>
              {slots.map((m) => (
                <div key={m} className="sched-time" style={{ height: ROW_H }}>{m % 60 === 0 ? pretty(toHHMM(m)) : ''}</div>
              ))}
            </div>
            {columns.map((col) => {
              const [o, cl] = openHours(p, col.day);
              return (
                <div key={col.key} className="sched-col">
                  {slots.map((m) => {
                    const closed = m < toMin(o) || m >= toMin(cl);
                    const k = `${col.key}|${m}`;
                    return (
                      <div
                        key={m}
                        className={`sched-slot ${m % 60 === 0 ? 'hour' : ''} ${closed ? 'closed' : ''} ${dropKey === k ? 'drop' : ''}`}
                        style={{ height: ROW_H }}
                        title={closed ? 'Fuera del horario de atención' : `${col.day} ${toHHMM(m)} — clic para crear`}
                        onClick={() => !closed && openNew(col, m)}
                        onDragOver={(e) => { e.preventDefault(); setDropKey(k); }}
                        onDrop={(e) => { e.preventDefault(); drop(col, m); }}
                      />
                    );
                  })}
                  {blocksFor(col).map((b) => {
                    const c = cat(b.categoryId);
                    const top = ((toMin(b.start) - first) / SLOT) * ROW_H;
                    const h = ((toMin(b.end) - toMin(b.start)) / SLOT) * ROW_H;
                    const bad = conflicts.get(b.id);
                    return (
                      <div
                        key={b.id}
                        className={`blk ${bad ? 'conflict' : ''} ${hidden.has(b.categoryId) ? 'dim' : ''}`}
                        style={{ top: top + 1, height: Math.max(h - 2, 14), background: c.color }}
                        draggable
                        onDragStart={(e) => { setDragId(b.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onDragEnd={() => { setDragId(null); setDropKey(null); }}
                        onClick={() => setEdit({ ...b })}
                        title={`${b.service}\n${pretty(b.start)}–${pretty(b.end)} · ${c.name}${b.notes ? `\n${b.notes}` : ''}${bad ? `\n⚠ ${bad.join('\n⚠ ')}` : ''}`}
                      >
                        <b>{bad && '⚠ '}{b.service}</b>
                        {h > 30 && <span className="t">{pretty(b.start)}–{pretty(b.end)}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="t">
            <thead>
              <tr><th>Día</th><th>Inicio</th><th>Fin</th><th>Espacio</th><th>Clase / servicio</th><th>Categoría</th><th className="num">Horas</th><th className="num">Cupo</th><th>Notas</th></tr>
            </thead>
            <tbody>
              {list.filter((b) => !hidden.has(b.categoryId)).map((b) => (
                <tr key={b.id} onClick={() => setEdit({ ...b })} style={{ cursor: 'pointer' }}>
                  <td>{b.day}</td>
                  <td className="mono">{pretty(b.start)}</td>
                  <td className="mono">{pretty(b.end)}</td>
                  <td>{spaceName(b.spaceId)}</td>
                  <td>{conflicts.has(b.id) && <AlertTriangle size={14} color="#dc2626" />} {b.service}</td>
                  <td><span className="dot" style={{ background: cat(b.categoryId).color }} /> {cat(b.categoryId).name}</td>
                  <td className="num">{fmtH(hoursOf(b))}</td>
                  <td className="num">{data.spaces.find((s) => s.id === b.spaceId)?.capacity}</td>
                  <td className="muted small">{b.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <div className="empty">Sin resultados.</div>}
        </div>
      )}

      {edit && <BlockEditor block={edit} services={services} onClose={() => setEdit(null)} />}
    </>
  );
}

function BlockEditor({ block, services, onClose }) {
  const { data, ops, notify } = useStore();
  const [b, setB] = useState(block);
  const [repeat, setRepeat] = useState(new Set());
  const set = (k) => (v) => setB((x) => ({ ...x, [k]: v }));
  const isNew = !block.id;

  const preview = { ...data, schedule: [...data.schedule.filter((x) => x.id !== block.id), { ...b, id: '__preview' }] };
  const problems = findConflicts(preview).get('__preview') || [];
  const hours = hoursOf(b);
  const cap = data.spaces.find((s) => s.id === b.spaceId)?.capacity;

  function save() {
    if (!b.service.trim()) return notify('Escribe el nombre de la clase', 'bad');
    if (hours <= 0) return notify('La hora de fin debe ser después del inicio', 'bad');
    ops.update((d) => {
      if (isNew) d.schedule.push({ ...b, id: uid('s') });
      else Object.assign(d.schedule.find((x) => x.id === b.id), b);
      for (const day of repeat) d.schedule.push({ ...b, day, id: uid('s') });
    });
    notify(isNew ? 'Clase creada' : 'Cambios guardados');
    onClose();
  }
  function remove() {
    if (!confirm(`¿Eliminar "${b.service}" del ${b.day}?`)) return;
    ops.update((d) => { d.schedule = d.schedule.filter((x) => x.id !== b.id); });
    notify('Clase eliminada');
    onClose();
  }

  return (
    <Modal
      title={isNew ? 'Nueva clase' : 'Editar clase'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={remove}><Trash2 size={15} /> Eliminar</button>}
          <span className="grow" />
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={save}>{isNew ? 'Crear' : 'Guardar'}</button>
        </>
      }
    >
      <Field label="Clase / servicio">
        <input list="fw-services" value={b.service} onChange={(e) => set('service')(e.target.value)} autoFocus placeholder="Ej.: Normal · Matemática" />
        <datalist id="fw-services">{services.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <div className="grid g2">
        <Select label="Categoría" value={b.categoryId} onChange={set('categoryId')} options={data.categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Select label="Espacio" value={b.spaceId} onChange={set('spaceId')} options={data.spaces.map((s) => ({ value: s.id, label: `${s.name} (cap. ${s.capacity})` }))} />
      </div>
      <div className="grid g3">
        <Select label="Día" value={b.day} onChange={set('day')} options={DAYS} />
        <Text label="Inicio" type="time" step="900" value={b.start} onChange={set('start')} />
        <Text label="Fin" type="time" step="900" value={b.end} onChange={set('end')} />
      </div>
      <Text label="Notas" value={b.notes} onChange={set('notes')} placeholder="Opcional" />
      <div className="row small muted">
        <span>Duración: <b>{hours > 0 ? fmtH(hours) : '—'}</b></span>
        <span>· Cupo máximo: <b>{cap}</b></span>
      </div>
      <div>
        <div className="small muted" style={{ marginBottom: 6 }}><Copy size={13} /> Repetir también los días:</div>
        <div className="row">
          {DAYS.filter((d) => d !== b.day).map((d) => (
            <button key={d} type="button" className={`chip toggle ${repeat.has(d) ? 'on' : ''}`} style={repeat.has(d) ? { background: '#0b3b8c' } : {}}
              onClick={() => setRepeat((r) => { const n = new Set(r); n.has(d) ? n.delete(d) : n.add(d); return n; })}>
              {d}
            </button>
          ))}
        </div>
      </div>
      {problems.length > 0 && (
        <div className="alert warn">
          <AlertTriangle size={18} />
          <div>{problems.map((x, i) => <div key={i}>{x}</div>)}<div className="small">Puedes guardar igual, pero quedará marcado en rojo.</div></div>
        </div>
      )}
    </Modal>
  );
}
