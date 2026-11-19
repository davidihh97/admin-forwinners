import { useMemo, useState } from 'react';
import { MessageCircle, Copy, CheckCircle2 } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { byId, money, fmtDate, today, addDays, daysBetween, waLink, firstName } from '../lib/people';
import { PageHead } from '../components/ui';

const WEEKDAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const KEY = 'fw-admin:sent';
const loadSent = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** Fecha real de una clase del plan según el inicio del grupo. */
function classDate(start, week, day) {
  const ws = addDays(start, (week - 1) * 7);
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    if (WEEKDAY[new Date(`${d}T12:00:00`).getDay()] === day) return d;
  }
  return null;
}

export default function Reminders() {
  const { data, can, notify } = useStore();
  const pays = useTable('payments');
  const enr = useTable('enrollments');
  const people = useTable('people');
  const groups = useTable('course_groups');
  const leads = useTable('inquiries');
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
    for (const l of leads.rows || []) {
      if (l.status !== 'new') continue;
      out.push({
        id: `lead-${l.id}`, kind: 'lead', title: l.full_name, sub: `${l.interested_course || 'Interesado'} · llegó ${fmtDate(l.created_at)}`, phone: l.phone,
        msg: `Hola ${firstName(l.full_name)}, te escribimos de For Winners${l.interested_course ? ` por tu interés en ${l.interested_course}` : ''}. ¿Te podemos ayudar con información de horarios y precios?`,
      });
    }
    // Simulacros y clases de mañana según el plan de clases de cada grupo.
    const tomorrow = addDays(t, 1);
    for (const g of groups.rows) {
      if (g.status !== 'active' || !g.plan_id || !g.start_date) continue;
      const plan = data.plans.find((p) => p.id === g.plan_id);
      if (!plan) continue;
      const kids = enr.rows.filter((e) => e.group_id === g.id && e.status === 'active').map((e) => pById[e.student_id]).filter(Boolean);
      for (const c of plan.classes) {
        const d = classDate(g.start_date, c.week, c.day);
        if (!d) continue;
        const isSim = /simulacro/i.test(`${c.module} ${c.content}`);
        if (isSim && d >= t && daysBetween(t, d) <= 7) {
          out.push({ id: `sim-${g.id}-${d}`, kind: 'group', title: `${g.group_name}: simulacro`, sub: `${fmtDate(d)} · ${c.time} · ${kids.length} estudiantes`, msg: `📝 Recordatorio For Winners: el ${c.day.toLowerCase()} ${fmtDate(d)} (${c.time}) tenemos simulacro. Llega 10 minutos antes, con lápiz, borrador y calculadora si tu examen la permite. ¡Tú puedes!` });
        } else if (d === tomorrow) {
          out.push({ id: `cls-${g.id}-${d}-${c.time}`, kind: 'group', title: `${g.group_name}: clase de mañana`, sub: `${c.time} · ${c.module}`, msg: `📚 Mañana ${c.day.toLowerCase()} ${c.time}: ${c.module} — ${c.content}. ¡Te esperamos en For Winners!` });
        }
      }
    }
    return out;
  }, [pays.rows, enr.rows, people.rows, groups.rows, leads.rows, data.plans, t]);

  if (!items) return <div className="empty">Cargando…</div>;
  const sections = [
    ['late', 'Cuotas vencidas', 'pagos'], ['soon', 'Cuotas que vencen en 3 días', 'pagos'],
    ['group', 'Mensajes para grupos (simulacros y clases de mañana)', 'grupos'], ['lead', 'Interesados sin contactar', 'interesados'],
  ];
  const copy = async (txt, id) => {
    try { await navigator.clipboard.writeText(txt); notify('Mensaje copiado: pégalo en el grupo de WhatsApp'); mark(id); } catch { notify('No se pudo copiar', 'bad'); }
  };

  return (
    <>
      <PageHead title="Recordatorios" desc="Mensajes listos para enviar por WhatsApp. Un clic abre el chat con el texto escrito; tú solo lo envías." />
      {sections.map(([kind, title, perm]) => {
        const list = items.filter((i) => i.kind === kind && (can(perm) || can('recordatorios')));
        if (!list.length) return null;
        return (
          <div key={kind} className="card" style={{ marginBottom: 14 }}>
            <div className="card-h"><h2 className="grow">{title}</h2><span className="chip tag-mut">{list.length}</span></div>
            <div className="col" style={{ gap: 8 }}>
              {list.map((i) => (
                <div key={i.id} className="row" style={{ flexWrap: 'nowrap', opacity: sent[i.id] ? 0.5 : 1 }}>
                  {sent[i.id] ? <CheckCircle2 size={18} color="#059669" /> : <span className="dot" style={{ background: kind === 'late' ? '#dc2626' : '#d97706' }} />}
                  <div className="grow"><b>{i.title}</b><div className="small muted">{i.sub}</div></div>
                  {i.phone && waLink(i.phone) ? (
                    <a className="btn sm wa-btn" href={waLink(i.phone, i.msg)} target="_blank" rel="noopener" onClick={() => mark(i.id)}><MessageCircle size={14} /> WhatsApp</a>
                  ) : (
                    <button className="btn sm" onClick={() => copy(i.msg, i.id)}><Copy size={14} /> Copiar mensaje</button>
                  )}
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
