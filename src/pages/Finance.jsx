import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Download, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';
import { useStore, useTable } from '../lib/store';
import { db } from '../lib/backend';
import { money, today, fmtDate } from '../lib/people';
import { Modal, PageHead, Text, Num, Select, Kpi, Seg } from '../components/ui';

const CATEGORIES = ['Arriendo', 'Servicios básicos', 'Internet y teléfono', 'Sueldos', 'Profesores', 'Publicidad', 'Materiales', 'Mantenimiento', 'Impuestos', 'Software', 'Otros'];
const METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'];
const monthLabel = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-EC', { month: 'short', year: '2-digit' });
const lastMonths = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - (n - 1 - i)); return d.toLocaleDateString('en-CA').slice(0, 7); });

export default function Finance() {
  const { notify } = useStore();
  const exp = useTable('expenses');
  const pays = useTable('payments');
  const payouts = useTable('teacher_payouts');
  const [edit, setEdit] = useState(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const months = lastMonths(6);

  const series = useMemo(() => months.map((m) => {
    const income = (pays.rows || []).filter((p) => p.status === 'paid' && String(p.payment_date || '').startsWith(m)).reduce((a, p) => a + p.amount, 0);
    const teachers = (payouts.rows || []).filter((p) => p.period === m).reduce((a, p) => a + p.amount, 0);
    const other = (exp.rows || []).filter((e) => String(e.date).startsWith(m)).reduce((a, e) => a + e.amount, 0);
    return { m, income, teachers, other, out: teachers + other, net: income - teachers - other };
  }), [pays.rows, payouts.rows, exp.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = series.find((s) => s.m === month) || { income: 0, teachers: 0, other: 0, out: 0, net: 0 };
  const monthExp = (exp.rows || []).filter((e) => String(e.date).startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const byCat = {};
  for (const e of monthExp) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const max = Math.max(1, ...series.map((s) => Math.max(s.income, s.out)));

  async function save(e) {
    try {
      const payload = { date: e.date, category: e.category, description: e.description, amount: Number(e.amount), method: e.method, notes: e.notes };
      const row = e.id ? await db.update('expenses', e.id, payload) : await db.add('expenses', payload);
      exp.setRows((rs) => (e.id ? rs.map((x) => (x.id === row.id ? row : x)) : [row, ...rs]));
      setEdit(null);
      notify('Gasto guardado');
    } catch (err) { notify(err.message, 'bad'); }
  }
  async function exportXlsx() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series.map((s) => ({ Mes: s.m, Ingresos: s.income, 'Pagos a profesores': s.teachers, 'Otros gastos': s.other, Resultado: s.net }))), 'Resumen');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((exp.rows || []).map((e) => ({ Fecha: e.date, Categoría: e.category, Detalle: e.description, Monto: e.amount, Forma: e.method, Notas: e.notes }))), 'Gastos');
    XLSX.writeFile(wb, `Finanzas-ForWinners-${today()}.xlsx`);
  }

  if (exp.error) return <div className="alert bad">{exp.error}</div>;
  if (!exp.rows || !pays.rows) return <div className="empty">Cargando…</div>;

  return (
    <>
      <PageHead title="Finanzas" desc="Lo que entra (cuotas cobradas) y lo que sale (profesores y gastos) cada mes.">
        <button className="btn" onClick={exportXlsx}><Download size={16} /> Excel</button>
        <button className="btn primary" onClick={() => setEdit({ date: today(), category: 'Arriendo', description: '', amount: '', method: 'Transferencia', notes: '' })}><Plus size={16} /> Registrar gasto</button>
      </PageHead>
      <div className="tabs"><Seg value={month} onChange={setMonth} options={months.slice().reverse().map((m) => ({ value: m, label: monthLabel(m) }))} /></div>
      <div className="grid g4 kpis" style={{ marginBottom: 16 }}>
        <Kpi icon={TrendingUp} label="Ingresos cobrados" value={money(cur.income)} tone="ok" />
        <Kpi icon={Wallet} label="Pagos a profesores" value={money(cur.teachers)} sub="Registrados en Profesores" />
        <Kpi icon={Receipt} label="Otros gastos" value={money(cur.other)} />
        <Kpi icon={cur.net >= 0 ? TrendingUp : TrendingDown} label="Resultado del mes" value={money(cur.net)} tone={cur.net >= 0 ? 'ok' : 'bad'} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-h"><h2 className="grow">Últimos 6 meses</h2><span className="legend-item"><i style={{ background: 'var(--accent)' }} /> Ingresos</span><span className="legend-item"><i style={{ background: 'var(--warn)' }} /> Gastos</span></div>
          <div className="chart">
            {series.map((s) => (
              <button key={s.m} className={`chart-col ${s.m === month ? 'on' : ''}`} onClick={() => setMonth(s.m)} title={`${monthLabel(s.m)}: ingresos ${money(s.income)}, gastos ${money(s.out)}`}>
                <div className="chart-bars">
                  <span style={{ height: `${(s.income / max) * 100}%`, background: 'var(--accent)' }} />
                  <span style={{ height: `${(s.out / max) * 100}%`, background: 'var(--warn)' }} />
                </div>
                <small>{monthLabel(s.m)}</small>
                <b className={s.net >= 0 ? 'pos' : 'neg'}>{money(s.net)}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Gastos por categoría</h2></div>
          {Object.keys(byCat).length === 0 && <div className="empty">Sin gastos registrados en {monthLabel(month)}.</div>}
          <div className="list">
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
              <div key={c} className="list-row">
                <span className="grow">{c}</span>
                <div style={{ width: '40%' }} className="bar"><div style={{ width: `${(v / cur.other) * 100}%`, background: 'var(--warn)' }} /></div>
                <b className="mono" style={{ minWidth: 80, textAlign: 'right' }}>{money(v)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: 16 }}>
        <div className="card-h"><h2 className="grow">Gastos de {monthLabel(month)}</h2></div>
        <table className="t">
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Detalle</th><th>Forma</th><th className="num">Monto</th><th /></tr></thead>
          <tbody>
            {monthExp.map((e) => (
              <tr key={e.id}>
                <td className="small">{fmtDate(e.date)}</td>
                <td><span className="chip tag-mut">{e.category}</span></td>
                <td>{e.description}{e.notes && <div className="small muted">{e.notes}</div>}</td>
                <td className="small">{e.method}</td>
                <td className="num"><b>{money(e.amount)}</b></td>
                <td><div className="row" style={{ gap: 2, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                  <button className="btn sm ghost icon" onClick={() => setEdit({ ...e })} title="Editar"><Pencil size={14} /></button>
                  <button className="btn sm ghost icon danger" title="Borrar" onClick={async () => { if (!confirm('¿Borrar este gasto?')) return; await db.remove('expenses', e.id); exp.setRows((rs) => rs.filter((x) => x.id !== e.id)); }}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!monthExp.length && <div className="empty">No hay gastos este mes.</div>}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Editar gasto' : 'Registrar gasto'} onClose={() => setEdit(null)}
          footer={<><button className="btn" onClick={() => setEdit(null)}>Cancelar</button><button className="btn primary" disabled={!edit.amount || !edit.date} onClick={() => save(edit)}>Guardar</button></>}>
          <div className="grid g2">
            <Text label="Fecha" type="date" value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} />
            <Num label="Monto ($)" value={edit.amount} onChange={(v) => setEdit({ ...edit, amount: v })} />
            <Select label="Categoría" value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} options={CATEGORIES} />
            <Select label="Forma de pago" value={edit.method} onChange={(v) => setEdit({ ...edit, method: v })} options={METHODS} />
          </div>
          <Text label="Detalle" value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} placeholder="Ej.: Arriendo de noviembre" />
          <Text label="Notas" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
        </Modal>
      )}
    </>
  );
}
