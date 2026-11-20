import { useMemo, useState } from 'react';
import { Plus, Search, MessageCircle, Pencil, UserPlus } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { STATUS, STATUS_TAG, byId, money, fmtDate, waLink, firstName, today } from '../lib/people';
import { Modal, PageHead, Seg, Text, Kpi } from '../components/ui';
import EnrollDialog from '../components/EnrollDialog';

export default function Students() {
  const { notify } = useStore();
  const people = useTable('people');
  const enr = useTable('enrollments');
  const groups = useTable('course_groups');
  const pays = useTable('payments');
  const att = useTable('attendance');
  const scores = useTable('exam_scores');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('active');
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [enroll, setEnroll] = useState(null);

  const students = (people.rows || []).filter((p) => p.person_type === 'student');
  const gById = byId(groups.rows);
  const info = useMemo(() => {
    const m = {};
    for (const s of students) m[s.id] = { enr: [], due: 0, overdue: 0, paid: 0, att: [0, 0], scores: [] };
    for (const e of enr.rows || []) if (m[e.student_id]) m[e.student_id].enr.push(e);
    const eById = byId(enr.rows);
    const t = today();
    for (const p of pays.rows || []) {
      const e = eById[p.enrollment_id];
      if (!e || !m[e.student_id]) continue;
      if (p.status === 'paid') m[e.student_id].paid += p.amount;
      if (p.status === 'pending') {
        m[e.student_id].due += p.amount;
        if (p.due_date && p.due_date < t) m[e.student_id].overdue += p.amount;
      }
    }
    for (const a of att.rows || []) if (m[a.student_id]) { m[a.student_id].att[1]++; if (a.status !== 'absent') m[a.student_id].att[0]++; }
    for (const x of scores.rows || []) if (m[x.student_id]) m[x.student_id].scores.push(x);
    return m;
  }, [students, enr.rows, pays.rows, att.rows, scores.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = students
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => !q || `${s.full_name} ${s.phone} ${s.email} ${s.school} ${s.target}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  async function save(s) {
    try {
      if (s.id) {
        const row = await db.update('people', s.id, s);
        people.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
      } else {
        const row = await db.add('people', { ...s, person_type: 'student', status: 'active' });
        people.setRows((rs) => [row, ...rs]);
      }
      setEdit(null);
      notify('Estudiante guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (people.error) return <div className="alert bad">{people.error}</div>;
  if (!people.rows) return <div className="empty">Cargando…</div>;
  const activeN = students.filter((s) => s.status === 'active').length;
  const overdue = Object.values(info).reduce((a, x) => a + x.overdue, 0);

  return (
    <>
      <PageHead title="Estudiantes" desc="Fichas, cursos, pagos, horas de asistencia y notas de cada estudiante.">
        <button className="btn primary" onClick={() => setEnroll({})}><Plus size={16} /> Nuevo estudiante</button>
      </PageHead>
      <div className="grid g4 kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Estudiantes activos" value={activeN} />
        <Kpi label="Inscripciones activas" value={(enr.rows || []).filter((e) => e.status === 'active').length} />
        <Kpi label="Por cobrar" value={money(Object.values(info).reduce((a, x) => a + x.due, 0))} />
        <Kpi label="Vencido" value={money(overdue)} sub={overdue ? 'Ver Pagos y cuotas' : 'Al día'} />
      </div>
      <div className="card table-wrap">
        <div className="card-h">
          <Seg value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }, { value: 'all', label: 'Todos' }]} />
          <div className="row grow" style={{ maxWidth: 360 }}>
            <Search size={16} className="muted" />
            <input className="input grow" placeholder="Buscar estudiante…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <table className="t">
          <thead><tr><th>Estudiante</th><th>Cursos</th><th className="num">Asistencia</th><th className="num">Promedio</th><th className="num">Pagado</th><th className="num">Debe</th><th /></tr></thead>
          <tbody>
            {list.map((s) => {
              const x = info[s.id] || { enr: [], att: [0, 0], scores: [] };
              const avg = x.scores.length ? x.scores.reduce((a, r) => a + (r.score / r.max_score) * 100, 0) / x.scores.length : null;
              return (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(s)}>
                  <td><b>{s.full_name}</b><div className="small muted">{s.phone || s.email || ''}</div></td>
                  <td className="small">{x.enr.filter((e) => e.status === 'active').map((e) => gById[e.group_id]?.group_name).filter(Boolean).join(', ') || <span className="muted">—</span>}</td>
                  <td className="num">{x.att[1] ? `${Math.round((x.att[0] / x.att[1]) * 100)}%` : '—'}</td>
                  <td className="num">{avg != null ? `${Math.round(avg)}/100` : '—'}</td>
                  <td className="num">{money(x.paid)}</td>
                  <td className="num">{x.overdue ? <span className="chip tag-bad">{money(x.due)}</span> : money(x.due)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      {waLink(s.phone) && <a className="btn sm ghost icon" href={waLink(s.phone, `Hola ${firstName(s.full_name)}, `)} target="_blank" rel="noopener" title="WhatsApp"><MessageCircle size={14} /></a>}
                      <button className="btn sm ghost icon" onClick={() => setEdit({ ...s })} title="Editar"><Pencil size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty">{students.length ? 'Sin resultados.' : 'Aún no hay estudiantes. Agrégalos aquí o inscríbelos desde Interesados.'}</div>}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Editar estudiante' : 'Nuevo estudiante'} onClose={() => setEdit(null)} wide
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.full_name} onClick={() => save(edit)}>Guardar</button></>}>
          <div className="grid g3">
            <Text label="Nombre y apellido" value={edit.full_name} onChange={(v) => setEdit({ ...edit, full_name: v })} />
            <Text label="Celular" value={edit.phone} onChange={(v) => setEdit({ ...edit, phone: v })} />
            <Text label="Correo" value={edit.email} onChange={(v) => setEdit({ ...edit, email: v })} />
            <Text label="Representante" value={edit.guardian_name} onChange={(v) => setEdit({ ...edit, guardian_name: v })} />
            <Text label="Celular del representante" value={edit.guardian_phone} onChange={(v) => setEdit({ ...edit, guardian_phone: v })} />
            <Text label="Colegio" value={edit.school} onChange={(v) => setEdit({ ...edit, school: v })} />
          </div>
          <Text label="Universidad / carrera objetivo" value={edit.target} onChange={(v) => setEdit({ ...edit, target: v })} />
          <Text label="Notas" area value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
          <div className="small muted">Estado</div>
          <Seg value={edit.status || 'active'} onChange={(v) => setEdit({ ...edit, status: v })} options={[{ value: 'active', label: 'Activo' }, { value: 'inactive', label: 'Inactivo' }]} />
        </Modal>
      )}

      {detail && (
        <Modal title={detail.full_name} onClose={() => setDetail(null)} wide
          footer={<><button className="btn" onClick={() => { setEdit({ ...detail }); setDetail(null); }}><Pencil size={14} /> Editar ficha</button><span className="grow" /><button className="btn primary" onClick={() => { setEnroll({ student: detail }); setDetail(null); }}><UserPlus size={15} /> Inscribir en un curso</button></>}>
          <div className="row small muted">
            {detail.phone && <span>📱 {detail.phone}</span>}{detail.email && <span>✉️ {detail.email}</span>}{detail.school && <span>🏫 {detail.school}</span>}{detail.target && <span>🎯 {detail.target}</span>}
            {detail.guardian_name && <span>👪 {detail.guardian_name} {detail.guardian_phone}</span>}
          </div>
          {detail.notes && <div className="sub-card small">{detail.notes}</div>}
          <b>Inscripciones</b>
          {(info[detail.id]?.enr || []).map((e) => {
            const ps = (pays.rows || []).filter((p) => p.enrollment_id === e.id).sort((a, b) => (a.installment_no || 0) - (b.installment_no || 0));
            return (
              <div key={e.id} className="sub-card">
                <div className="row">
                  <b className="grow">{gById[e.group_id]?.group_name || 'Curso'}</b>
                  <span className={`chip ${STATUS_TAG[e.status]}`}>{STATUS.enrollment[e.status]}</span>
                  <span className="small">{money(e.agreed_price)}{e.discount ? ` (${e.discount})` : ''}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {ps.map((p) => <span key={p.id} className={`chip ${STATUS_TAG[p.status === 'pending' && p.due_date < today() ? 'cancelled' : p.status]}`} title={`Vence ${fmtDate(p.due_date)}`}>#{p.installment_no || '·'} {money(p.amount)}</span>)}
                </div>
                <div className="row">
                  {['active', 'completed', 'cancelled'].filter((st) => st !== e.status).map((st) => (
                    <button key={st} className="btn sm ghost" onClick={async () => { const row = await db.update('enrollments', e.id, { status: st }); enr.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x))); }}>Marcar «{STATUS.enrollment[st]}»</button>
                  ))}
                </div>
              </div>
            );
          })}
          {!(info[detail.id]?.enr || []).length && <div className="small muted">Sin inscripciones.</div>}
          {(info[detail.id]?.scores || []).length > 0 && (
            <>
              <b>Notas</b>
              <div className="row" style={{ gap: 6 }}>
                {info[detail.id].scores.map((x) => <span key={x.id} className="chip tag-info">{x.exam_name}: {x.score}/{x.max_score}</span>)}
              </div>
            </>
          )}
        </Modal>
      )}

      {enroll && (
        <EnrollDialog
          student={enroll.student}
          onClose={() => setEnroll(null)}
          onDone={() => { setEnroll(null); people.reload(); enr.reload(); pays.reload(); groups.reload(); }}
        />
      )}
    </>
  );
}
