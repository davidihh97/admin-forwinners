import { useMemo, useState } from 'react';
import { MessageCircle, CheckCircle2 } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { byId, money, fmtDate, today, addDays, daysBetween, waLink, firstName } from '../lib/people';
import { PageHead } from '../components/ui';

const KEY = 'fw-admin:sent';
const loadSent = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export default function Reminders() {
  const { can } = useStore();
  const pays = useTable('payments');
  const enr = useTable('enrollments');
  const people = useTable('people');
  const groups = useTable('course_groups');
  const leads = useTable('inquiries');
  const logs = useTable('attendance_log', [], { since: addDays(today(), -60) });
  const [sent, setSent] = useState(loadSent);
  const t = today();
  const mark = (id) => {
    const n = { ...sent, [id]: t };
    setSent(n);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* sin almacenamiento */ }
  };

  const items = useMemo(() => {
    if (!pays.rows || !enr.rows || !people.rows || !groups.rows) return null;
    const eById = byId(enr.rows);
    const pById = byId(people.rows);
    const gById = byId(groups.rows);
    const out = [];
    for (const p of pays.rows) {
      if (p.status !== 'pending' || !p.due_date) continue;
      const late = p.due_date < t;
      const soon = !late && daysBetween(t, p.due_date) <= 3;
      if (!late && !soon) continue;
      const e = eById[p.enrollment_id];
      const s = pById[e?.student_id];
      if (!s) continue;
      const g = gById[e.group_id];
      out.push({
        id: `pay-${p.id}-${p.due_date}`, kind: late ? 'late' : 'soon', title: s.full_name,
        sub: `Cuota ${p.installment_no || ''} · ${money(p.amount)} · ${late ? `venció ${fmtDate(p.due_date)}` : `vence ${fmtDate(p.due_date)}`}`,
        phone: s.guardian_phone || s.phone,
        msg: `Hola ${firstName(s.guardian_name || s.full_name)}, te saludamos de For Winners. Te recordamos que la cuota ${p.installment_no || ''} de ${money(p.amount)} de ${g?.group_name || 'tu curso'} ${late ? `venció el ${fmtDate(p.due_date)}` : `vence el ${fmtDate(p.due_date)}`}. Si ya pagaste, ignora este mensaje. ¡Gracias!`,
      });
    }
    // Estudiantes inscritos que no vienen hace 7 días o más (según sus firmas).
    if (logs.rows) {
      const last = {};
      for (const l of logs.rows) if (l.person_id && (!last[l.person_id] || l.day > last[l.person_id])) last[l.person_id] = l.day;
      const active = new Set(enr.rows.filter((e) => e.status === 'active').map((e) => e.student_id));
      for (const id of active) {
        const s = pById[id];
        if (!s || s.status !== 'active') continue;
        const d = last[id];
        const gap = d ? daysBetween(d, t) : null;
        if (d && gap < 7) continue;
        out.push({
          id: `abs-${id}-${t.slice(0, 7)}-${d || 'nunca'}`, kind: 'absent', title: s.full_name,
          sub: d ? `No viene hace ${gap} días (última vez ${fmtDate(d)})` : 'No ha firmado asistencia en los últimos 60 días',
          phone: s.guardian_phone || s.phone,
          msg: `Hola ${firstName(s.guardian_name || s.full_name)}, te escribimos de For Winners. Notamos que ${s.guardian_name ? firstName(s.full_name) : 'tú'} no ha${s.guardian_name ? '' : 's'} venido a clases en los últimos días. ¿Todo bien? Queremos ayudarte a no perder el ritmo. 💪`,
        });
      }
      for (const l of logs.rows) {
        if (l.check_out || l.day >= t) continue;
        const s = pById[l.person_id];
        out.push({ id: `open-${l.id}`, kind: 'open', title: l.person_name, sub: `Firmó la entrada el ${fmtDate(l.day)} pero no la salida`, phone: s?.phone, msg: `Hola ${firstName(l.person_name)}, el ${fmtDate(l.day)} registraste tu entrada en For Winners pero no tu salida. ¿A qué hora saliste?` });
      }
    }
    for (const l of leads.rows || []) {
      if (l.status !== 'new') continue;
      out.push({
        id: `lead-${l.id}`, kind: 'lead', title: l.full_name, sub: `${l.interested_course || 'Interesado'} · llegó ${fmtDate(l.created_at)}`, phone: l.phone,
        msg: `Hola ${firstName(l.full_name)}, te escribimos de For Winners${l.interested_course ? ` por tu interés en ${l.interested_course}` : ''}. ¿Te podemos ayudar con información de horarios y precios?`,
      });
    }
    return out;
  }, [pays.rows, enr.rows, people.rows, groups.rows, leads.rows, logs.rows, t]);

  if (!items) return <div className="empty">Cargando…</div>;
  const sections = [
    ['late', 'Cuotas vencidas', 'pagos', 'bad'], ['soon', 'Cuotas que vencen en 3 días', 'pagos', 'warn'],
    ['absent', 'Estudiantes que no vienen hace una semana', 'asistencia', 'warn'], ['open', 'Salidas sin registrar', 'asistencia', 'warn'],
    ['lead', 'Interesados sin contactar', 'interesados', 'info'],
  ];

  return (
    <>
      <PageHead title="Recordatorios" desc="Mensajes listos para WhatsApp. Un clic abre el chat con el texto escrito; tú solo lo envías." />
      {sections.map(([kind, title, perm, tone]) => {
        const list = items.filter((i) => i.kind === kind && (can(perm) || can('recordatorios')));
        if (!list.length) return null;
        const pending = list.filter((i) => !sent[i.id]).length;
        return (
          <div key={kind} className="card" style={{ marginBottom: 16 }}>
            <div className="card-h"><h2 className="grow">{title}</h2><span className={`chip tag-${tone === 'info' ? 'info' : tone}`}>{pending} pendiente{pending === 1 ? '' : 's'}</span></div>
            <div className="list">
              {list.map((i) => (
                <div key={i.id} className={`list-row ${sent[i.id] ? 'done' : ''}`}>
                  {sent[i.id] ? <CheckCircle2 size={18} color="var(--ok)" /> : <span className={`dot tone-${tone}`} />}
                  <div className="grow"><b>{i.title}</b><div className="small muted">{i.sub}</div></div>
                  {i.phone && waLink(i.phone)
                    ? <a className="btn sm wa-btn" href={waLink(i.phone, i.msg)} target="_blank" rel="noopener" onClick={() => mark(i.id)}><MessageCircle size={14} /> WhatsApp</a>
                    : <span className="small muted">Sin celular</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {!items.length && <div className="card empty">🎉 No hay recordatorios pendientes hoy.</div>}
    </>
  );
}
