import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Monitor, Smartphone, ExternalLink, MousePointerClick, Phone, Megaphone, LayoutGrid, Ruler,
  School, BookMarked, HelpCircle, Quote, Search, PlusSquare, Trash2, ArrowUp, ArrowDown, ArrowLeft,
  ArrowRight, EyeOff, Eye, RotateCcw, ImageUp, Copy, AlertTriangle, ChevronLeft, History, Palette, Paintbrush, Sparkles,
} from 'lucide-react';
import SeasonPanel from '../components/SeasonPanel';
import StylePanel from '../components/StylePanel';
import { describeChanges } from '../site/changes';
import { Modal } from '../components/ui';
import { useStore } from '../lib/store';
import * as backend from '../lib/backend';
import { buildPublished, publicSnapshot, stable, stripPub } from '../site/publish';
import { PAGES, SECTION_TYPES, BUTTON_STYLES, SERVICE_KEYS, MENU_KEYS, newSection } from '../site/defaultSite';
import { uid } from '../lib/time';
import { Text, Select, Seg, Check, Field } from '../components/ui';

const PANELS = [
  { id: 'historial', label: 'Historial de versiones', icon: History },
  { id: 'tema', label: 'Colores y letras de toda la web', icon: Palette },
  { id: 'contacto', label: 'WhatsApp y contacto', icon: Phone },
  { id: 'aviso', label: 'Barra de aviso', icon: Megaphone },
  { id: 'temporada', label: 'Temática de temporada (Navidad, fiestas…)', icon: Sparkles },
  { id: 'portada', label: 'Portada: servicios y fotos', icon: LayoutGrid },
  { id: 'nivelacion', label: 'Nivelación: planes y precios', icon: Ruler },
  { id: 'unis', label: 'Preuniversitario: universidades', icon: School },
  { id: 'cursos', label: 'Preuniversitario: precio, inicio y horario', icon: BookMarked },
  { id: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  { id: 'testimonios', label: 'Testimonios', icon: Quote },
  { id: 'secciones', label: 'Secciones nuevas', icon: PlusSquare },
  { id: 'seo', label: 'Cómo aparece en Google', icon: Search },
];
// Partes que main.js lee al cargar: si cambian, la vista previa se recarga.
const LIVE_KEYS = ['overrides', 'sections', 'theme', 'temporada'];

export default function SiteEditor() {
  const { site, data, notify, siteUrl, user } = useStore();
  const [pubDlg, setPubDlg] = useState(null); // { changes, note }
  const s = site.doc;
  const [page, setPage] = useState('index.html');
  const [hero, setHero] = useState('');
  const [device, setDevice] = useState('desktop');
  const [sel, setSel] = useState(null); // {kind:'el', pick} | {kind:'panel', id} | {kind:'section', id}
  const [published, setPublished] = useState(undefined);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState([]);
  const [busy, setBusy] = useState(false);
  const frame = useRef();
  const stage = useRef();
  const lastSent = useRef(null);
  const [box, setBox] = useState({ scale: 1, h: 600 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBox({ scale: Math.min(1, el.clientWidth / 1280), h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const origin = useMemo(() => new URL(siteUrl).origin, [siteUrl]);
  const pub = useMemo(() => publicSnapshot(data), [data]);
  const draft = useMemo(() => ({ ...s, public: pub }), [s, pub]);

  useEffect(() => {
    backend.loadDoc('site_published').then((r) => setPublished(r.value)).catch(() => setPublished(null));
  }, []);

  // Enviar el borrador a la web dentro del marco.
  const send = (force) => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    const prev = lastSent.current;
    const structural = !prev || Object.keys({ ...prev, ...draft }).some((k) => !LIVE_KEYS.includes(k) && stable(prev[k]) !== stable(draft[k]));
    if (!force && prev && stable(prev) === stable(draft)) return;
    lastSent.current = draft;
    w.postMessage({ fwDraft: draft, reload: force === 'reload' || (!!prev && structural) }, origin);
  };
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => send(), 350);
    return () => clearTimeout(t);
  }, [draft, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e) => {
      if (e.origin !== origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data || {};
      if (d.fwLoaded) {
        // Primera carga de la página: mandamos el borrador y, si difiere de lo publicado, la página se recarga con él.
        frame.current.contentWindow.postMessage({ fwHello: true }, origin);
        if (!lastSent.current) send('reload');
        else frame.current.contentWindow.postMessage({ fwDraft: lastSent.current }, origin);
        setReady(true);
      }
      if (d.fwReady) setBroken(d.fwReady.broken || []);
      if (d.fwBroken) setBroken(d.fwBroken);
      if (d.fwPick) {
        const p = d.fwPick;
        if (p.section) setSel({ kind: 'section', id: p.section });
        else if (p.panel) setSel({ kind: 'panel', id: p.panel });
        else setSel({ kind: 'el', pick: p });
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  });

  const changePage = (p) => {
    setPage(p);
    setSel(null);
    setReady(false);
    lastSent.current = null;
  };

  const dirty = published !== undefined && stable(stripPub(s)) !== stable(stripPub(published));
  async function publish(note, value = s, changes) {
    setBusy(true);
    try {
      const p = {
        ...buildPublished(stripPub(value), data),
        changeNote: String(note || '').slice(0, 300),
        changes: (changes || describeChanges(stripPub(published), value)).slice(0, 60),
        publishedBy: user.name,
      };
      await backend.saveDoc('site_published', p);
      setPublished(p);
      setPubDlg(null);
      notify('Publicado. En menos de un minuto se ve en forwinnersec.com');
    } catch (e) {
      notify(`No se pudo publicar: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (!published || !confirm('¿Descartar todos los cambios sin publicar y volver a lo que está en la web?')) return;
    site.replace(stripPub(published));
    lastSent.current = null;
    setTimeout(() => send('reload'), 100);
  }

  const upd = (fn) => site.update(fn);
  const pageOverrides = (s.overrides || {})[page] || [];

  return (
    <>
      <div className="topbar">
        <div className="grow">
          <h1>Editor de la web</h1>
          <p className="muted">Haz clic sobre cualquier texto, botón o imagen de tu página para cambiarlo. Nada cambia en la web hasta que pulses <b>Publicar</b>.</p>
        </div>
        {published?.publishedAt && <span className="small muted">Publicado: {new Date(published.publishedAt).toLocaleString('es-EC')}</span>}
        {dirty && <button className="btn ghost" onClick={discard}><History size={15} /> Descartar cambios</button>}
        <button className="btn ghost" onClick={() => setSel({ kind: 'panel', id: 'historial' })}><History size={15} /> Historial</button>
        <button className="btn accent" onClick={() => setPubDlg({ changes: describeChanges(stripPub(published), s), note: '' })} disabled={busy || !dirty}>
          <Send size={16} /> {busy ? 'Publicando…' : dirty ? 'Publicar cambios' : 'Todo publicado'}
        </button>
      </div>

      <div className="editor">
        <div className="preview-box">
          <div className="preview-bar">
            <select className="input" style={{ width: 'auto' }} value={page} onChange={(e) => changePage(e.target.value)} aria-label="Página">
              {PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Seg value={device} onChange={setDevice} options={[{ value: 'desktop', label: <><Monitor size={14} /> Computadora</> }, { value: 'mobile', label: <><Smartphone size={14} /> Celular</> }]} />
            <span className="right small muted">{dirty ? '● Cambios sin publicar' : '✓ Igual que la web'}</span>
            <a className="btn sm ghost" href={`${siteUrl}/${page === 'index.html' ? '' : page}`} target="_blank" rel="noopener"><ExternalLink size={14} /> Ver web</a>
          </div>
          <div className={`preview-stage ${device}`} ref={stage}>
            <iframe key={`${page}|${hero}`} ref={frame} className="preview-frame" title="Tu página" src={`${siteUrl}/${page}?fw-edit=1${page === 'index.html' && hero ? `&fw-hero=${hero}` : ''}`}
              style={device === 'desktop' ? { transform: `scale(${box.scale})`, height: box.h / box.scale, borderRadius: 0 } : undefined} />
          </div>
        </div>

        <div className="dz-panel">
          {sel?.kind === 'el' && <ElementPanel key={sel.pick.sel} pick={sel.pick} page={page} site={s} upd={upd} onBack={() => setSel(null)} />}
          {sel?.kind === 'section' && <SectionPanel id={sel.id} site={s} data={data} upd={upd} onBack={() => setSel(null)} onScroll={(id) => frame.current?.contentWindow?.postMessage({ fwScrollTo: id }, origin)} />}
          {sel?.kind === 'panel' && sel.id === 'historial' && (
            <HistoryPanel published={published} onBack={() => setSel(null)}
              onDraft={(v) => { site.replace(stripPub(v)); lastSent.current = null; setTimeout(() => send('reload'), 100); notify('Versión cargada en el borrador. Revísala y pulsa Publicar.'); }}
              onPublish={(v, when) => publish(`Se volvió a la versión del ${when}`, stripPub(v), [`Restaurada la versión del ${when}`]).then(() => { site.replace(stripPub(v)); lastSent.current = null; setTimeout(() => send('reload'), 100); })} />
          )}
          {sel?.kind === 'panel' && sel.id !== 'historial' && <DataPanel onSeasonPreview={(x) => frame.current?.contentWindow?.postMessage({ fwSeasonPreview: x }, origin)} onHero={(k) => { setHero(k); if (page !== 'index.html') changePage('index.html'); }} id={sel.id} page={page} site={s} data={data} upd={upd} user={user} onBack={() => setSel(null)} onPick={(x) => setSel(x)} />}
          {!sel && (
            <>
              <div className="ph"><MousePointerClick size={16} /> ¿Qué quieres cambiar?</div>
              <div className="pb">
                <p className="small muted" style={{ margin: 0 }}>Haz clic en la página de la izquierda, o elige aquí:</p>
                <div className="col" style={{ gap: 2 }}>
                  {PANELS.map((p) => (
                    <div key={p.id} className="sec-item" onClick={() => setSel({ kind: 'panel', id: p.id })}><p.icon size={15} /> {p.label}</div>
                  ))}
                </div>
                {pageOverrides.length > 0 && (
                  <>
                    <b className="small">Cambios en esta página ({pageOverrides.length})</b>
                    <div className="col" style={{ gap: 4 }}>
                      {pageOverrides.map((o) => (
                        <div key={o.sel} className="row small" style={{ flexWrap: 'nowrap' }}>
                          {broken.includes(o.sel) ? <AlertTriangle size={14} color="#d97706" title="Ese texto ya no está en la página" /> : <span className="dot" style={{ background: '#059669' }} />}
                          <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.hidden ? 'Oculto: ' : ''}{o.text || o.orig || o.sel}
                          </span>
                          <button className="btn sm ghost icon" title="Quitar este cambio" onClick={() => upd((d) => { d.overrides[page] = d.overrides[page].filter((x) => x.sel !== o.sel); })}><RotateCcw size={13} /></button>
                        </div>
                      ))}
                    </div>
                    {broken.length > 0 && <div className="alert warn small"><AlertTriangle size={16} /> Algunos cambios ya no encuentran su texto (la página cambió). Quítalos y vuelve a hacerlos.</div>}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {pubDlg && (
        <Modal title="Publicar cambios" onClose={() => setPubDlg(null)}
          footer={<><button className="btn" onClick={() => setPubDlg(null)}>Cancelar</button><button className="btn accent" disabled={busy} onClick={() => publish(pubDlg.note, s, pubDlg.changes)}><Send size={15} /> {busy ? 'Publicando…' : 'Publicar'}</button></>}>
          <p className="small muted" style={{ margin: 0 }}>Esto queda guardado en el <b>Historial de versiones</b>; desde ahí puedes volver atrás cuando quieras.</p>
          <div className="sub-card">
            <b className="small">Qué cambia ({pubDlg.changes.length})</b>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>
              {pubDlg.changes.map((c, i) => <li key={i}>{c}</li>)}
              {!pubDlg.changes.length && <li>Cambios menores</li>}
            </ul>
          </div>
          <Text label="Descripción (opcional)" placeholder="Ej.: precios de enero y nuevo aviso" value={pubDlg.note} onChange={(v) => setPubDlg({ ...pubDlg, note: v })} />
        </Modal>
      )}
    </>
  );
}

function HistoryPanel({ published, onBack, onDraft, onPublish }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const { notify } = useStore();
  useEffect(() => { backend.history('site_published').then(setList).catch((e) => { notify(e.message, 'bad'); setList([]); }); }, [published]); // eslint-disable-line react-hooks/exhaustive-deps
  const when = (iso) => (iso ? new Date(iso).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const parse = (c) => { try { return Array.isArray(c) ? c : JSON.parse(c || '[]'); } catch { return []; } };
  const rows = [
    ...(published ? [{ id: 'actual', current: true, note: published.changeNote, changes: published.changes, published_at: published.publishedAt, published_by: published.publishedBy }] : []),
    ...(list || []),
  ];
  async function load(r, then) {
    setBusy(r.id);
    try {
      const v = r.current ? published : await backend.historyItem(r.id);
      await then(v, when(r.published_at || `${String(r.saved_at).replace(' ', 'T')}Z`));
    } catch (e) { notify(e.message, 'bad'); } finally { setBusy(null); }
  }
  return (
    <>
      <Back onBack={onBack}>Historial de versiones</Back>
      <div className="pb">
        <p className="small muted" style={{ margin: 0 }}>Cada vez que publicas se guarda una versión. Si algo sale mal, vuelve a una anterior.</p>
        {!list && <div className="small muted">Cargando…</div>}
        {rows.map((r) => {
          const ch = parse(r.changes);
          return (
            <div key={r.id} className="sub-card">
              <div className="row">
                <b className="grow">{when(r.published_at || (r.saved_at && `${String(r.saved_at).replace(' ', 'T')}Z`)) || 'Versión'}</b>
                {r.current && <span className="chip tag-ok">En la web</span>}
              </div>
              <div className="small muted">{r.published_by || r.saved_by || ''}{r.note ? ` · ${r.note}` : ''}</div>
              {ch.length > 0 && (
                <details className="small"><summary>{ch.length} cambio{ch.length > 1 ? 's' : ''}</summary>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{ch.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </details>
              )}
              {!r.current && (
                <div className="row">
                  <button className="btn sm" disabled={!!busy} onClick={() => load(r, (v) => onDraft(v))}>Abrir en el editor</button>
                  <button className="btn sm danger" disabled={!!busy} onClick={() => confirm('¿Publicar de inmediato esta versión? La web volverá a verse como en esa fecha.') && load(r, onPublish)}><RotateCcw size={13} /> Volver a esta versión</button>
                </div>
              )}
            </div>
          );
        })}
        {list && rows.length === 0 && <div className="small muted">Aún no hay publicaciones.</div>}
      </div>
    </>
  );
}

function Back({ onBack, children }) {
  return (
    <div className="ph">
      <button className="btn sm ghost icon" onClick={onBack} aria-label="Volver"><ChevronLeft size={16} /></button>
      <span className="grow">{children}</span>
    </div>
  );
}

function ImageInput({ label, value, onChange, video = true }) {
  const { notify, siteUrl } = useStore();
  const [busy, setBusy] = useState(null);
  async function up(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      if (f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name)) {
        if (!video) throw new Error('Aquí solo se puede usar una foto.');
        setBusy(0);
        onChange(await backend.uploadVideo(f, (x) => setBusy(x)));
        notify('Video subido');
      } else {
        setBusy(1);
        onChange(await backend.uploadImage(f));
        notify('Imagen subida');
      }
    } catch (err) {
      notify(err.message, 'bad');
    } finally {
      setBusy(null);
    }
  }
  const src = value && value.startsWith('/') ? `${siteUrl}${value}` : value;
  const vid = backend.isVideo(value);
  return (
    <Field label={label}>
      {value && vid && <video src={src} muted loop autoPlay playsInline style={{ maxHeight: 130, borderRadius: 8, alignSelf: 'flex-start', background: '#000' }} />}
      {value && !vid && /\.(png|jpe?g|webp|gif|svg)$|^\/m\//i.test(value) && <img src={src} alt="" style={{ maxHeight: 110, borderRadius: 8, objectFit: 'cover', alignSelf: 'flex-start' }} />}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="grow" placeholder={video ? 'Enlace o sube una foto o un video' : 'Enlace o sube una foto'} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        <label className="btn sm" title={video ? 'Subir foto o video' : 'Subir foto'}><ImageUp size={14} /> {busy != null ? `Subiendo${busy < 1 ? ` ${Math.round(busy * 100)}%` : '…'}` : 'Subir'}<input type="file" accept={video ? 'image/*,video/mp4,video/webm,video/quicktime' : 'image/*'} hidden onChange={up} disabled={busy != null} /></label>
      </div>
      {video && <span className="hint">Foto JPG o PNG, o video MP4 corto (hasta 40 MB, sin sonido se ve mejor).</span>}
    </Field>
  );
}

const Lines = ({ label, hint, value = [], onChange, rows = 4 }) => (
  <Text label={label} hint={hint || 'Una línea por elemento'} area rows={rows} value={(value || []).join('\n')} onChange={(v) => onChange(v.split('\n'))} />
);

function ListEditor({ items = [], onChange, fields, newItem, addLabel = 'Agregar' }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <div className="col">
      {items.map((it, i) => (
        <div key={i} className="sub-card">
          {fields.map(([k, label, kind]) =>
            kind === 'lines' ? <Lines key={k} label={label} value={it[k]} onChange={(v) => set(i, { [k]: v })} rows={3} />
              : kind === 'number' ? <Text key={k} label={label} type="number" value={it[k]} onChange={(v) => set(i, { [k]: Number(v) })} />
                : <Text key={k} label={label} area={kind === 'area'} rows={3} value={it[k]} onChange={(v) => set(i, { [k]: v })} />
          )}
          <div className="row">
            <button className="btn sm ghost icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
            <button className="btn sm ghost icon" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown size={14} /></button>
            <button className="btn sm ghost danger right" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /> Quitar</button>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...items, newItem])}><PlusSquare size={14} /> {addLabel}</button>
    </div>
  );
}

/* ---------- elemento de la página (texto, botón, imagen) ---------- */
function ElementPanel({ pick, page, site, upd, onBack }) {
  const list = (site.overrides || {})[page] || [];
  const o = list.find((x) => x.sel === pick.sel) || {};
  const set = (patch) =>
    upd((d) => {
      d.overrides ||= {};
      const arr = (d.overrides[page] ||= []);
      let cur = arr.find((x) => x.sel === pick.sel);
      if (!cur) arr.push((cur = { sel: pick.sel, orig: pick.orig }));
      Object.assign(cur, patch);
      for (const k of Object.keys(cur)) {
        if (k === 'sel' || k === 'orig') continue;
        if (cur[k] === '' || cur[k] === undefined || cur[k] === false || (k === 'style' && !Object.keys(cur[k] || {}).length)) delete cur[k];
      }
      // Sin cambios reales (solo el selector y el texto original): se quita.
      if (!Object.keys(cur).some((k) => k !== 'sel' && k !== 'orig')) d.overrides[page] = arr.filter((x) => x !== cur);
    });
  const isLink = pick.tag === 'a';
  const isImg = pick.tag === 'img';
  const pos = o.pos ?? pick.index;
  const names = { a: isLink && /btn/.test(pick.sel) ? 'Botón' : 'Enlace', img: 'Imagen', h1: 'Título principal', h2: 'Título', h3: 'Subtítulo', p: 'Párrafo', li: 'Elemento de lista', button: 'Botón' };
  return (
    <>
      <Back onBack={onBack}>{names[pick.tag] || 'Texto'}</Back>
      <div className="pb">
        {pick.textEditable && (
          <Text label="Texto" area rows={4} value={o.text ?? pick.orig} onChange={(v) => set({ text: v === pick.orig ? '' : v })}
            hint="Escribe *así* para cursiva o color de acento, **así** para negrita. Enter = salto de línea." />
        )}
        {!pick.textEditable && !isImg && <div className="alert info small">Este bloque tiene varias partes. Haz clic en el texto exacto que quieres cambiar.</div>}
        {isLink && pick.isWa && <div className="alert info small">Este botón abre WhatsApp. El número y el mensaje se cambian en «WhatsApp y contacto».</div>}
        {isLink && !pick.isWa && (
          <Text label="¿A dónde lleva?" value={o.href ?? pick.href ?? ''} onChange={(v) => set({ href: v === pick.href ? '' : v })}
            hint="Otra página (contacto.html), una parte (#fechas) o un enlace (https://…)" />
        )}
        {isImg && <ImageInput label="Foto o video" value={o.src ?? pick.src} onChange={(v) => set({ src: v === pick.src ? '' : v })} />}
        <Check label="Ocultar en la web" checked={!!o.hidden} onChange={(v) => set({ hidden: v })} />
        <details className="sub-card" open={Object.keys(o.style || {}).length > 0 || !!o.show || !!o.variant}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}><Paintbrush size={14} /> Estilo: tamaño, colores, espacios…</summary>
          <div style={{ marginTop: 12 }}>
            <StylePanel style={o.style} cur={pick.cur} isImg={isImg} isBtn={pick.isBtn} outline={pick.outline} variant={o.variant} show={o.show}
              onStyle={(st) => set({ style: Object.fromEntries(Object.entries(st).filter(([, v]) => v !== '' && v !== undefined)) })}
              onVariant={(v) => set({ variant: v === (pick.outline ? 'outline' : 'solid') ? '' : v })}
              onShow={(v) => set({ show: v })} />
          </div>
        </details>
        {pick.siblings > 1 && (
          <Field label="Posición junto a los demás">
            <div className="row">
              <button className="btn sm" disabled={pos <= 0} onClick={() => set({ pos: pos - 1 })}><ArrowLeft size={14} /> Antes</button>
              <button className="btn sm" disabled={pos >= pick.siblings - 1} onClick={() => set({ pos: pos + 1 })}>Después <ArrowRight size={14} /></button>
              {o.pos != null && <button className="btn sm ghost" onClick={() => set({ pos: undefined })}>Posición original</button>}
            </div>
          </Field>
        )}
        {list.includes(o) && (
          <button className="btn ghost danger" onClick={() => { upd((d) => { d.overrides[page] = d.overrides[page].filter((x) => x.sel !== pick.sel); }); onBack(); }}>
            <RotateCcw size={14} /> Volver al original
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- formularios de datos de la web ---------- */
function DataPanel({ id, page, site, data, upd, onBack, onPick, onHero, onSeasonPreview }) {
  const p = PANELS.find((x) => x.id === id) || PANELS[0];
  const setIn = (path, v) => upd((d) => {
    let o = d;
    for (const k of path.slice(0, -1)) o = o[k] ||= {};
    o[path[path.length - 1]] = v;
  });
  const [svc, setSvc] = useState('pre');
  let body = null;

  if (id === 'tema') {
    const t = site.theme || {};
    const setT = (k) => (v) => setIn(['theme', k], v);
    const FONTS = ['', 'Poppins', 'Inter', 'Montserrat', 'Nunito', 'DM Sans', 'Raleway', 'Playfair Display', 'Lora', 'Merriweather'];
    const color = (k, label, def) => (
      <Field label={label}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="color" value={t[k] || def} onChange={(e) => setT(k)(e.target.value)} style={{ width: 48, height: 34, padding: 2 }} />
          <span className="small muted grow">{t[k] ? t[k].toUpperCase() : 'Original'}</span>
          {t[k] && <button className="btn sm ghost" onClick={() => setT(k)('')}>Original</button>}
        </div>
      </Field>
    );
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>Cambia toda la web a la vez. Para un solo texto o botón, haz clic sobre él en la página.</p>
        {color('primary', 'Azul principal (títulos, botones)', '#0b2a5b')}
        {color('secondary', 'Azul secundario (al pasar el mouse)', '#123f86')}
        {color('highlight', 'Color de las palabras resaltadas', '#2e6bd1')}
        {color('gold', 'Dorado (detalles y botones en fondo oscuro)', '#c9a13b')}
        <Select label="Letra de los títulos" value={t.headFont || ''} onChange={setT('headFont')} options={FONTS.map((f) => ({ value: f, label: f || 'Original (Poppins / Inter)' }))} />
        <Select label="Letra del texto" value={t.bodyFont || ''} onChange={setT('bodyFont')} options={FONTS.map((f) => ({ value: f, label: f || 'Original (Inter)' }))} />
        <Field label={`Tamaño base del texto: ${t.baseSize ? `${t.baseSize}px` : 'original (17px)'}`}>
          <input type="range" min={14} max={21} value={t.baseSize || 17} onChange={(e) => setT('baseSize')(Number(e.target.value) === 17 ? '' : Number(e.target.value))} />
        </Field>
        {Object.values(t).some(Boolean) && <button className="btn sm" onClick={() => setIn(['theme'], {})}><RotateCcw size={13} /> Volver a los colores y letras originales</button>}
        <p className="small muted">El modo oscuro del celular mantiene sus propios colores.</p>
      </>
    );
  } else if (id === 'contacto') {
    const c = site.config || {};
    body = (
      <>
        <Text label="WhatsApp de For Winners (con 593)" value={c.whatsapp} onChange={(v) => setIn(['config', 'whatsapp'], v)} hint="Todos los botones «Escríbenos» de la web usan este número" />
        <Text label="Mensaje inicial de WhatsApp" value={c.waMsg} onChange={(v) => setIn(['config', 'waMsg'], v)} />
        <Text label="Canal de WhatsApp de avisos" placeholder="https://whatsapp.com/channel/…" value={c.canalWa} onChange={(v) => setIn(['config', 'canalWa'], v)} hint="Lo usan los botones «Avísame las fechas». Vacío = abre un chat normal." />
        <p className="small muted">La dirección, el horario y las redes de la página de contacto se cambian haciendo clic sobre ellos.</p>
      </>
    );
  } else if (id === 'temporada') {
    body = <SeasonPanel site={site} setIn={setIn} onPreview={(x) => onSeasonPreview?.(x)} />;
  } else if (id === 'aviso') {
    const a = site.aviso || {};
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>La franja azul arriba de las páginas (menos la portada).</p>
        <Check label="Mostrar el aviso" checked={a.enabled} onChange={(v) => setIn(['aviso', 'enabled'], v)} />
        <Text label="Mensaje" area rows={2} value={a.texto} onChange={(v) => setIn(['aviso', 'texto'], v)} />
        <Text label="Texto del enlace" value={a.linkLabel} onChange={(v) => setIn(['aviso', 'linkLabel'], v)} />
        <Text label="Enlace" value={a.link} onChange={(v) => setIn(['aviso', 'link'], v)} />
        <Text label="Mostrar hasta" type="date" value={a.hasta} onChange={(v) => setIn(['aviso', 'hasta'], v)} hint="Después de esa fecha desaparece solo" />
        <button className="btn sm" onClick={() => setIn(['aviso', 'id'], uid('a'))}>Volver a mostrarlo a quien ya lo cerró</button>
      </>
    );
  } else if (id === 'portada') {
    const P = site.portada || {};
    const o = (P.services || {})[svc] || {};
    const set = (k, v) => setIn(['portada', 'services', svc, k], v);
    const order = [...(P.order || []).filter((k) => MENU_KEYS.includes(k)), ...MENU_KEYS.filter((k) => !(P.order || []).includes(k))];
    const inMenu = MENU_KEYS.includes(svc);
    const hidden = P.hidden || [];
    body = (
      <>
        <div className="field">
          <span>Orden y visibilidad del menú de la portada</span>
          <div className="col" style={{ gap: 2 }}>
            {order.map((k, i) => (
              <div key={k} className={`sec-item ${svc === k ? 'on' : ''} ${hidden.includes(k) ? 'off' : ''}`} onClick={() => setSvc(k)}>
                <span className="grow">{SERVICE_KEYS.find(([x]) => x === k)?.[1]}</span>
                <button className="btn sm ghost icon" disabled={i === 0} onClick={(e) => { e.stopPropagation(); const n = [...order]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setIn(['portada', 'order'], n); }}><ArrowUp size={13} /></button>
                <button className="btn sm ghost icon" onClick={(e) => { e.stopPropagation(); setIn(['portada', 'hidden'], hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]); }}>{hidden.includes(k) ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              </div>
            ))}
          </div>
        </div>
        <Select label="Servicio que quieres editar" value={svc} onChange={setSvc}
          options={SERVICE_KEYS.map(([k, l]) => ({ value: k, label: MENU_KEYS.includes(k) ? l : `${l} (solo portada grande)` }))} />
        <p className="small muted" style={{ margin: 0 }}>Deja vacío lo que no quieras cambiar.</p>
        {inMenu && <div className="sub-card">
          <b className="small">En el menú de servicios</b>
          <Text label="Nombre" value={o.t} onChange={(v) => set('t', v)} />
          <Text label="Palabras clave" value={o.d} onChange={(v) => set('d', v)} hint="Ej.: Cursos · Simuladores · Test vocacional · Guías" />
        </div>}
        {(
          <div className="sub-card">
            <div className="row"><b className="small grow">En la portada grande (sale al azar)</b>
              <button className="btn sm" onClick={() => onHero?.(svc)}>Ver en la vista previa</button></div>
            <Check label="Mostrar este servicio en la portada grande" checked={!(P.heroHidden || []).includes(svc)} onChange={(on) => setIn(['portada', 'heroHidden'], on ? (P.heroHidden || []).filter((x) => x !== svc) : [...(P.heroHidden || []), svc])} />
            <Text label="Etiqueta pequeña" value={o.label} onChange={(v) => set('label', v)} hint="Ej.: Preuniversitario 2027" />
            <Text label="Frase principal" value={o.hook} onChange={(v) => set('hook', v)} hint="Ej.: Tu cupo empieza hoy." />
            <Text label="Texto" area rows={3} value={o.p} onChange={(v) => set('p', v)} />
            <Lines label="Datos clave" value={o.facts} onChange={(v) => set('facts', v)} rows={3} />
            <Text label="Texto del botón" value={o.cta} onChange={(v) => set('cta', v)} />
          </div>
        )}
        <ImageInput label="Foto o video" value={(P.media || {})[svc]} onChange={(v) => setIn(['portada', 'media', svc], v)} />
        {inMenu && <p className="small muted" style={{ margin: 0 }}>La foto también aparece al pasar el mouse sobre el menú. Si pones un video, el menú mantiene su foto y el video se ve en la portada grande.</p>}
      </>
    );
  } else if (id === 'nivelacion') {
    body = <ListEditor items={site.nivelacion} onChange={(v) => setIn(['nivelacion'], v)} newItem={{ n: 'Nuevo plan', p: 10, li: [] }}
      fields={[['n', 'Nivel'], ['p', 'Precio por hora ($)', 'number'], ['li', 'Qué incluye (vacío = lo de siempre)', 'lines']]} addLabel="Agregar plan" />;
  } else if (id === 'unis') {
    body = Object.keys(site.unis || {}).map((k) => (
      <div key={k} className="sub-card">
        <b>{k}</b>
        <Text label="Nombre completo" value={site.unis[k].t} onChange={(v) => setIn(['unis', k, 't'], v)} />
        <Lines label="Tu curso en For Winners" value={site.unis[k].d} onChange={(v) => setIn(['unis', k, 'd'], v)} />
      </div>
    ));
  } else if (id === 'cursos') {
    const c = site.cursos || {};
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>Aparece en la ficha de cada universidad. Vacío = «Consultar por WhatsApp».</p>
        <b className="small">Curso presencial (UTN, UCE, UPEC, Yachay)</b>
        <Text label="Precio" placeholder="Ej.: desde $215" value={c.presencial?.precio} onChange={(v) => setIn(['cursos', 'presencial', 'precio'], v)} />
        <Text label="Inicio" placeholder="Ej.: 12 de enero" value={c.presencial?.inicio} onChange={(v) => setIn(['cursos', 'presencial', 'inicio'], v)} />
        <Text label="Horario" placeholder="Ej.: sábado y domingo 8:00–13:00" value={c.presencial?.horario} onChange={(v) => setIn(['cursos', 'presencial', 'horario'], v)} />
        <b className="small">Curso virtual por módulos</b>
        <Text label="Precio" value={c.virtual?.precio} onChange={(v) => setIn(['cursos', 'virtual', 'precio'], v)} />
        <Text label="Inicio" value={c.virtual?.inicio} onChange={(v) => setIn(['cursos', 'virtual', 'inicio'], v)} />
        <Text label="Horario" value={c.virtual?.horario} onChange={(v) => setIn(['cursos', 'virtual', 'horario'], v)} />
        <Text label="Precio por módulo" value={c.virtual?.porModulo} onChange={(v) => setIn(['cursos', 'virtual', 'porModulo'], v)} />
      </>
    );
  } else if (id === 'faq') {
    body = <ListEditor items={site.faq} onChange={(v) => setIn(['faq'], v)} newItem={{ q: '¿Nueva pregunta?', a: '' }} fields={[['q', 'Pregunta'], ['a', 'Respuesta', 'area']]} addLabel="Agregar pregunta" />;
  } else if (id === 'testimonios') {
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>Se muestran en el preuniversitario solo si hay alguno. Usa testimonios reales y con permiso.</p>
        <ListEditor items={site.testimonios} onChange={(v) => setIn(['testimonios'], v)} newItem={{ n: '', c: '', t: '' }} fields={[['n', 'Nombre'], ['c', 'Carrera / universidad'], ['t', 'Mensaje', 'area']]} addLabel="Agregar testimonio" />
      </>
    );
  } else if (id === 'seo') {
    const seo = (site.seo || {})[page] || {};
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>Para la página: <b>{PAGES.find(([v]) => v === page)?.[1]}</b>. Vacío = se queda el actual.</p>
        <Text label="Título en Google y en la pestaña" value={seo.title} onChange={(v) => setIn(['seo', page, 'title'], v)} />
        <Text label="Descripción en Google" area rows={3} value={seo.description} onChange={(v) => setIn(['seo', page, 'description'], v)} hint={`${(seo.description || '').length}/155 caracteres`} />
      </>
    );
  } else if (id === 'secciones') {
    const here = (site.sections || []).filter((x) => (x.page || 'index.html') === page);
    body = (
      <>
        <p className="small muted" style={{ margin: 0 }}>Bloques nuevos con el mismo estilo de la web, para promociones, cursos con precios o el horario. En esta página:</p>
        {here.map((x) => (
          <div key={x.id} className="sec-item" onClick={() => onPick({ kind: 'section', id: x.id })}>
            <span>{SECTION_TYPES[x.type]?.icon}</span><span className="grow">{x.title || SECTION_TYPES[x.type]?.label}</span>{!x.visible && <EyeOff size={13} />}
          </div>
        ))}
        <select className="input" value="" onChange={(e) => {
          if (!e.target.value) return;
          const nid = uid('sec');
          upd((d) => { (d.sections ||= []).push(newSection(e.target.value, nid, page)); });
          onPick({ kind: 'section', id: nid });
        }}>
          <option value="">＋ Agregar sección a esta página…</option>
          {Object.entries(SECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </>
    );
  }
  return (
    <>
      <Back onBack={onBack}>{p.label}</Back>
      <div className="pb">{body}</div>
    </>
  );
}

/* ---------- secciones nuevas ---------- */
function SectionPanel({ id, site, data, upd, onBack, onScroll }) {
  const i = (site.sections || []).findIndex((x) => x.id === id);
  const x = site.sections?.[i];
  useEffect(() => { if (x) onScroll(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!x) return <Back onBack={onBack}>Sección eliminada</Back>;
  const set = (patch) => upd((d) => { Object.assign(d.sections[i], patch); });
  const courses = publicSnapshot(data).courses;
  const toggleIn = (key, v) => set({ [key]: (x[key] || []).includes(v) ? x[key].filter((y) => y !== v) : [...(x[key] || []), v] });
  const t = x.type;
  return (
    <>
      <Back onBack={onBack}>{SECTION_TYPES[t]?.icon} {SECTION_TYPES[t]?.label}</Back>
      <div className="pb">
        <Check label="Mostrar en la web" checked={x.visible} onChange={(v) => set({ visible: v })} />
        <Select label="Página" value={x.page} onChange={(v) => set({ page: v })} options={PAGES.map(([value, label]) => ({ value, label }))} />
        <Field label="Ubicación"><Seg value={x.position || 'bottom'} onChange={(v) => set({ position: v })} options={[{ value: 'top', label: 'Arriba (después del inicio)' }, { value: 'bottom', label: 'Al final' }]} /></Field>
        <Select label="Fondo" value={x.bg || 'none'} onChange={(v) => set({ bg: v })} options={[{ value: 'none', label: 'Blanco' }, { value: 'alt', label: 'Gris azulado' }, { value: 'dark', label: 'Azul oscuro' }]} />
        {t === 'hero' && <Text label="Texto pequeño arriba" value={x.kicker} onChange={(v) => set({ kicker: v })} />}
        <Text label="Título" value={x.title} onChange={(v) => set({ title: v })} hint="*palabra* = color de acento" />
        <Text label="Subtítulo" area rows={2} value={x.subtitle} onChange={(v) => set({ subtitle: v })} />
        {t === 'text' && <Text label="Texto" area rows={5} value={x.body} onChange={(v) => set({ body: v })} />}
        {(t === 'hero' || t === 'text') && <ImageInput label="Imagen" value={x.image} onChange={(v) => set({ image: v })} />}
        {t === 'text' && x.image && <Seg value={x.imageSide || 'right'} onChange={(v) => set({ imageSide: v })} options={[{ value: 'left', label: 'Imagen a la izquierda' }, { value: 'right', label: 'A la derecha' }]} />}
        {t === 'features' && <ListEditor items={x.items} onChange={(v) => set({ items: v })} newItem={{ icon: '⭐', title: 'Nueva tarjeta', text: '' }} fields={[['icon', 'Emoji'], ['title', 'Título'], ['text', 'Texto', 'area']]} addLabel="Agregar tarjeta" />}
        {t === 'faq' && <ListEditor items={x.items} onChange={(v) => set({ items: v })} newItem={{ title: '¿Pregunta?', text: '' }} fields={[['title', 'Pregunta'], ['text', 'Respuesta', 'area']]} addLabel="Agregar pregunta" />}
        {t === 'courses' && (
          <>
            <Check label="Mostrar precios" checked={x.showPrices !== false} onChange={(v) => set({ showPrices: v })} />
            <Field label="Cursos (ninguno marcado = todos los visibles)">
              <div className="row" style={{ gap: 6 }}>
                {courses.map((c) => <button key={c.id} type="button" className={`chip toggle ${(x.courseIds || []).includes(c.id) ? 'on' : ''}`} style={(x.courseIds || []).includes(c.id) ? { background: '#0b3b8c' } : {}} onClick={() => toggleIn('courseIds', c.id)}>{c.name}</button>)}
              </div>
            </Field>
          </>
        )}
        {t === 'schedule' && (
          <Field label="Categorías (ninguna marcada = todas)">
            <div className="row" style={{ gap: 6 }}>
              {data.categories.map((c) => <button key={c.id} type="button" className={`chip toggle ${(x.categoryIds || []).includes(c.id) ? 'on' : ''}`} style={(x.categoryIds || []).includes(c.id) ? { background: c.color } : {}} onClick={() => toggleIn('categoryIds', c.id)}>{c.name}</button>)}
            </div>
          </Field>
        )}
        {t !== 'faq' && (
          <>
            <b className="small">Botones</b>
            <ListEditor items={x.buttons} onChange={(v) => set({ buttons: v })} newItem={{ label: 'Botón', url: '', style: 'primary' }} fields={[['label', 'Texto'], ['url', 'Enlace (vacío si abre WhatsApp)']]} addLabel="Agregar botón" />
            {(x.buttons || []).map((b, j) => (
              <Select key={j} label={`Estilo del botón «${b.label}»`} value={b.style} onChange={(v) => set({ buttons: x.buttons.map((y, k) => (k === j ? { ...y, style: v } : y)) })} options={Object.entries(BUTTON_STYLES).map(([value, label]) => ({ value, label }))} />
            ))}
          </>
        )}
        <Text label="Nombre para enlazar" hint={`Otros botones pueden llevar aquí con #${x.anchor || 'nombre'}`} value={x.anchor} onChange={(v) => set({ anchor: v.replace(/[^a-z0-9-]/gi, '').toLowerCase() })} />
        <div className="row">
          <button className="btn sm" onClick={() => upd((d) => { d.sections.splice(i + 1, 0, { ...structuredClone(x), id: uid('sec'), anchor: '' }); })}><Copy size={14} /> Duplicar</button>
          <button className="btn sm danger right" onClick={() => { if (confirm('¿Eliminar esta sección?')) { upd((d) => { d.sections.splice(i, 1); }); onBack(); } }}><Trash2 size={14} /> Eliminar</button>
        </div>
      </div>
    </>
  );
}
