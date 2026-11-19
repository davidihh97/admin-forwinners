import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, EyeOff, GripVertical, Plus, Trash2, Copy, ArrowUp, ArrowDown, Monitor, Smartphone, Send,
  Palette, Megaphone, Phone, Type, Search, Plug, ImageUp,
} from 'lucide-react';
import { useStore } from '../lib/store';
import * as backend from '../lib/backend';
import { renderSite, siteCss, FONTS } from '../site/render';
import { SECTION_TYPES, BUTTON_STYLES, newSection } from '../site/defaultSite';
import { buildPublished, publicSnapshot } from '../site/publish';
import { uid } from '../lib/time';
import { Text, Select, Seg, Check, Field } from '../components/ui';

const GLOBALS = [
  { id: '@theme', label: 'Colores y letra', icon: Palette },
  { id: '@announcement', label: 'Barra de anuncio', icon: Megaphone },
  { id: '@contact', label: 'Datos de contacto', icon: Phone },
  { id: '@bindings', label: 'Textos de la página actual', icon: Type },
  { id: '@seo', label: 'Google (SEO)', icon: Search },
  { id: '@connect', label: 'Conectar con la web', icon: Plug },
];

const SHELL = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0}</style><style id="css"></style></head><body><div id="root"></div>
<script>
addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.fwRender) {
    document.getElementById('css').textContent = d.css;
    document.getElementById('root').innerHTML = d.html;
    if (d.scrollTo) { var el = document.querySelector('[data-sec="' + d.scrollTo + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
});
document.addEventListener('click', function (e) {
  var a = e.target.closest('a'); if (a) e.preventDefault();
  var s = e.target.closest('[data-sec]');
  if (s) parent.postMessage({ fwSelect: s.getAttribute('data-sec') }, '*');
});
parent.postMessage({ fwReady: true }, '*');
</script></body></html>`;

export default function SiteDesigner() {
  const { site, data, notify } = useStore();
  const s = site.doc;
  const [sel, setSel] = useState(s.sections[0]?.id || '@theme');
  const [device, setDevice] = useState('desktop');
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [published, setPublished] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const frame = useRef();
  const stage = useRef();
  const [scale, setScale] = useState(1);
  const [stageH, setStageH] = useState(600);

  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / 1280));
      setStageH(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scrollTo = useRef(null);
  const pub = useMemo(() => publicSnapshot(data), [data]);

  useEffect(() => {
    backend.load('site_published').then((v) => setPublished(v)).catch(() => setPublished(null));
  }, []);

  const send = () => {
    frame.current?.contentWindow?.postMessage(
      { fwRender: true, css: siteCss(s.theme), html: renderSite(s, pub, { edit: true, selectedId: sel }), scrollTo: scrollTo.current },
      '*'
    );
    scrollTo.current = null;
  };
  useEffect(send, [s, pub, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.fwReady) send();
      if (e.data?.fwSelect) setSel(e.data.fwSelect);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  });

  const select = (id) => {
    setSel(id);
    if (!id.startsWith('@')) scrollTo.current = id;
  };
  const idx = s.sections.findIndex((x) => x.id === sel);
  const section = s.sections[idx];
  const upd = (fn) => site.update(fn);
  const updSec = (patch) => upd((d) => { Object.assign(d.sections.find((x) => x.id === sel), patch); });

  const move = (from, to) => {
    if (to < 0 || to >= s.sections.length || from === to) return;
    upd((d) => { const [x] = d.sections.splice(from, 1); d.sections.splice(to, 0, x); });
  };
  const addSection = (type) => {
    const id = uid('sec-');
    upd((d) => { d.sections.splice(idx >= 0 ? idx + 1 : d.sections.length, 0, newSection(type, id)); });
    select(id);
  };

  const dirty = published !== undefined && stable(s) !== stable(published ? stripPub(published) : null);

  async function publish() {
    setBusy(true);
    try {
      const p = buildPublished(s, data);
      await backend.save('site_published', p);
      setPublished(p);
      notify(backend.isCloud ? '¡Publicado! Los cambios ya se ven en forwinnersec.com' : 'Publicado (modo local: conecta Supabase para que llegue a la web)');
    } catch (e) {
      notify(`No se pudo publicar: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="grow">
          <h1>Diseñador de la página web</h1>
          <p className="muted">Haz clic en cualquier parte de la vista previa para editarla. Los cambios se guardan como borrador hasta que pulses <b>Publicar</b>.</p>
        </div>
        {published?.publishedAt && <span className="small muted">Última publicación: {new Date(published.publishedAt).toLocaleString('es-EC')}</span>}
        <button className="btn accent" onClick={publish} disabled={busy}>
          <Send size={16} /> {busy ? 'Publicando…' : dirty ? 'Publicar cambios' : 'Publicar'}
        </button>
      </div>

      <div className="designer">
        <div className="dz-panel">
          <div className="ph">Secciones de la página</div>
          <div className="pb" style={{ gap: 2, paddingTop: 8 }}>
            {s.sections.map((x, i) => (
              <div
                key={x.id}
                className={`sec-item ${x.id === sel ? 'on' : ''} ${x.visible ? '' : 'off'} ${overIdx === i ? 'dragover' : ''}`}
                onClick={() => select(x.id)}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDragLeave={() => setOverIdx(null)}
                onDrop={() => { move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              >
                <GripVertical size={15} className="grip" />
                <span>{SECTION_TYPES[x.type]?.icon}</span>
                <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.title || SECTION_TYPES[x.type]?.label}</span>
                <button className="btn sm ghost icon" title={x.visible ? 'Ocultar' : 'Mostrar'}
                  onClick={(e) => { e.stopPropagation(); upd((d) => { d.sections[i].visible = !d.sections[i].visible; }); }}>
                  {x.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            ))}
            <select className="input" style={{ marginTop: 8 }} value="" onChange={(e) => e.target.value && addSection(e.target.value)}>
              <option value="">＋ Agregar sección…</option>
              {Object.entries(SECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          <div className="ph" style={{ borderTop: '1px solid var(--line)' }}>Toda la página</div>
          <div className="pb" style={{ gap: 2, paddingTop: 8 }}>
            {GLOBALS.map((g) => (
              <div key={g.id} className={`sec-item ${sel === g.id ? 'on' : ''}`} onClick={() => select(g.id)}>
                <g.icon size={15} /> {g.label}
              </div>
            ))}
          </div>
        </div>

        <div className="preview-box">
          <div className="preview-bar">
            <Seg value={device} onChange={setDevice} options={[{ value: 'desktop', label: <><Monitor size={14} /> Computadora</> }, { value: 'mobile', label: <><Smartphone size={14} /> Celular</> }]} />
            <span className="small muted right">{dirty ? '● Hay cambios sin publicar' : published ? '✓ Todo publicado' : 'Aún no se ha publicado'}</span>
          </div>
          <div className={`preview-stage ${device}`} ref={stage}>
            <iframe
              ref={frame}
              className="preview-frame"
              title="Vista previa"
              srcDoc={SHELL}
              sandbox="allow-scripts"
              style={device === 'desktop' ? { transform: `scale(${scale})`, height: stageH / scale, borderRadius: 0 } : undefined}
            />
          </div>
        </div>

        <div className="dz-panel dz-props">
          {section ? (
            <SectionProps
              key={section.id}
              section={section}
              site={s}
              data={data}
              onChange={updSec}
              onMove={(d) => move(idx, idx + d)}
              onDuplicate={() => { const id = uid('sec-'); upd((d) => { d.sections.splice(idx + 1, 0, { ...structuredClone(section), id, anchor: '' }); }); select(id); }}
              onDelete={() => { if (confirm('¿Eliminar esta sección?')) { upd((d) => { d.sections.splice(idx, 1); }); setSel('@theme'); } }}
            />
          ) : (
            <GlobalProps id={sel} site={s} upd={upd} />
          )}
        </div>
      </div>
    </>
  );
}

// Postgres (jsonb) reordena las claves: comparamos con las claves ordenadas.
const stable = (v) =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const stripPub = ({ public: _p, publishedAt: _t, ...rest }) => rest;

function ImageInput({ label, value, onChange }) {
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);
  async function up(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      onChange(await backend.uploadImage(f));
    } catch (err) {
      notify(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Field label={label}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="grow" placeholder="https://… (enlace de la imagen)" value={value?.startsWith('data:') ? '(imagen subida)' : value || ''} onChange={(e) => onChange(e.target.value)} />
        <label className="btn sm" title="Subir imagen"><ImageUp size={14} />{busy ? '…' : ''}<input type="file" accept="image/*" hidden onChange={up} /></label>
        {value && <button className="btn sm ghost danger" onClick={() => onChange('')} title="Quitar"><Trash2 size={14} /></button>}
      </div>
    </Field>
  );
}

function ButtonsEditor({ buttons = [], onChange, site }) {
  const set = (i, patch) => onChange(buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const wa = site.contact?.whatsapp ? `https://wa.me/${String(site.contact.whatsapp).replace(/\D/g, '')}` : '';
  return (
    <div className="col">
      <div className="row"><b className="grow small">Botones</b>
        <button className="btn sm" onClick={() => onChange([...buttons, { label: 'Nuevo botón', url: '', style: 'primary' }])}><Plus size={13} /> Botón</button>
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="sub-card">
          <Text label="Texto del botón" value={b.label} onChange={(v) => set(i, { label: v })} />
          <Text label="¿A dónde lleva?" hint="Un enlace (https://…), o #seccion para bajar a una parte de la página" value={b.url} onChange={(v) => set(i, { url: v })} />
          {wa && b.url !== wa && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set(i, { url: wa })}>Usar enlace de WhatsApp</button>}
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="grow"><Select label="Estilo" value={b.style} onChange={(v) => set(i, { style: v })} options={Object.entries(BUTTON_STYLES).map(([value, label]) => ({ value, label }))} /></div>
            <button className="btn sm ghost icon" disabled={i === 0} onClick={() => { const n = [...buttons]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} title="Mover antes"><ArrowUp size={14} /></button>
            <button className="btn sm ghost danger icon" onClick={() => onChange(buttons.filter((_, j) => j !== i))} title="Quitar"><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemsEditor({ items = [], onChange, withIcon, labels }) {
  const set = (i, patch) => onChange(items.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="col">
      <div className="row"><b className="grow small">{labels.group}</b>
        <button className="btn sm" onClick={() => onChange([...items, { icon: '⭐', title: labels.newTitle, text: '' }])}><Plus size={13} /> Agregar</button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="sub-card">
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            {withIcon && <input className="input" style={{ width: 54, textAlign: 'center' }} value={it.icon} onChange={(e) => set(i, { icon: e.target.value })} title="Emoji" />}
            <input className="input grow" value={it.title} onChange={(e) => set(i, { title: e.target.value })} placeholder={labels.title} />
          </div>
          <textarea className="input" rows={3} value={it.text} onChange={(e) => set(i, { text: e.target.value })} placeholder={labels.text} />
          <div className="row">
            <button className="btn sm ghost icon" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }}><ArrowUp size={14} /></button>
            <button className="btn sm ghost icon" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange(n); }}><ArrowDown size={14} /></button>
            <button className="btn sm ghost danger right" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /> Quitar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionProps({ section: x, site, data, onChange, onMove, onDuplicate, onDelete }) {
  const t = x.type;
  const courses = publicSnapshot(data).courses;
  const toggleIn = (key, id) => onChange({ [key]: (x[key] || []).includes(id) ? x[key].filter((y) => y !== id) : [...(x[key] || []), id] });
  return (
    <>
      <div className="ph">
        <span>{SECTION_TYPES[t]?.icon}</span><span className="grow">{SECTION_TYPES[t]?.label}</span>
        <button className="btn sm ghost icon" onClick={() => onMove(-1)} title="Subir"><ArrowUp size={14} /></button>
        <button className="btn sm ghost icon" onClick={() => onMove(1)} title="Bajar"><ArrowDown size={14} /></button>
        <button className="btn sm ghost icon" onClick={onDuplicate} title="Duplicar"><Copy size={14} /></button>
        <button className="btn sm ghost icon danger" onClick={onDelete} title="Eliminar"><Trash2 size={14} /></button>
      </div>
      <div className="pb">
        <Check label="Mostrar esta sección en la página" checked={x.visible} onChange={(v) => onChange({ visible: v })} />
        {t === 'hero' && <Text label="Texto pequeño sobre el título" value={x.kicker} onChange={(v) => onChange({ kicker: v })} />}
        <Text label="Título" value={x.title} onChange={(v) => onChange({ title: v })} />
        <Text label="Subtítulo" area rows={3} value={x.subtitle} onChange={(v) => onChange({ subtitle: v })} />
        {(t === 'text' || t === 'cta') && <Text label="Texto" area rows={6} value={x.body} onChange={(v) => onChange({ body: v })} />}
        {(t === 'hero' || t === 'text') && <ImageInput label="Imagen" value={x.image} onChange={(v) => onChange({ image: v })} />}
        {t === 'text' && x.image && <Seg value={x.imageSide || 'right'} onChange={(v) => onChange({ imageSide: v })} options={[{ value: 'left', label: 'Imagen a la izquierda' }, { value: 'right', label: 'Imagen a la derecha' }]} />}

        {t === 'features' && <ItemsEditor withIcon items={x.items} onChange={(v) => onChange({ items: v })} labels={{ group: 'Tarjetas', newTitle: 'Nueva tarjeta', title: 'Título', text: 'Descripción' }} />}
        {t === 'faq' && <ItemsEditor items={x.items} onChange={(v) => onChange({ items: v })} labels={{ group: 'Preguntas', newTitle: '¿Nueva pregunta?', title: 'Pregunta', text: 'Respuesta' }} />}

        {t === 'courses' && (
          <>
            <Check label="Mostrar precios" checked={x.showPrices !== false} onChange={(v) => onChange({ showPrices: v })} />
            <Field label="Cursos que aparecen" hint="Si no eliges ninguno, se muestran todos los visibles. Precios y horas se actualizan solos desde Cursos y precios.">
              <div className="row" style={{ gap: 6 }}>
                {courses.map((c) => (
                  <button key={c.id} type="button" className={`chip toggle ${(x.courseIds || []).includes(c.id) ? 'on' : ''}`} style={(x.courseIds || []).includes(c.id) ? { background: '#0b3b8c' } : {}} onClick={() => toggleIn('courseIds', c.id)}>{c.name}</button>
                ))}
              </div>
            </Field>
          </>
        )}
        {t === 'schedule' && (
          <Field label="Categorías que aparecen" hint="Si no eliges ninguna, se muestran todas. El horario se toma de la sección Horario.">
            <div className="row" style={{ gap: 6 }}>
              {data.categories.map((c) => (
                <button key={c.id} type="button" className={`chip toggle ${(x.categoryIds || []).includes(c.id) ? 'on' : ''}`} style={(x.categoryIds || []).includes(c.id) ? { background: c.color } : {}} onClick={() => toggleIn('categoryIds', c.id)}>{c.name}</button>
              ))}
            </div>
          </Field>
        )}
        {t === 'contact' && <Text label="Mapa de Google (enlace para insertar)" hint="En Google Maps: Compartir → Insertar un mapa → copia solo el enlace que está en src=&quot;…&quot;" value={x.mapUrl} onChange={(v) => onChange({ mapUrl: v })} />}

        {t !== 'faq' && <ButtonsEditor buttons={x.buttons} site={site} onChange={(v) => onChange({ buttons: v })} />}

        <b className="small" style={{ marginTop: 6 }}>Diseño</b>
        <Field label="Alineación">
          <Seg value={x.align || 'left'} onChange={(v) => onChange({ align: v })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} />
        </Field>
        <Select label="Fondo" value={x.bg || 'none'} onChange={(v) => onChange({ bg: v })} options={[
          { value: 'none', label: 'Blanco' }, { value: 'light', label: 'Gris claro' }, { value: 'primary', label: 'Color principal' },
          { value: 'dark', label: 'Oscuro' }, { value: 'custom', label: 'Personalizado…' },
        ]} />
        {x.bg === 'custom' && (
          <div className="grid g2">
            <Field label="Color de fondo"><input type="color" value={x.bgColor || '#0b3b8c'} onChange={(e) => onChange({ bgColor: e.target.value })} /></Field>
            <Field label="Color del texto"><input type="color" value={x.textColor || '#ffffff'} onChange={(e) => onChange({ textColor: e.target.value })} /></Field>
          </div>
        )}
        <Field label="Espacio arriba y abajo">
          <Seg value={x.padding || 'm'} onChange={(v) => onChange({ padding: v })} options={[{ value: 's', label: 'Poco' }, { value: 'm', label: 'Normal' }, { value: 'l', label: 'Mucho' }]} />
        </Field>
        <Text label="Nombre para enlazar (ancla)" hint={`Los botones pueden llevar aquí con #${x.anchor || x.id}`} value={x.anchor} onChange={(v) => onChange({ anchor: v.replace(/[^a-z0-9-_]/gi, '').toLowerCase() })} placeholder={x.id} />
      </div>
    </>
  );
}

function GlobalProps({ id, site, upd }) {
  const set = (group) => (k) => (v) => upd((d) => { d[group] = { ...(d[group] || {}), [k]: v }; });
  if (id === '@theme') {
    const th = set('theme');
    return (
      <>
        <div className="ph"><Palette size={16} /> Colores y letra</div>
        <div className="pb">
          <div className="grid g2">
            <Field label="Color principal"><input type="color" value={site.theme.primary} onChange={(e) => th('primary')(e.target.value)} /></Field>
            <Field label="Color de acento"><input type="color" value={site.theme.accent} onChange={(e) => th('accent')(e.target.value)} /></Field>
            <Field label="Color del texto"><input type="color" value={site.theme.text} onChange={(e) => th('text')(e.target.value)} /></Field>
            <Field label="Fondo de la página"><input type="color" value={site.theme.bg} onChange={(e) => th('bg')(e.target.value)} /></Field>
          </div>
          <Select label="Tipo de letra" value={site.theme.font} onChange={th('font')} options={Object.keys(FONTS)} />
          <Field label={`Esquinas redondeadas (${site.theme.radius}px)`}>
            <input type="range" min={0} max={30} value={site.theme.radius} onChange={(e) => th('radius')(Number(e.target.value))} />
          </Field>
        </div>
      </>
    );
  }
  if (id === '@announcement') {
    const a = site.announcement || {};
    const sa = set('announcement');
    return (
      <>
        <div className="ph"><Megaphone size={16} /> Barra de anuncio</div>
        <div className="pb">
          <p className="small muted" style={{ margin: 0 }}>Una franja arriba de toda la página para promociones o avisos.</p>
          <Check label="Mostrar la barra" checked={a.enabled} onChange={sa('enabled')} />
          <Text label="Mensaje" value={a.text} onChange={sa('text')} />
          <Text label="Texto del enlace" value={a.linkLabel} onChange={sa('linkLabel')} />
          <Text label="Enlace" value={a.link} onChange={sa('link')} />
          <div className="grid g2">
            <Field label="Fondo"><input type="color" value={a.bg || '#f5b301'} onChange={(e) => sa('bg')(e.target.value)} /></Field>
            <Field label="Texto"><input type="color" value={a.color || '#14213d'} onChange={(e) => sa('color')(e.target.value)} /></Field>
          </div>
        </div>
      </>
    );
  }
  if (id === '@contact') {
    const c = site.contact || {};
    const sc = set('contact');
    return (
      <>
        <div className="ph"><Phone size={16} /> Datos de contacto</div>
        <div className="pb">
          <p className="small muted" style={{ margin: 0 }}>Se usan en la sección Contacto y en los botones de WhatsApp.</p>
          <Text label="WhatsApp (con código de país)" placeholder="593 9…" value={c.whatsapp} onChange={sc('whatsapp')} />
          <Text label="Teléfono" value={c.phone} onChange={sc('phone')} />
          <Text label="Correo" value={c.email} onChange={sc('email')} />
          <Text label="Dirección" area rows={2} value={c.address} onChange={sc('address')} />
          <Text label="Horario de atención" value={c.hours} onChange={sc('hours')} />
        </div>
      </>
    );
  }
  if (id === '@seo') {
    const se = set('seo');
    return (
      <>
        <div className="ph"><Search size={16} /> Cómo aparece en Google</div>
        <div className="pb">
          <Text label="Título de la pestaña" value={site.seo?.title} onChange={se('title')} placeholder="For Winners | Preuniversitario en …" />
          <Text label="Descripción" area rows={3} value={site.seo?.description} onChange={se('description')} hint="Máximo unos 155 caracteres" />
          <div className="sub-card">
            <div style={{ color: '#1a0dab', fontSize: '1.05rem' }}>{site.seo?.title || 'For Winners'}</div>
            <div style={{ color: '#006621', fontSize: '.8rem' }}>forwinnersec.com</div>
            <div className="small" style={{ color: '#545454' }}>{site.seo?.description || 'Descripción de la página…'}</div>
          </div>
        </div>
      </>
    );
  }
  if (id === '@bindings') {
    const list = site.bindings || [];
    const setB = (i, patch) => upd((d) => { Object.assign(d.bindings[i], patch); });
    return (
      <>
        <div className="ph"><Type size={16} /> Textos de la página actual</div>
        <div className="pb">
          <p className="small muted" style={{ margin: 0 }}>
            Para cambiar textos que ya existen en forwinnersec.com. Cada texto tiene una <b>clave</b>; en la página se marca una sola vez el lugar con <code>data-fw="clave"</code> y desde aquí cambias su contenido cuando quieras.
          </p>
          {list.map((b, i) => (
            <div key={i} className="sub-card">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input grow" value={b.label} onChange={(e) => setB(i, { label: e.target.value })} placeholder="Nombre (para ti)" />
                <button className="btn sm ghost danger icon" onClick={() => upd((d) => { d.bindings.splice(i, 1); })}><Trash2 size={14} /></button>
              </div>
              <div className="grid g2">
                <Text label="Clave" value={b.key} onChange={(v) => setB(i, { key: v.replace(/[^a-z0-9_-]/gi, '').toLowerCase() })} />
                <Select label="Tipo" value={b.type} onChange={(v) => setB(i, { type: v })} options={[{ value: 'text', label: 'Texto' }, { value: 'link', label: 'Enlace / botón' }, { value: 'image', label: 'Imagen' }]} />
              </div>
              {b.type === 'link' && <Text label="Texto del botón" value={b.text} onChange={(v) => setB(i, { text: v })} />}
              {b.type === 'image' ? (
                <ImageInput label="Imagen" value={b.value} onChange={(v) => setB(i, { value: v })} />
              ) : (
                <Text label={b.type === 'link' ? 'Enlace' : 'Contenido'} area={b.type === 'text'} rows={2} value={b.value} onChange={(v) => setB(i, { value: v })} />
              )}
              <code className="small muted">data-fw="{b.key}"</code>
            </div>
          ))}
          <button className="btn" onClick={() => upd((d) => { (d.bindings ||= []).push({ key: `texto_${(d.bindings.length || 0) + 1}`, label: 'Nuevo texto', type: 'text', value: '' }); })}><Plus size={14} /> Agregar texto</button>
        </div>
      </>
    );
  }
  // @connect
  const ep = backend.publicEndpoint;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://admin.forwinnersec.com';
  const snippet = ep
    ? `<script src="${origin}/fw-content.js"\n  data-url="${ep.url}"\n  data-key="${ep.anonKey}" defer></script>`
    : '(Conecta Supabase primero: ver README)';
  return (
    <>
      <div className="ph"><Plug size={16} /> Conectar con forwinnersec.com</div>
      <div className="pb">
        <p className="small" style={{ margin: 0 }}>Esto se hace <b>una sola vez</b> en el código de la página principal. Después todo se cambia desde aquí.</p>
        <b className="small">1. Pega esto antes de &lt;/body&gt;:</b>
        <textarea className="input mono small" rows={5} readOnly value={snippet} onFocus={(e) => e.target.select()} />
        <b className="small">2. Donde quieras las secciones del diseñador:</b>
        <code className="small">&lt;div id="fw-root"&gt;&lt;/div&gt;</code>
        <span className="small muted">o una sola sección: <code>&lt;div data-fw-section="cursos"&gt;&lt;/div&gt;</code> (usa el nombre de ancla de la sección).</span>
        <b className="small">3. Para textos existentes:</b>
        <code className="small">&lt;h1 data-fw="hero_titulo"&gt;Texto actual&lt;/h1&gt;</code>
        <span className="small muted">Si el panel no tiene un valor, se queda el texto original. Así nada se rompe.</span>
      </div>
    </>
  );
}
