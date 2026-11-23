// Describe en palabras qué cambió entre dos versiones de la web (para el historial).
import { PAGES, SERVICE_KEYS } from './defaultSite';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const pageName = (p) => PAGES.find(([v]) => v === p)?.[1] || p;
const short = (s, n = 40) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const STYLE_NAMES = {
  size: 'tamaño', color: 'color', bg: 'fondo', weight: 'grosor', italic: 'cursiva', align: 'alineación', transform: 'mayúsculas',
  mt: 'espacio arriba', mb: 'espacio abajo', pad: 'relleno', radius: 'esquinas', width: 'ancho', spacing: 'interletrado', lh: 'interlineado',
};

function describeOverride(a, b) {
  if (!a) a = {};
  if (!b) return `se quitaron los cambios de «${short(a.orig)}»`;
  const what = [];
  if (!same(a.text, b.text)) what.push(b.text ? `texto «${short(a.text || b.orig)}» → «${short(b.text)}»` : `texto vuelve a «${short(b.orig)}»`);
  if (!same(a.href, b.href)) what.push('enlace');
  if (!same(a.src, b.src)) what.push('imagen');
  if (!same(a.hidden, b.hidden)) what.push(b.hidden ? 'oculto' : 'visible otra vez');
  if (!same(a.pos, b.pos)) what.push('posición');
  if (!same(a.show, b.show)) what.push(b.show ? `solo en ${b.show === 'mobile' ? 'celular' : 'computadora'}` : 'en todos los dispositivos');
  if (!same(a.variant, b.variant)) what.push('estilo del botón');
  const keys = new Set([...Object.keys(a.style || {}), ...Object.keys(b.style || {})]);
  const st = [...keys].filter((k) => !same(a.style?.[k], b.style?.[k])).map((k) => STYLE_NAMES[k] || k);
  if (st.length) what.push(st.join(', '));
  return what.length ? `«${short(b.orig, 30)}»: ${what.join('; ')}` : null;
}

export function describeChanges(prev, next) {
  const out = [];
  if (!prev) return ['Primera publicación desde el panel'];
  const c0 = prev.config || {};
  const c1 = next.config || {};
  if (!same(c0.whatsapp, c1.whatsapp)) out.push(`WhatsApp: ${c0.whatsapp || '—'} → ${c1.whatsapp || '—'}`);
  if (!same(c0.waMsg, c1.waMsg)) out.push('Mensaje inicial de WhatsApp');
  if (!same(c0.canalWa, c1.canalWa)) out.push('Canal de WhatsApp de avisos');
  if (!same(prev.aviso, next.aviso)) {
    const a = next.aviso || {};
    out.push(prev.aviso?.enabled !== a.enabled ? `Aviso ${a.enabled ? 'activado' : 'desactivado'}` : `Aviso: «${short(a.texto)}»`);
  }
  if (!same(prev.theme, next.theme)) out.push('Colores y letras de la web');
  if (!same(prev.nivelacion, next.nivelacion)) out.push(`Nivelación: ${(next.nivelacion || []).map((x) => `${x.n} $${x.p}`).join(', ')}`);
  if (!same(prev.unis, next.unis)) out.push('Preuniversitario: textos de universidades');
  if (!same(prev.cursos, next.cursos)) out.push('Preuniversitario: precio, inicio u horario');
  if (!same(prev.faq, next.faq)) out.push(`Preguntas frecuentes (${(next.faq || []).length})`);
  if (!same(prev.testimonios, next.testimonios)) out.push(`Testimonios (${(next.testimonios || []).length})`);
  const p0 = prev.portada || {};
  const p1 = next.portada || {};
  if (!same(p0.order, p1.order) || !same(p0.hidden, p1.hidden)) out.push('Portada: orden o servicios ocultos');
  for (const [k, label] of SERVICE_KEYS) {
    if (!same(p0.services?.[k], p1.services?.[k])) out.push(`Portada: textos de ${label}`);
    if (!same(p0.media?.[k], p1.media?.[k])) out.push(`Portada: foto/video de ${label}`);
  }
  for (const [page] of PAGES) {
    const a = (prev.overrides || {})[page] || [];
    const b = (next.overrides || {})[page] || [];
    const sels = new Set([...a.map((x) => x.sel), ...b.map((x) => x.sel)]);
    for (const sel of sels) {
      const x = a.find((o) => o.sel === sel);
      const y = b.find((o) => o.sel === sel);
      if (same(x, y)) continue;
      const d = describeOverride(x, y);
      if (d) out.push(`${pageName(page)}: ${d}`);
    }
    if (!same((prev.seo || {})[page], (next.seo || {})[page])) out.push(`${pageName(page)}: título o descripción en Google`);
  }
  const s0 = prev.sections || [];
  const s1 = next.sections || [];
  for (const s of s1) {
    const o = s0.find((x) => x.id === s.id);
    if (!o) out.push(`${pageName(s.page)}: sección nueva «${short(s.title, 30)}»`);
    else if (!same(o, s)) out.push(`${pageName(s.page)}: sección «${short(s.title, 30)}» ${o.visible !== s.visible ? (s.visible ? 'visible' : 'oculta') : 'editada'}`);
  }
  for (const o of s0) if (!s1.find((x) => x.id === o.id)) out.push(`${pageName(o.page)}: se eliminó la sección «${short(o.title, 30)}»`);
  return out;
}
