import { useMemo, useState } from 'react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { allCourses } from '../lib/calc';
import { installmentRows, money, today, ensureCourseGroup } from '../lib/people';
import { Modal, Text, Num, Select, Check } from './ui';

/**
 * Inscribe a un estudiante en un curso y crea sus cuotas.
 * - Con `lead`: primero crea el estudiante con los datos del interesado.
 * - Con `student`: usa ese estudiante.
 */
export default function EnrollDialog({ lead, student, onClose, onDone }) {
  const { data, notify } = useStore();
  const groups = useTable('course_groups');
  const courses = useTable('courses');
  const people = useTable('people');
  const catalog = useMemo(() => allCourses(data), [data]);
  const [existing, setExisting] = useState('');
  const [s, setS] = useState(
    student || { full_name: lead?.full_name || '', phone: lead?.phone || '', email: lead?.email || '', guardian_name: '', guardian_phone: '', school: '', target: lead?.interested_course || '', notes: '' }
  );
  const [withCourse, setWithCourse] = useState(!lead);
  const [e, setE] = useState({ course: '', discount: 'none', price: '', installments: '', first_due: today() });
  const [busy, setBusy] = useState(false);
  const course = catalog.find((c) => c.id === e.course);
  const p = data.params;
  const base = course?.price || 0;
  const discounted = Math.round(base * (1 - ({ none: 0, seguidores: p.descSeguidores, preventa: p.descPreventa }[e.discount] ?? 0)));
  const price = e.price === '' ? discounted : Number(e.price);
  const defaultCuotas = e.course.startsWith('utn-normal') ? p.mesesNormal : e.course.startsWith('utn-intensivo') ? p.cuotasIntensivo : 1;
  const cuotas = e.installments === '' ? defaultCuotas : Number(e.installments);
  const groupsOf = [...new Set(catalog.map((c) => c.group))];

  async function save() {
    if (!student && !existing && !s.full_name.trim()) return notify('Escribe el nombre del estudiante', 'bad');
    if (withCourse && !course) return notify('Elige un curso', 'bad');
    if (!groups.rows || !courses.rows) return notify('Espera un momento, cargando cursos…', 'bad');
    setBusy(true);
    try {
      const st = student || (existing ? (people.rows || []).find((x) => String(x.id) === existing) : await db.add('people', { ...s, person_type: 'student', status: 'active' }));
      if (withCourse) {
        const g = await ensureCourseGroup(data, course.id, courses.rows, groups.rows);
        const en = await db.add('enrollments', {
          student_id: st.id, group_id: g.id, status: 'active', agreed_price: price, installments: cuotas,
          discount: e.discount === 'none' ? null : e.discount,
        });
        if (price > 0) await db.addMany('payments', installmentRows(en.id, price, cuotas, e.first_due));
      }
      notify(withCourse ? `${st.full_name} inscrito en ${course.name}` : 'Estudiante creado');
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
          <Check label="Inscribirlo ya en un curso" checked={withCourse} onChange={setWithCourse} />
        </>
      )}
      {withCourse && (
        <div className="sub-card">
          <div className="grid g2">
            <label className="field">
              <span>Curso</span>
              <select id="enroll-course" value={e.course} onChange={(ev) => setE({ ...e, course: ev.target.value, price: '', installments: '' })}>
                <option value="">Elige…</option>
                {groupsOf.map((gName) => (
                  <optgroup key={gName} label={gName}>
                    {catalog.filter((c) => c.group === gName).map((c) => <option key={c.id} value={c.id}>{c.name} · {money(c.price)}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <Select label="Descuento" value={e.discount} onChange={(v) => setE({ ...e, discount: v, price: '' })} options={[
              { value: 'none', label: 'Sin descuento' },
              { value: 'seguidores', label: `Seguidores (−${Math.round(p.descSeguidores * 100)}%)` },
              { value: 'preventa', label: `Preventa (−${Math.round(p.descPreventa * 100)}%)` },
            ]} />
            <Num label="Precio acordado ($)" value={price} onChange={(v) => setE({ ...e, price: v })} />
            <Num label="Número de cuotas" value={cuotas} min={1} onChange={(v) => setE({ ...e, installments: v })} />
            <Text label="Fecha de la primera cuota" type="date" value={e.first_due} onChange={(v) => setE({ ...e, first_due: v })} />
          </div>
          {course && <div className="small muted">Precio de lista {money(base)} → {cuotas} cuota{cuotas > 1 ? 's' : ''} de {money(price / cuotas)} cada mes.</div>}
        </div>
      )}
    </Modal>
  );
}
