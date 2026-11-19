import { useMemo, useState } from 'react';
import { Plus, Pencil, MessageCircle, Check } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { byId, money, today, waLink, firstName, fmtDate } from '../lib/people';
import { Modal, PageHead, Text, Num, Seg, Kpi } from '../components/ui';
import { toMin } from '../lib/time';

const hoursOf = (s) => (s.start_time && s.end_time ? Math.max(0, (toMin(s.end_time) - toMin(s.start_time)) / 60) : 0);
const monthLabel = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });

export default function Teachers() {
  const { data, notify } = useStore();
  const people = useTable('people');
  const groups = useTable('course_groups');
  const sessions = useTable('class_sessions');
  const payouts = useTable('teacher_payouts');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [edit, setEdit] = useState(null);
  const gById = byId(groups.rows);
  const teachers = (people.rows || []).filter((p) => p.person_type === 'teacher');

  const stats = useMemo(() => {
    const m = {};
    for (const t of teachers) m[t.id] = { hours: 0, sessions: 0, noTime: 0, groups: (groups.rows || []).filter((g) => g.teacher_id === t.id && ['planned', 'active'].includes(g.status)) };
    for (const s of sessions.rows || []) {
      if (!String(s.session_date).startsWith(month)) continue;
      const tid = s.teacher_id || gById[s.group_id]?.teacher_id;
      if (!m[tid]) continue;
      m[tid].sessions++;
      const h = hoursOf(s);
      m[tid].hours += h;
      if (!h) m[tid].noTime++;
    }
    return m;
  }, [teachers, sessions.rows, groups.rows, month, gById]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = (t) => t.hourly_rate ?? data.params.costoProfesorHora;
  const payoutOf = (t) => (payouts.rows || []).find((p) => p.teacher_id === t.id && p.period === month);
  const total = teachers.reduce((a, t) => a + (stats[t.id]?.hours || 0) * rate(t), 0);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - i); return d.toLocaleDateString('en-CA').slice(0, 7); });

  async function save(t) {
    try {
      const row = t.id ? await db.update('people', t.id, t) : await db.add('people', { ...t, person_type: 'teacher', status: 'active' });
      people.setRows((rs) => (t.id ? rs.map((x) => (x.id === row.id ? row : x)) : [row, ...rs]));
      setEdit(null);
      notify('Profesor guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }
  async function pay(t) {
    const st = stats[t.id];
    try {
      await db.add('teacher_payouts', { teacher_id: t.id, period: month, hours: st.hours, amount: Math.round(st.hours * rate(t) * 100) / 100, paid_at: today() });
      payouts.reload();
      notify(`Pago a ${t.full_name} registrado`);
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (people.error) return <div className="alert bad">{people.error}</div>;
  if (!people.rows) return <div className="empty">Cargando…</div>;

  return (
    <>
      <PageHead title="Profesores" desc="Las horas salen de las clases registradas en Asistencia (con hora de inicio y fin).">
        <button className="btn primary" onClick={() => setEdit({ full_name: '', phone: '', email: '', subjects: '', hourly_rate: data.params.costoProfesorHora, notes: '' })}><Plus size={16} /> Nuevo profesor</button>
      </PageHead>
      <div className="card" style={{ marginBottom: 14 }}>
        <Seg value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
      </div>
      <div className="grid g3 kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Profesores activos" value={teachers.filter((t) => t.status === 'active').length} />
        <Kpi label={`Horas dictadas en ${monthLabel(month)}`} value={`${Math.round(teachers.reduce((a, t) => a + (stats[t.id]?.hours || 0), 0) * 10) / 10} h`} />
        <Kpi label="A pagar en el mes" value={money(total)} />
      </div>
      <div className="grid g3">
        {teachers.map((t) => {
          const st = stats[t.id] || { hours: 0, sessions: 0, noTime: 0, groups: [] };
          const po = payoutOf(t);
          return (
            <div key={t.id} className="card">
              <div className="card-h" style={{ marginBottom: 4 }}>
                <h2 className="grow">{t.full_name}</h2>
                {waLink(t.phone) && <a className="btn sm ghost icon" href={waLink(t.phone, `Hola ${firstName(t.full_name)}, `)} target="_blank" rel="noopener"><MessageCircle size={14} /></a>}
                <button className="btn sm ghost icon" onClick={() => setEdit({ ...t })}><Pencil size={14} /></button>
              </div>
              <div className="small muted">{t.subjects || 'Materias sin indicar'} · {money(rate(t))}/h</div>
              <div className="small" style={{ margin: '8px 0' }}>Grupos: {st.groups.map((g) => g.group_name).join(', ') || <span className="muted">ninguno</span>}</div>
              <div className="row">
                <div><div className="small muted">Clases</div><b>{st.sessions}</b></div>
                <div><div className="small muted">Horas</div><b>{Math.round(st.hours * 10) / 10}</b></div>
                <div><div className="small muted">A pagar</div><b>{money(st.hours * rate(t))}</b></div>
              </div>
              {st.noTime > 0 && <div className="small" style={{ color: '#b45309', marginTop: 6 }}>{st.noTime} clase(s) sin hora de inicio/fin: no se cuentan.</div>}
              <div style={{ marginTop: 10 }}>
                {po ? <span className="chip tag-ok"><Check size={13} /> Pagado {money(po.amount)} el {fmtDate(po.paid_at)}</span>
                  : <button className="btn sm" disabled={!st.hours} onClick={() => pay(t)}>Registrar pago del mes</button>}
              </div>
            </div>
          );
        })}
      </div>
      {!teachers.length && <div className="card empty">Agrega a tus profesores para asignarlos a grupos y calcular sus pagos.</div>}

      {edit && (
        <Modal title={edit.id ? 'Editar profesor' : 'Nuevo profesor'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.full_name} onClick={() => save(edit)}>Guardar</button></>}>
          <div className="grid g2">
            <Text label="Nombre y apellido" value={edit.full_name} onChange={(v) => setEdit({ ...edit, full_name: v })} />
            <Text label="Celular" value={edit.phone} onChange={(v) => setEdit({ ...edit, phone: v })} />
            <Text label="Correo" value={edit.email} onChange={(v) => setEdit({ ...edit, email: v })} />
            <Num label="Pago por hora ($)" value={edit.hourly_rate} onChange={(v) => setEdit({ ...edit, hourly_rate: v })} />
          </div>
          <Text label="Materias que dicta" value={edit.subjects} onChange={(v) => setEdit({ ...edit, subjects: v })} placeholder="Matemática, Física" />
          <Text label="Notas" area value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
          {edit.id && <Seg value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={[{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }]} />}
        </Modal>
      )}
    </>
  );
}
