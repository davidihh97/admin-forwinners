import { useEffect, useMemo, useState } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { byId, fmtDate, today } from '../lib/people';
import { Modal, PageHead, Select, Text, Num } from '../components/ui';

const pct = (r) => (r.max_score ? (r.score / r.max_score) * 100 : 0);
const tone = (p) => (p >= 80 ? 'tag-ok' : p >= 60 ? 'tag-warn' : 'tag-bad');

export default function Grades() {
  const { notify } = useStore();
  const groups = useTable('course_groups');
  const people = useTable('people');
  const enr = useTable('enrollments');
  const scores = useTable('exam_scores');
  const [groupId, setGroupId] = useState('');
  const [entry, setEntry] = useState(null);
  const pById = byId(people.rows);
  const list = (groups.rows || []).filter((g) => g.status !== 'cancelled');
  useEffect(() => { if (!groupId && list[0]) setGroupId(String(list[0].id)); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = (enr.rows || []).filter((e) => String(e.group_id) === groupId && e.status !== 'cancelled').map((e) => pById[e.student_id]).filter(Boolean)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const gScores = (scores.rows || []).filter((s) => String(s.group_id) === groupId);
  const exams = useMemo(() => {
    const m = new Map();
    for (const s of gScores) if (!m.has(s.exam_name)) m.set(s.exam_name, s.exam_date || '');
    return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([n]) => n);
  }, [gScores]);
  const cell = (sid, ex) => gScores.find((s) => s.student_id === sid && s.exam_name === ex);

  async function saveEntry() {
    const rows = students.filter((s) => entry.values[s.id] !== undefined && entry.values[s.id] !== '').map((s) => ({
      student_id: s.id, group_id: Number(groupId), exam_name: entry.name, exam_date: entry.date, score: Number(entry.values[s.id]), max_score: Number(entry.max),
    }));
    if (!rows.length) return notify('Escribe al menos una nota', 'bad');
    try {
      // Si ya había nota de esa prueba para el estudiante, se reemplaza.
      for (const r of rows) { const old = cell(r.student_id, r.exam_name); if (old) await db.remove('exam_scores', old.id); }
      await db.addMany('exam_scores', rows);
      scores.reload();
      setEntry(null);
      notify('Notas guardadas');
    } catch (e) { notify(e.message, 'bad'); }
  }

  if (groups.error) return <div className="alert bad">{groups.error}</div>;
  if (!groups.rows || !people.rows) return <div className="empty">Cargando…</div>;
  if (!list.length) return <><PageHead title="Notas de simulacros" /><div className="card empty">Primero inscribe estudiantes en un curso (Estudiantes → Inscribir).</div></>;

  return (
    <>
      <PageHead title="Notas de simulacros" desc="Registra cada simulacro o prueba y mira cómo avanza cada estudiante.">
        <button className="btn primary" onClick={() => setEntry({ name: `Simulacro ${exams.length + 1}`, date: today(), max: 100, values: {} })}><Plus size={16} /> Registrar notas</button>
      </PageHead>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ maxWidth: 320 }}><Select label="Curso" value={groupId} onChange={setGroupId} options={list.map((g) => ({ value: String(g.id), label: g.group_name }))} /></div>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr><th>Estudiante</th>{exams.map((e) => <th key={e} className="num">{e}</th>)}<th className="num">Promedio</th><th className="num">Avance</th></tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const rs = exams.map((e) => cell(s.id, e)).filter(Boolean);
              const avg = rs.length ? rs.reduce((a, r) => a + pct(r), 0) / rs.length : null;
              const diff = rs.length > 1 ? pct(rs[rs.length - 1]) - pct(rs[0]) : null;
              return (
                <tr key={s.id}>
                  <td><b>{s.full_name}</b></td>
                  {exams.map((e) => { const r = cell(s.id, e); return <td key={e} className="num">{r ? <span className={`chip ${tone(pct(r))}`}>{r.score}/{r.max_score}</span> : <span className="muted">—</span>}</td>; })}
                  <td className="num"><b>{avg != null ? Math.round(avg) : '—'}</b></td>
                  <td className="num">{diff != null && (diff >= 0 ? <span style={{ color: '#059669' }}><TrendingUp size={14} /> +{Math.round(diff)}</span> : <span style={{ color: '#dc2626' }}><TrendingDown size={14} /> {Math.round(diff)}</span>)}</td>
                </tr>
              );
            })}
            {exams.length > 0 && (
              <tr style={{ fontWeight: 700 }}>
                <td>Promedio del curso</td>
                {exams.map((e) => { const rs = gScores.filter((x) => x.exam_name === e); return <td key={e} className="num">{rs.length ? Math.round(rs.reduce((a, r) => a + pct(r), 0) / rs.length) : '—'}</td>; })}
                <td /><td />
              </tr>
            )}
          </tbody>
        </table>
        {!students.length && <div className="empty">Este curso aún no tiene estudiantes.</div>}
        {students.length > 0 && !exams.length && <div className="empty">Todavía no hay notas. Pulsa «Registrar notas» después del primer simulacro.</div>}
      </div>

      {entry && (
        <Modal title="Registrar notas" onClose={() => setEntry(null)}
          footer={<><button className="btn" onClick={() => setEntry(null)}>Cancelar</button><button className="btn primary" onClick={saveEntry}>Guardar notas</button></>}>
          <div className="grid g3">
            <Text label="Prueba" value={entry.name} onChange={(v) => setEntry({ ...entry, name: v })} list="fw-exams" />
            <Text label="Fecha" type="date" value={entry.date} onChange={(v) => setEntry({ ...entry, date: v })} />
            <Num label="Nota máxima" value={entry.max} onChange={(v) => setEntry({ ...entry, max: v })} />
          </div>
          <datalist id="fw-exams">{exams.map((e) => <option key={e} value={e} />)}</datalist>
          <div className="col" style={{ gap: 6 }}>
            {students.map((s) => (
              <div key={s.id} className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="grow">{s.full_name}</span>
                <input className="input" style={{ width: 100 }} type="number" min={0} max={entry.max} placeholder={cell(s.id, entry.name) ? String(cell(s.id, entry.name).score) : '—'}
                  value={entry.values[s.id] ?? ''} onChange={(e) => setEntry({ ...entry, values: { ...entry.values, [s.id]: e.target.value } })} />
              </div>
            ))}
          </div>
          <p className="small muted">Deja vacío a quien no rindió. {fmtDate(entry.date)}</p>
        </Modal>
      )}
    </>
  );
}
