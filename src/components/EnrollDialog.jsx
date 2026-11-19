import { useMemo, useState } from 'react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { installmentRows, money, today, byId } from '../lib/people';
import { Modal, Text, Num, Select, Check } from './ui';

/**
 * Inscribe a un estudiante en un grupo y crea sus cuotas.
 * - Con `lead`: primero crea el estudiante con los datos del interesado.
 * - Con `student`: usa ese estudiante.
 */
export default function EnrollDialog({ lead, student, groupId, onClose, onDone }) {
  const { data, notify } = useStore();
  const groups = useTable('course_groups');
  const courses = useTable('courses');
  const people = useTable('people');
  const [existing, setExisting] = useState('');
  const [s, setS] = useState(
    student || { full_name: lead?.full_name || '', phone: lead?.phone || '', email: lead?.email || '', guardian_name: '', guardian_phone: '', school: '', target: lead?.interested_course || '', notes: '' }
  );
  const [withGroup, setWithGroup] = useState(Boolean(groupId) || !lead);
  const [e, setE] = useState({ group_id: groupId || '', discount: 'none', price: '', installments: '', first_due: today() });
  const [busy, setBusy] = useState(false);
  const cById = useMemo(() => byId(courses.rows), [courses.rows]);
  const open = (groups.rows || []).filter((g) => g.status === 'planned' || g.status === 'active');
  const g = (groups.rows || []).find((x) => String(x.id) === String(e.group_id));
  const course = g && cById[g.course_id];
  const p = data.params;
  const base = course?.price || 0;
  const discounted = Math.round(base * (1 - ({ none: 0, seguidores: p.descSeguidores, preventa: p.descPreventa }[e.discount] ?? 0)));
  const price = e.price === '' ? discounted : Number(e.price);
  const defaultCuotas = course?.course_key?.startsWith('utn-normal') ? p.mesesNormal : course?.course_key?.startsWith('utn-intensivo') ? p.cuotasIntensivo : 1;
  const cuotas = e.installments === '' ? defaultCuotas : Number(e.installments);

  async function save() {
    if (!existing && !s.full_name.trim()) return notify('Escribe el nombre del estudiante', 'bad');
    if (withGroup && !g) return notify('Elige un grupo', 'bad');
    setBusy(true);
    try {
      const st = student || (existing ? (people.rows || []).find((x) => String(x.id) === existing) : await db.add('people', { ...s, person_type: 'student', status: 'active' }));
      if (withGroup) {
        const en = await db.add('enrollments', {
          student_id: st.id, group_id: g.id, status: 'active', agreed_price: price, installments: cuotas,
          discount: e.discount === 'none' ? null : e.discount,
        });
        if (price > 0) await db.addMany('payments', installmentRows(en.id, price, cuotas, e.first_due));
      }
      notify(withGroup ? `${st.full_name} inscrito en ${g.group_name}` : "Estudiante creado");
      await onDone?.(st.id);
    } catch (err) {
      notify(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={student ? `Inscribir a ${student.full_name}` : 'Nuevo estudiante'} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar'}</button></>}>
      {!student && !lead && (people.rows || []).some((x) => x.person_type === 'student') && (
        <Select label="¿Ya está registrado?" value={existing} onChange={setExisting}
          options={[{ value: '', label: 'No, es un estudiante nuevo' }, ...(people.rows || []).filter((x) => x.person_type === 'student' && x.status === 'active').sort((a, b) => a.full_name.localeCompare(b.full_name)).map((x) => ({ value: String(x.id), label: x.full_name }))]} />
      )}
      {!student && !existing && (
        <>
          <div className="grid g3">
            <Text label="Nombre y apellido" value={s.full_name} onChange={(v) => setS({ ...s, full_name: v })} />
            <Text label="Celular" value={s.phone} onChange={(v) => setS({ ...s, phone: v })} />
            <Text label="Correo" value={s.email} onChange={(v) => setS({ ...s, email: v })} />
            <Text label="Representante" value={s.guardian_name} onChange={(v) => setS({ ...s, guardian_name: v })} />
            <Text label="Celular del representante" value={s.guardian_phone} onChange={(v) => setS({ ...s, guardian_phone: v })} />
            <Text label="Colegio" value={s.school} onChange={(v) => setS({ ...s, school: v })} />
          </div>
          <Text label="Universidad / carrera objetivo" value={s.target} onChange={(v) => setS({ ...s, target: v })} />
          {<Check label="Inscribirlo ya en un grupo" checked={withGroup} onChange={setWithGroup} />}
        </>
      )}
      {withGroup && (
        <div className="sub-card">
          {open.length === 0 && groups.rows && <div className="alert warn small">No hay grupos abiertos. Crea uno en la sección Grupos.</div>}
          <div className="grid g2">
            <Select label="Grupo" value={e.group_id} onChange={(v) => setE({ ...e, group_id: v, price: '', installments: '' })}
              options={[{ value: '', label: 'Elige…' }, ...open.map((x) => ({ value: String(x.id), label: `${x.group_name} · ${cById[x.course_id]?.name || ''}` }))]} />
            <Select label="Descuento" value={e.discount} onChange={(v) => setE({ ...e, discount: v, price: '' })} options={[
              { value: 'none', label: 'Sin descuento' },
              { value: 'seguidores', label: `Seguidores (−${Math.round(p.descSeguidores * 100)}%)` },
              { value: 'preventa', label: `Preventa (−${Math.round(p.descPreventa * 100)}%)` },
            ]} />
            <Num label="Precio acordado ($)" value={price} onChange={(v) => setE({ ...e, price: v })} />
            <Num label="Número de cuotas" value={cuotas} min={1} onChange={(v) => setE({ ...e, installments: v })} />
            <Text label="Fecha de la primera cuota" type="date" value={e.first_due} onChange={(v) => setE({ ...e, first_due: v })} />
          </div>
          {g && <div className="small muted">Precio de lista {money(base)} → {cuotas} cuota{cuotas > 1 ? 's' : ''} de {money(price / cuotas)} cada mes.</div>}
        </div>
      )}
    </Modal>
  );
}
