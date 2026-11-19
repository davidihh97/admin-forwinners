import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../lib/store';
import { spaceStats, availableHoursPerWeek } from '../lib/calc';
import { DAYS, fmtH, fmtPct, uid } from '../lib/time';
import { Modal, PageHead, Bar, Text, Num, occTag, Field } from '../components/ui';

export default function Spaces() {
  const { data, ops, notify } = useStore();
  const stats = useMemo(() => spaceStats(data), [data]);
  const [edit, setEdit] = useState(null);
  const cat = (id) => data.categories.find((c) => c.id === id) || { name: id, color: '#94a3b8' };
  const p = data.params;
  const setP = (k) => (v) => ops.update((d) => { d.params[k] = v; });

  function save(s) {
    ops.update((d) => {
      const i = d.spaces.findIndex((x) => x.id === s.id);
      if (i >= 0) d.spaces[i] = s;
      else d.spaces.push({ ...s, id: uid('sp') });
    });
    notify('Espacio guardado');
    setEdit(null);
  }
  function remove(s) {
    const n = data.schedule.filter((b) => b.spaceId === s.id).length;
    if (n) return notify(`Este espacio tiene ${n} clases en el horario. Muévelas primero.`, 'bad');
    if (!confirm(`¿Eliminar ${s.name}?`)) return;
    ops.update((d) => { d.spaces = d.spaces.filter((x) => x.id !== s.id); });
  }

  return (
    <>
      <PageHead title="Espacios" desc="Aulas y oficinas, su capacidad y cuánto se usan cada semana.">
        <button className="btn primary" onClick={() => setEdit({ name: '', capacity: 4, use: '', color: '#0891b2' })}><Plus size={16} /> Nuevo espacio</button>
      </PageHead>

      <div className="grid g2">
        {stats.map((s) => (
          <div key={s.space.id} className="card">
            <div className="card-h">
              <span className="dot" style={{ background: s.space.color, width: 14, height: 14 }} />
              <h2 className="grow">{s.space.name}</h2>
              <span className={`chip ${occTag(s.occupancy)}`}>{fmtPct(s.occupancy)} ocupado</span>
              <button className="btn sm ghost" onClick={() => setEdit({ ...s.space })}><Pencil size={14} /></button>
              <button className="btn sm ghost danger" onClick={() => remove(s.space)}><Trash2 size={14} /></button>
            </div>
            <p className="muted" style={{ marginTop: -6 }}>{s.space.use}</p>
            <div className="grid g3" style={{ margin: '12px 0' }}>
              <div><div className="small muted">Capacidad</div><b style={{ fontSize: '1.3rem' }}>{s.space.capacity}</b> <span className="muted small">estudiantes</span></div>
              <div><div className="small muted">Horas usadas</div><b style={{ fontSize: '1.3rem' }}>{fmtH(s.used)}</b></div>
              <div><div className="small muted">Horas libres</div><b style={{ fontSize: '1.3rem' }}>{fmtH(Math.max(0, s.avail - s.used))}</b></div>
            </div>
            <Bar max={s.avail} parts={Object.entries(s.byCat).map(([id, h]) => ({ value: h, color: cat(id).color, title: `${cat(id).name}: ${fmtH(h)}` }))} />
            <div className="row small" style={{ marginTop: 8, gap: 12 }}>
              {Object.entries(s.byCat).map(([id, h]) => (
                <span key={id}><span className="dot" style={{ background: cat(id).color }} /> {cat(id).name} {fmtH(h)}</span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 14, alignItems: 'end', height: 70 }}>
              {s.byDay.map((h, i) => (
                <div key={i} style={{ textAlign: 'center' }} title={`${DAYS[i]}: ${fmtH(h)}`}>
                  <div style={{ height: Math.max(3, h * 4.5), background: s.space.color, borderRadius: 4, opacity: 0.85 }} />
                  <div className="small muted">{DAYS[i].slice(0, 2)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h2 className="grow">Horario de atención</h2>
          <span className="muted small">{fmtH(availableHoursPerWeek(p))} disponibles por semana en cada espacio</span>
        </div>
        <div className="grid g4">
          <Text label="Lunes a viernes: abre" type="time" value={p.aperturaSemana} onChange={setP('aperturaSemana')} />
          <Text label="Lunes a viernes: cierra" type="time" value={p.cierreSemana} onChange={setP('cierreSemana')} />
          <Text label="Fin de semana: abre" type="time" value={p.aperturaFinde} onChange={setP('aperturaFinde')} />
          <Text label="Fin de semana: cierra" type="time" value={p.cierreFinde} onChange={setP('cierreFinde')} />
        </div>
      </div>

      {edit && (
        <Modal
          title={edit.id ? `Editar ${edit.name}` : 'Nuevo espacio'}
          onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.name} onClick={() => save(edit)}>Guardar</button></>}
        >
          <Text label="Nombre" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} autoFocus />
          <div className="grid g2">
            <Num label="Capacidad (estudiantes)" value={edit.capacity} onChange={(v) => setEdit({ ...edit, capacity: v })} min={1} />
            <Field label="Color"><input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></Field>
          </div>
          <Text label="Uso principal" area value={edit.use} onChange={(v) => setEdit({ ...edit, use: v })} />
        </Modal>
      )}
    </>
  );
}
