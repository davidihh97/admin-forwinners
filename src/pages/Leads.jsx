import { useMemo, useState } from 'react';
import { Plus, Search, MessageCircle, UserPlus, Mail } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { STATUS, fmtDate, waLink, firstName, today } from '../lib/people';
import { Modal, PageHead, Seg, Text } from '../components/ui';
import EnrollDialog from '../components/EnrollDialog';

const COLS = ['new', 'contacted', 'enrolled', 'closed'];
const QUIZ = { uce: 'Simulador UCE', upec: 'Simulador UPEC', yachay: 'Simulador Yachay', utn: 'Simulador UTN', diag: 'Diagnóstico', english: 'Inglés', vocational: 'Test vocacional' };

export default function Leads() {
  const { notify } = useStore();
  const leads = useTable('inquiries');
  const tests = useTable('assessments');
  const [tab, setTab] = useState('tablero');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [enroll, setEnroll] = useState(null);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (leads.rows || []).filter((l) => !s || `${l.full_name} ${l.phone} ${l.email} ${l.interested_course} ${l.message}`.toLowerCase().includes(s));
  }, [leads.rows, q]);

  async function setStatus(l, status) {
    const row = await db.update('inquiries', l.id, { status, updated_at: new Date().toISOString() });
    leads.setRows((rs) => rs.map((x) => (x.id === l.id ? row : x)));
  }

  if (leads.error) return <div className="alert bad">{leads.error}</div>;
  if (!leads.rows) return <div className="empty">Cargando…</div>;
  const nNew = leads.rows.filter((l) => l.status === 'new').length;

  return (
    <>
      <PageHead title="Interesados" desc="Personas que dejaron sus datos en la web (simuladores, diagnóstico, test vocacional, contacto) o que agregaste a mano.">
        <button className="btn primary" onClick={() => setOpen({ full_name: '', phone: '', email: '', interested_course: '', message: '', status: 'new' })}><Plus size={16} /> Nuevo interesado</button>
      </PageHead>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <Seg value={tab} onChange={setTab} options={[{ value: 'tablero', label: `Seguimiento${nNew ? ` (${nNew} nuevos)` : ''}` }, { value: 'pruebas', label: 'Resultados de pruebas' }]} />
          <div className="row grow" style={{ maxWidth: 380 }}>
            <Search size={16} className="muted" />
            <input className="input grow" placeholder="Buscar nombre, celular, curso…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {tab === 'tablero' ? (
        <div className="kanban">
          {COLS.map((c) => {
            const items = list.filter((l) => l.status === c);
            return (
              <div key={c} className="kcol">
                <div className="kcol-h"><b>{STATUS.inquiry[c]}</b><span className="chip tag-mut">{items.length}</span></div>
                {items.slice(0, 80).map((l) => {
                  const wa = waLink(l.phone, `Hola ${firstName(l.full_name)}, te escribimos de For Winners. ${l.interested_course ? `Vimos tu interés en ${l.interested_course}.` : ''}`);
                  return (
                    <div key={l.id} className="kcard" onClick={() => setOpen({ ...l })}>
                      <b>{l.full_name}</b>
                      {l.interested_course && <span className="small">{l.interested_course}</span>}
                      {l.message && <span className="small muted clamp2">{l.message}</span>}
                      <div className="row small" style={{ gap: 6 }}>
                        <span className="muted">{fmtDate(l.created_at)}</span>
                        {wa && <a className="btn sm wa-btn right" href={wa} target="_blank" rel="noopener" onClick={(e) => { e.stopPropagation(); if (l.status === 'new') setStatus(l, 'contacted'); }}><MessageCircle size={13} /> WhatsApp</a>}
                      </div>
                    </div>
                  );
                })}
                {items.length > 80 && <div className="small muted">y {items.length - 80} más (usa el buscador)</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="t">
            <thead><tr><th>Fecha</th><th>Nombre</th><th>Prueba</th><th>Nivel</th><th className="num">Resultado</th><th>Contacto</th></tr></thead>
            <tbody>
              {(tests.rows || []).filter((t) => !q || `${t.full_name} ${t.quiz}`.toLowerCase().includes(q.toLowerCase())).map((t) => (
                <tr key={t.id}>
                  <td className="small">{fmtDate(t.created_at)}</td>
                  <td><b>{t.full_name}</b></td>
                  <td>{QUIZ[t.quiz] || t.quiz}</td>
                  <td className="small">{t.level}</td>
                  <td className="num">{t.score_pct != null ? `${t.score_pct}%` : '—'}</td>
                  <td className="row small" style={{ gap: 6 }}>
                    {waLink(t.phone) && <a href={waLink(t.phone, `Hola ${firstName(t.full_name)}, te escribimos de For Winners por tu resultado.`)} target="_blank" rel="noopener">{t.phone}</a>}
                    {t.email && <a href={`mailto:${t.email}`}><Mail size={13} /></a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tests.rows?.length === 0 && <div className="empty">Aún no hay resultados.</div>}
        </div>
      )}

      {open && (
        <Modal
          title={open.id ? open.full_name : 'Nuevo interesado'}
          onClose={() => setOpen(null)}
          footer={
            <>
              {open.id && open.status !== 'enrolled' && <button className="btn" onClick={() => { setEnroll(open); setOpen(null); }}><UserPlus size={15} /> Inscribir como estudiante</button>}
              <span className="grow" />
              <button className="btn" onClick={() => setOpen(null)}>Cancelar</button>
              <button className="btn primary" disabled={!open.full_name} onClick={async () => {
                try {
                  const payload = { ...open, updated_at: new Date().toISOString() };
                  if (open.id) {
                    const row = await db.update('inquiries', open.id, payload);
                    leads.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
                  } else {
                    const row = await db.add('inquiries', payload);
                    leads.setRows((rs) => [row, ...rs]);
                  }
                  setOpen(null);
                  notify('Guardado');
                } catch (e) { notify(e.message, 'bad'); }
              }}>Guardar</button>
            </>
          }
        >
          <div className="grid g2">
            <Text label="Nombre y apellido" value={open.full_name} onChange={(v) => setOpen({ ...open, full_name: v })} />
            <Text label="Celular" value={open.phone} onChange={(v) => setOpen({ ...open, phone: v })} />
            <Text label="Correo" value={open.email} onChange={(v) => setOpen({ ...open, email: v })} />
            <Text label="Le interesa" value={open.interested_course} onChange={(v) => setOpen({ ...open, interested_course: v })} />
          </div>
          {open.message && open.id ? <div className="sub-card small">{open.message}</div> : <Text label="Mensaje" area value={open.message} onChange={(v) => setOpen({ ...open, message: v })} />}
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>Estado</div>
            <Seg value={open.status} onChange={(v) => setOpen({ ...open, status: v })} options={COLS.map((c) => ({ value: c, label: STATUS.inquiry[c] }))} />
          </div>
          <Text label="Notas internas" area value={open.notes} onChange={(v) => setOpen({ ...open, notes: v })} placeholder={`Ej.: ${fmtDate(today())}: le escribí, pide horario de la tarde`} />
          {open.id && waLink(open.phone) && <a className="btn wa-btn" style={{ alignSelf: 'flex-start' }} href={waLink(open.phone, `Hola ${firstName(open.full_name)}, te escribimos de For Winners.`)} target="_blank" rel="noopener"><MessageCircle size={15} /> Escribir por WhatsApp</a>}
        </Modal>
      )}

      {enroll && (
        <EnrollDialog
          lead={enroll}
          onClose={() => setEnroll(null)}
          onDone={async (studentId) => {
            const row = await db.update('inquiries', enroll.id, { status: 'enrolled', student_id: studentId, updated_at: new Date().toISOString() });
            leads.setRows((rs) => rs.map((x) => (x.id === row.id ? row : x)));
            setEnroll(null);
          }}
        />
      )}
    </>
  );
}
