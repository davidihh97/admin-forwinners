import { useMemo, useState } from 'react';
import { Plus, Pencil, UserPlus, Users } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { allCourses } from '../lib/calc';
import { STATUS, STATUS_TAG, byId, fmtDate, ensureCourse, money, today, addDays } from '../lib/people';
import { Modal, PageHead, Seg, Text, Num, Select, Bar } from '../components/ui';
import EnrollDialog from '../components/EnrollDialog';

export default function Groups() {
  const { data, notify } = useStore();
  const groups = useTable('course_groups');
  const courses = useTable('courses');
  const people = useTable('people');
  const enr = useTable('enrollments');
  const [filter, setFilter] = useState('open');
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [enrollTo, setEnrollTo] = useState(null);
  const cById = byId(courses.rows);
  const pById = byId(people.rows);
  const teachers = (people.rows || []).filter((p) => p.person_type === 'teacher' && p.status === 'active');
  const catalog = useMemo(() => allCourses(data), [data]);

  const list = (groups.rows || []).filter((g) => (filter === 'open' ? ['planned', 'active'].includes(g.status) : filter === 'closed' ? !['planned', 'active'].includes(g.status) : true));
  const enrolledIn = (gid) => (enr.rows || []).filter((e) => e.group_id === gid && e.status !== 'cancelled');

  async function save(g) {
    try {
      const course_id = g.course_id || (await ensureCourse(data, g.course_key, courses.rows));
      const payload = { course_id, teacher_id: g.teacher_id || null, group_name: g.group_name, start_date: g.start_date, end_date: g.end_date, capacity: g.capacity || null, status: g.status, schedule_note: g.schedule_note, plan_id: g.plan_id || null };
      const row = g.id ? await db.update('course_groups', g.id, payload) : await db.add('course_groups', payload);
      groups.setRows((rs) => (g.id ? rs.map((x) => (x.id === row.id ? row : x)) : [row, ...rs]));
      courses.reload();
      setEdit(null);
      notify('Grupo guardado');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (groups.error) return <div className="alert bad">{groups.error}</div>;
  if (!groups.rows || !courses.rows) return <div className="empty">Cargando…</div>;

  const newGroup = () => {
    const c = catalog[0];
    setEdit({ course_key: c.id, group_name: '', teacher_id: '', start_date: today(), end_date: addDays(today(), c.weeks * 7), capacity: c.maxStudents || 10, status: 'planned', schedule_note: c.format || '', plan_id: '' });
  };
  const planFor = (key) => (key?.startsWith('utn-normal') ? 'utn-normal' : key?.startsWith('utn-intensivo') ? 'utn-intensivo' : key?.startsWith('razonamiento') ? 'razonamiento' : '');

  return (
    <>
      <PageHead title="Grupos" desc="Cada grupo es un curso que se abre con fecha, profesor y cupo. Aquí ves quién está inscrito y si ya se llegó al mínimo.">
        <button className="btn primary" onClick={newGroup}><Plus size={16} /> Nuevo grupo</button>
      </PageHead>
      <div style={{ marginBottom: 14 }}>
        <Seg value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Abiertos y en curso' }, { value: 'closed', label: 'Terminados' }, { value: 'all', label: 'Todos' }]} />
      </div>
      <div className="grid g3">
        {list.map((g) => {
          const n = enrolledIn(g.id).length;
          const cap = g.capacity || 10;
          const min = data.params.cupoMinimo;
          return (
            <div key={g.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setDetail(g)}>
              <div className="card-h" style={{ marginBottom: 6 }}>
                <h2 className="grow">{g.group_name}</h2>
                <span className={`chip ${STATUS_TAG[g.status]}`}>{STATUS.group[g.status]}</span>
              </div>
              <div className="small muted">{cById[g.course_id]?.name}</div>
              <div className="small" style={{ margin: '8px 0' }}>
                {fmtDate(g.start_date)} → {fmtDate(g.end_date)}<br />
                👩‍🏫 {pById[g.teacher_id]?.full_name || <span className="muted">Sin profesor</span>}
                {g.schedule_note && <><br />🕒 {g.schedule_note}</>}
              </div>
              <div className="row small" style={{ marginBottom: 4 }}>
                <Users size={14} /> <b>{n}</b> de {cap}
                <span className={`chip right ${n >= min ? 'tag-ok' : 'tag-warn'}`}>{n >= min ? 'Cupo mínimo alcanzado' : `Faltan ${min - n} para abrir`}</span>
              </div>
              <Bar max={cap} parts={[{ value: n, color: n >= min ? '#059669' : '#d97706' }]} />
            </div>
          );
        })}
      </div>
      {list.length === 0 && <div className="card empty">No hay grupos aquí. Crea uno con «Nuevo grupo».</div>}

      {edit && (
        <Modal title={edit.id ? 'Editar grupo' : 'Nuevo grupo'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.group_name} onClick={() => save(edit)}>Guardar</button></>}>
          {!edit.id && (
            <Select label="Curso" value={edit.course_key} onChange={(v) => {
              const c = catalog.find((x) => x.id === v);
              setEdit({ ...edit, course_key: v, capacity: c.maxStudents || 10, schedule_note: c.format || '', end_date: addDays(edit.start_date, c.weeks * 7), plan_id: planFor(v) });
            }} options={catalog.map((c) => ({ value: c.id, label: `${c.name} · ${money(c.price)}` }))} />
          )}
          <Text label="Nombre del grupo" placeholder="Ej.: UTN Normal FICA · enero 2027" value={edit.group_name} onChange={(v) => setEdit({ ...edit, group_name: v })} />
          <div className="grid g2">
            <Text label="Inicio" type="date" value={edit.start_date} onChange={(v) => setEdit({ ...edit, start_date: v })} />
            <Text label="Fin" type="date" value={edit.end_date} onChange={(v) => setEdit({ ...edit, end_date: v })} />
            <Select label="Profesor" value={String(edit.teacher_id || '')} onChange={(v) => setEdit({ ...edit, teacher_id: v ? Number(v) : '' })} options={[{ value: '', label: 'Sin asignar' }, ...teachers.map((t) => ({ value: String(t.id), label: t.full_name }))]} />
            <Num label="Cupo máximo" value={edit.capacity} onChange={(v) => setEdit({ ...edit, capacity: v })} />
            <Select label="Plan de clases" value={edit.plan_id || ''} onChange={(v) => setEdit({ ...edit, plan_id: v })} options={[{ value: '', label: 'Ninguno' }, ...data.plans.map((p) => ({ value: p.id, label: p.name }))]} />
            <Select label="Estado" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={Object.entries(STATUS.group).map(([value, label]) => ({ value, label }))} />
          </div>
          <Text label="Horario" value={edit.schedule_note} onChange={(v) => setEdit({ ...edit, schedule_note: v })} />
          {!teachers.length && <div className="small muted">Para asignar profesor, agrégalo primero en la sección Profesores.</div>}
        </Modal>
      )}

      {detail && (
        <Modal title={detail.group_name} onClose={() => setDetail(null)} wide
          footer={<><button className="btn" onClick={() => { setEdit({ ...detail }); setDetail(null); }}><Pencil size={14} /> Editar grupo</button><span className="grow" /><button className="btn primary" onClick={() => { setEnrollTo(detail.id); setDetail(null); }}><UserPlus size={15} /> Inscribir estudiante</button></>}>
          <div className="small muted">{cById[detail.course_id]?.name} · {fmtDate(detail.start_date)} → {fmtDate(detail.end_date)}</div>
          <table className="t">
            <thead><tr><th>Estudiante</th><th>Celular</th><th>Estado</th><th className="num">Precio</th></tr></thead>
            <tbody>
              {(enr.rows || []).filter((e) => e.group_id === detail.id).map((e) => (
                <tr key={e.id}>
                  <td><b>{pById[e.student_id]?.full_name}</b></td>
                  <td className="small">{pById[e.student_id]?.phone}</td>
                  <td><span className={`chip ${STATUS_TAG[e.status]}`}>{STATUS.enrollment[e.status]}</span></td>
                  <td className="num">{money(e.agreed_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!enrolledIn(detail.id).length && <div className="empty">Aún no hay inscritos.</div>}
        </Modal>
      )}

      {enrollTo && (
        <EnrollDialog
          groupId={String(enrollTo)}
          onClose={() => setEnrollTo(null)}
          onDone={() => { setEnrollTo(null); people.reload(); enr.reload(); }}
        />
      )}
    </>
  );
}
