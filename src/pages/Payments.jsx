import { useMemo, useState } from 'react';
import { Search, MessageCircle, Check, Pencil, Plus } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { STATUS, STATUS_TAG, byId, money, fmtDate, today, waLink, firstName, daysBetween } from '../lib/people';
import { Modal, PageHead, Seg, Text, Num, Select, Kpi } from '../components/ui';

const METHODS = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta', 'Otro'];

export default function Payments() {
  const { notify } = useStore();
  const pays = useTable('payments');
  const enr = useTable('enrollments');
  const people = useTable('people');
  const groups = useTable('course_groups');
  const [filter, setFilter] = useState('pending');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const eById = byId(enr.rows);
  const pById = byId(people.rows);
  const gById = byId(groups.rows);
  const t = today();
  const month = t.slice(0, 7);

  const rows = useMemo(() => (pays.rows || []).map((p) => {
    const e = eById[p.enrollment_id] || {};
    const s = pById[e.student_id] || {};
    const late = p.status === 'pending' && p.due_date && p.due_date < t;
    return { ...p, student: s, group: gById[e.group_id] || {}, enrollment: e, late, lateDays: late ? daysBetween(p.due_date, t) : 0 };
  }), [pays.rows, eById, pById, gById, t]);

  const shown = rows
    .filter((p) => (filter === 'pending' ? p.status === 'pending' : filter === 'late' ? p.late : filter === 'paid' ? p.status === 'paid' : true))
    .filter((p) => !q || `${p.student.full_name} ${p.group.group_name} ${p.reference}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (filter === 'paid' ? String(b.payment_date).localeCompare(String(a.payment_date)) : String(a.due_date || '').localeCompare(String(b.due_date || ''))));

  const kpi = {
    month: rows.filter((p) => p.status === 'paid' && String(p.payment_date || '').startsWith(month)).reduce((a, p) => a + p.amount, 0),
    pending: rows.filter((p) => p.status === 'pending').reduce((a, p) => a + p.amount, 0),
    late: rows.filter((p) => p.late).reduce((a, p) => a + p.amount, 0),
    lateN: new Set(rows.filter((p) => p.late).map((p) => p.student.id)).size,
    soon: rows.filter((p) => p.status === 'pending' && p.due_date >= t && daysBetween(t, p.due_date) <= 7).reduce((a, p) => a + p.amount, 0),
  };

  async function save(p) {
    try {
      const payload = { amount: Number(p.amount), due_date: p.due_date, payment_date: p.status === 'paid' ? p.payment_date || t : null, payment_method: p.payment_method, reference: p.reference, status: p.status, notes: p.notes, installment_no: p.installment_no, enrollment_id: Number(p.enrollment_id) };
      const row = p.id ? await db.update('payments', p.id, payload) : await db.add('payments', payload);
      pays.setRows((rs) => (p.id ? rs.map((x) => (x.id === row.id ? row : x)) : [row, ...rs]));
      setEdit(null);
      notify(p.status === 'paid' ? 'Pago registrado' : 'Guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (pays.error) return <div className="alert bad">{pays.error}</div>;
  if (!pays.rows || !enr.rows || !people.rows) return <div className="empty">Cargando…</div>;

  return (
    <>
      <PageHead title="Pagos y cuotas" desc="Las cuotas se crean solas al inscribir a un estudiante. Aquí registras cada pago y ves quién está atrasado.">
        <button className="btn" onClick={() => setEdit({ enrollment_id: '', amount: '', due_date: t, status: 'paid', payment_date: t, payment_method: 'Efectivo' })}><Plus size={16} /> Registrar pago suelto</button>
      </PageHead>
      <div className="grid g4 kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Cobrado este mes" value={money(kpi.month)} />
        <Kpi label="Vence en 7 días" value={money(kpi.soon)} />
        <Kpi label="Vencido" value={money(kpi.late)} sub={`${kpi.lateN} estudiante${kpi.lateN === 1 ? '' : 's'}`} />
        <Kpi label="Total por cobrar" value={money(kpi.pending)} />
      </div>
      <div className="card table-wrap">
        <div className="card-h">
          <Seg value={filter} onChange={setFilter} options={[{ value: 'pending', label: 'Pendientes' }, { value: 'late', label: 'Vencidas' }, { value: 'paid', label: 'Pagadas' }, { value: 'all', label: 'Todas' }]} />
          <div className="row grow" style={{ maxWidth: 340 }}>
            <Search size={16} className="muted" />
            <input className="input grow" placeholder="Buscar estudiante o grupo…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <table className="t">
          <thead><tr><th>Estudiante</th><th>Grupo</th><th className="num">Cuota</th><th className="num">Monto</th><th>Vence</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => {
              const phone = p.student.phone || p.student.guardian_phone;
              const msg = `Hola ${firstName(p.student.guardian_name || p.student.full_name)}, te recordamos de For Winners que la cuota ${p.installment_no || ''} de ${money(p.amount)} de ${p.group.group_name || 'tu curso'} ${p.late ? `venció el ${fmtDate(p.due_date)}` : `vence el ${fmtDate(p.due_date)}`}. ¡Gracias!`;
              return (
                <tr key={p.id}>
                  <td><b>{p.student.full_name || '—'}</b></td>
                  <td className="small">{p.group.group_name}</td>
                  <td className="num">{p.installment_no ? `${p.installment_no}/${p.enrollment.installments || '?'}` : '—'}</td>
                  <td className="num"><b>{money(p.amount)}</b></td>
                  <td className="small">{p.status === 'paid' ? `Pagó ${fmtDate(p.payment_date)}` : fmtDate(p.due_date)}{p.late && <div className="chip tag-bad">{p.lateDays} días tarde</div>}</td>
                  <td><span className={`chip ${STATUS_TAG[p.late ? 'cancelled' : p.status]}`}>{p.late ? 'Vencida' : STATUS.payment[p.status]}</span></td>
                  <td>
                    <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      {p.status === 'pending' && <button className="btn sm" onClick={() => setEdit({ ...p, status: 'paid', payment_date: t, payment_method: p.payment_method || 'Efectivo' })}><Check size={14} /> Cobrar</button>}
                      {p.status === 'pending' && waLink(phone) && <a className="btn sm ghost icon" href={waLink(phone, msg)} target="_blank" rel="noopener" title="Recordar por WhatsApp"><MessageCircle size={14} /></a>}
                      <button className="btn sm ghost icon" onClick={() => setEdit({ ...p })} title="Editar"><Pencil size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <div className="empty">{filter === 'late' ? '¡Nadie está atrasado!' : 'No hay pagos aquí.'}</div>}
      </div>

      {edit && (
        <Modal title={edit.id ? `Cuota de ${edit.student?.full_name || ''}` : 'Registrar pago'} onClose={() => setEdit(null)}
          footer={<>{edit.id && <button className="btn danger" onClick={async () => { if (!confirm('¿Anular esta cuota?')) return; await save({ ...edit, status: 'void' }); }}>Anular</button>}<span className="grow" /><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.enrollment_id || !edit.amount} onClick={() => save(edit)}>Guardar</button></>}>
          {!edit.id && (
            <Select label="Inscripción" value={String(edit.enrollment_id)} onChange={(v) => setEdit({ ...edit, enrollment_id: v })}
              options={[{ value: '', label: 'Elige estudiante y grupo…' }, ...(enr.rows || []).filter((e) => e.status !== 'cancelled').map((e) => ({ value: String(e.id), label: `${pById[e.student_id]?.full_name} · ${gById[e.group_id]?.group_name}` }))]} />
          )}
          <div className="grid g2">
            <Num label="Monto ($)" value={edit.amount} onChange={(v) => setEdit({ ...edit, amount: v })} />
            <Text label="Vence" type="date" value={edit.due_date} onChange={(v) => setEdit({ ...edit, due_date: v })} />
          </div>
          <Seg value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={[{ value: 'pending', label: 'Pendiente' }, { value: 'paid', label: 'Pagado' }]} />
          {edit.status === 'paid' && (
            <div className="grid g3">
              <Text label="Fecha de pago" type="date" value={edit.payment_date} onChange={(v) => setEdit({ ...edit, payment_date: v })} />
              <Select label="Forma de pago" value={edit.payment_method} onChange={(v) => setEdit({ ...edit, payment_method: v })} options={METHODS} />
              <Text label="N.º de comprobante" value={edit.reference} onChange={(v) => setEdit({ ...edit, reference: v })} />
            </div>
          )}
          <Text label="Notas" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
        </Modal>
      )}
    </>
  );
}
