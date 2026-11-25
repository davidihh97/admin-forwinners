// Panel «Temática de temporada»: adornos automáticos según la fecha (Navidad, San Valentín, Carnaval,
// fiestas de Ecuador, días de la educación…). Guarda en site.temporada; la web lo lee en FW_CONTENT.temporada.
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { THEMES, resolve, build } from '../site/seasonCalendar';
import { Text, Select, Seg, Check, Field } from './ui';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmt = (d) => `${d.getDate()} ${MES[d.getMonth()]}`;
const DM = /^\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*$/;
const INT = [{ value: 'baja', label: 'Suave' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Más adornos' }];

// Fechas de este año (o del próximo si ya pasaron), con las fechas propias si el panel las cambió.
function nextRange(t, c, today) {
  for (const y of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    let [s, e] = t.when(y);
    const a = DM.exec(c.desde || ''), b = DM.exec(c.hasta || '');
    if (a) s = new Date(y, +a[2] - 1, +a[1]);
    if (b) { e = new Date(y, +b[2] - 1, +b[1]); if (e < s) e = new Date(y + 1, +b[2] - 1, +b[1]); }
    if (e >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) return [s, e];
  }
  return t.when(today.getFullYear() + 1);
}

export default function SeasonPanel({ site, setIn, onPreview }) {
  const T = site.temporada || {};
  const temas = T.temas || {};
  const modo = T.modo || 'auto';
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState('');
  const [previewing, setPreviewing] = useState(null);
  const [probe, setProbe] = useState('');

  // Al salir del panel, la vista previa vuelve a lo que toca hoy.
  useEffect(() => () => onPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const preview = (id, variante) => {
    const same = previewing && previewing.id === id && previewing.variante === variante;
    const next = same ? null : { id, variante };
    setPreviewing(next);
    onPreview(next);
  };

  const now = resolve(T, today);
  const probeDate = /^\d{4}-\d{2}-\d{2}$/.test(probe) ? new Date(+probe.slice(0, 4), +probe.slice(5, 7) - 1, +probe.slice(8, 10), 12) : null;
  const probeRes = probeDate ? resolve(T, probeDate) : undefined;
  const list = THEMES.map((t) => ({ t, c: temas[t.id] || {}, r: nextRange(t, temas[t.id] || {}, today) })).sort((a, b) => a.r[0] - b.r[0]);
  const setT = (id, k, v) => setIn(['temporada', 'temas', id, k], v);

  return (
    <>
      <div className="alert info small">
        <Sparkles size={16} />
        <span>
          {modo === 'off' ? 'Los adornos de temporada están apagados.' : now ? <>Hoy la web muestra <b>{now.theme.name}</b> · {now.variant.name}.</> : 'Hoy no hay ninguna temática activa.'}
          {' '}Cambian solas según la fecha. Quien visita la web puede quitarlas con el botón ✦ de abajo a la izquierda.
        </span>
      </div>

      <Field label="Funcionamiento">
        <Seg value={modo} onChange={(v) => setIn(['temporada', 'modo'], v)} options={[{ value: 'auto', label: 'Automática' }, { value: 'force', label: 'Una fija' }, { value: 'off', label: 'Apagada' }]} />
      </Field>
      {modo === 'force' && (
        <Select label="Temática fija (se ve todos los días hasta que vuelvas a «Automática»)" value={T.forzar || 'navidad'} onChange={(v) => setIn(['temporada', 'forzar'], v)}
          options={THEMES.map((t) => ({ value: t.id, label: t.name }))} />
      )}
      <Field label="Cantidad de adornos"><Seg value={T.intensidad || 'baja'} onChange={(v) => setIn(['temporada', 'intensidad'], v)} options={INT} /></Field>
      <Check label="Mostrar un saludo pequeño (una vez al día por visitante)" checked={T.saludo !== false} onChange={(v) => setIn(['temporada', 'saludo'], v)} />

      <Text label="¿Qué se verá un día concreto?" type="date" value={probe} onChange={setProbe}
        hint={probeDate ? (probeRes ? `Ese día: ${probeRes.theme.name} · ${probeRes.variant.name}` : 'Ese día no hay temática.') : 'Elige una fecha para comprobarlo.'} />
      {probeRes && <button className="btn sm" onClick={() => preview(probeRes.theme.id, String(probeRes.index))}><Eye size={14} /> Verla en la vista previa</button>}

      <b className="small">Temáticas ({THEMES.length}), de la más próxima a la más lejana</b>
      <p className="small muted" style={{ margin: 0 }}>Si dos coinciden, se ve la más específica (por ejemplo, el 31 de diciembre gana Año Viejo sobre Navidad). Las fechas que cambian cada año (Carnaval, Semana Santa, Día de la Madre y del Padre, Black Friday) se calculan solas.</p>
      <div className="col" style={{ gap: 2 }}>
        {list.map(({ t, c, r }) => {
          const on = c.on === undefined ? !t.off : !!c.on;
          const isOpen = open === t.id;
          const live = now && now.theme.id === t.id;
          const pv = previewing?.id === t.id;
          return (
            <div key={t.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: isOpen ? 10 : 0 }}>
              <div className="row" style={{ flexWrap: 'nowrap', gap: 8, padding: '6px 0' }}>
                <input type="checkbox" checked={on} onChange={(e) => setT(t.id, 'on', e.target.checked)} aria-label={`Activar ${t.name}`} />
                <button type="button" className="btn ghost sm grow" style={{ justifyContent: 'flex-start', textAlign: 'left', opacity: on ? 1 : 0.55, minWidth: 0 }} onClick={() => setOpen(isOpen ? '' : t.id)}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="grow" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}{live && <span className="chip" style={{ background: '#0b3b8c', color: '#fff', marginLeft: 6 }}>hoy</span>}</span>
                  <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{fmt(r[0])}{+r[0] !== +r[1] ? ` – ${fmt(r[1])}` : ''}</span>
                </button>
                <button type="button" className={`btn sm icon ${pv ? 'accent' : 'ghost'}`} title={pv ? 'Quitar de la vista previa' : 'Ver en la vista previa'} onClick={() => preview(t.id, c.variante ?? '')}>
                  {pv ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {isOpen && (
                <div className="col" style={{ gap: 8, paddingLeft: 26 }}>
                  {t.off && c.on === undefined && <p className="small muted" style={{ margin: 0 }}>Viene apagada: actívala con la casilla si la quieres.</p>}
                  <Select label="Estilo" value={c.variante ?? ''} onChange={(v) => { setT(t.id, 'variante', v); if (pv) preview(t.id, v); }}
                    options={[{ value: '', label: t.variants.length > 1 ? `Automático (cambia cada año · este año: ${build(t, {}, {}, r[0].getFullYear()).variant.name})` : t.variants[0].name },
                      ...(t.variants.length > 1 ? t.variants.map((v, i) => ({ value: String(i), label: v.name })) : [])]} />
                  <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <Text label="Desde (día/mes)" placeholder={fmtDM(t.when(today.getFullYear())[0])} value={c.desde} onChange={(v) => setT(t.id, 'desde', v)} />
                    <Text label="Hasta (día/mes)" placeholder={fmtDM(t.when(today.getFullYear())[1])} value={c.hasta} onChange={(v) => setT(t.id, 'hasta', v)} />
                  </div>
                  {(c.desde && !DM.test(c.desde)) || (c.hasta && !DM.test(c.hasta)) ? <p className="small" style={{ color: '#b42318', margin: 0 }}>Escribe la fecha como día/mes, por ejemplo 24/12.</p> : null}
                  <Text label="Saludo" placeholder={t.greet} value={c.saludo} onChange={(v) => setT(t.id, 'saludo', v)} hint="Vacío = se usa el saludo que ves de ejemplo" />
                  <Select label="Cantidad de adornos" value={c.intensidad || ''} onChange={(v) => setT(t.id, 'intensidad', v)} options={[{ value: '', label: 'Igual que el general' }, ...INT]} />
                  {(c.desde || c.hasta || c.saludo || c.variante || c.intensidad) && (
                    <button type="button" className="btn sm ghost" onClick={() => setIn(['temporada', 'temas', t.id], c.on === undefined ? {} : { on: c.on })}>Volver a lo original</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const fmtDM = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

