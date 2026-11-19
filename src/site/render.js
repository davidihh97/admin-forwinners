// Dibuja las secciones de la página pública a partir del contenido guardado en el panel.
// Lo usan tanto la vista previa del diseñador como el script fw-content.js que se
// inserta en forwinnersec.com, así lo que ves en el panel es lo que se publica.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nl = (s) => esc(s).replace(/\n/g, '<br>');
const safeUrl = (u) => {
  const s = String(u ?? '').trim();
  if (!s) return '#';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(s)) return esc(s);
  if (/^wa\.me|^www\./i.test(s)) return esc(`https://${s}`);
  return '#';
};

const imgUrl = (u) =>
  /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(String(u || '')) ? u : safeUrl(u);

const col = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : d);

export const FONTS = {
  Inter: 'Inter, system-ui, sans-serif',
  Poppins: 'Poppins, system-ui, sans-serif',
  Montserrat: 'Montserrat, system-ui, sans-serif',
  Nunito: 'Nunito, system-ui, sans-serif',
  Sistema: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};

const DAY_ORDER =['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function siteCss(theme = {}) {
  const t = {
    primary: '#0b3b8c',
    accent: '#f5b301',
    text: '#14213d',
    bg: '#ffffff',
    font: 'Inter',
    radius: 14,
    ...theme,
  };
  t.primary = col(t.primary, '#0b3b8c');
  t.accent = col(t.accent, '#f5b301');
  t.text = col(t.text, '#14213d');
  t.bg = col(t.bg, '#ffffff');
  t.font = FONTS[t.font] ? FONTS[t.font] : FONTS.Inter;
  t.radius = Math.max(0, Math.min(40, Number(t.radius) || 0));
  return `
  .fwc{--p:${t.primary};--a:${t.accent};--t:${t.text};--bg:${t.bg};--r:${Number(t.radius)}px;
    font-family:${t.font};color:var(--t);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased}
  .fwc *{box-sizing:border-box}
  .fwc-sec{padding:64px 20px;position:relative}
  .fwc-sec.pad-s{padding:32px 20px}.fwc-sec.pad-l{padding:104px 20px}
  .fwc-in{max-width:1100px;margin:0 auto}
  .fwc-sec.al-center .fwc-head,.fwc-sec.al-center .fwc-btns{text-align:center;justify-content:center}
  .fwc-sec.al-right .fwc-head,.fwc-sec.al-right .fwc-btns{text-align:right;justify-content:flex-end}
  .fwc-sec.bg-light{background:#f4f6fb}
  .fwc-sec.bg-primary{background:var(--p);color:#fff}
  .fwc-sec.bg-dark{background:#0f172a;color:#fff}
  .fwc h1{font-size:clamp(2rem,4.5vw,3.3rem);line-height:1.1;margin:0 0 16px;letter-spacing:-.02em}
  .fwc h2{font-size:clamp(1.6rem,3vw,2.3rem);line-height:1.15;margin:0 0 12px;letter-spacing:-.01em}
  .fwc h3{font-size:1.1rem;margin:0 0 6px}
  .fwc p{margin:0 0 12px}
  .fwc .fwc-sub{font-size:1.15rem;opacity:.85;max-width:720px}
  .fwc-sec.al-center .fwc-sub{margin-left:auto;margin-right:auto}
  .fwc-sec.al-right .fwc-sub{margin-left:auto}
  .fwc-btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
  .fwc-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:999px;font-weight:600;
    text-decoration:none;transition:transform .15s,box-shadow .15s;border:2px solid transparent;font-size:1rem}
  .fwc-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.15)}
  .fwc-btn.primary{background:var(--a);color:#14213d}
  .fwc-btn.secondary{background:var(--p);color:#fff}
  .fwc-btn.outline{border-color:currentColor;color:inherit}
  .fwc-btn.whatsapp{background:#25d366;color:#fff}
  .fwc-hero{display:grid;gap:40px;align-items:center}
  .fwc-hero.has-img{grid-template-columns:1.1fr .9fr}
  .fwc-hero img{width:100%;border-radius:var(--r);box-shadow:0 20px 50px rgba(0,0,0,.18)}
  .fwc-grid{display:grid;gap:20px;margin-top:32px;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))}
  .fwc-card{background:#fff;color:#14213d;border-radius:var(--r);padding:24px;box-shadow:0 2px 12px rgba(15,23,42,.08);border:1px solid rgba(15,23,42,.06)}
  .fwc-ico{font-size:2rem;margin-bottom:8px;display:block}
  .fwc-price{font-size:1.6rem;font-weight:700;color:var(--p);margin-top:8px}
  .fwc-meta{font-size:.9rem;opacity:.7}
  .fwc-tag{display:inline-block;background:rgba(11,59,140,.08);color:var(--p);border-radius:999px;padding:3px 10px;font-size:.78rem;font-weight:600;margin-bottom:10px}
  .fwc-text{display:grid;gap:40px;align-items:center}
  .fwc-text.has-img{grid-template-columns:1fr 1fr}
  .fwc-text.img-left .fwc-media{order:-1}
  .fwc-text img{width:100%;border-radius:var(--r)}
  .fwc-faq details{background:#fff;color:#14213d;border-radius:var(--r);padding:16px 20px;margin-top:12px;border:1px solid rgba(15,23,42,.08)}
  .fwc-faq summary{font-weight:600;cursor:pointer}
  .fwc-faq details p{margin:10px 0 0}
  .fwc-table{width:100%;border-collapse:collapse;margin-top:24px;background:#fff;color:#14213d;border-radius:var(--r);overflow:hidden;font-size:.92rem}
  .fwc-table th,.fwc-table td{padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb}
  .fwc-table th{background:var(--p);color:#fff;font-weight:600}
  .fwc-ann{padding:10px 16px;text-align:center;font-weight:600;font-size:.95rem}
  .fwc-ann a{color:inherit;text-decoration:underline;margin-left:8px}
  .fwc-contact{display:grid;gap:12px;margin-top:24px;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
  .fwc-contact a{color:inherit}
  .fwc-map{margin-top:24px;width:100%;height:320px;border:0;border-radius:var(--r)}
  @media (max-width:760px){.fwc-hero.has-img,.fwc-text.has-img{grid-template-columns:1fr}.fwc-sec{padding:48px 16px}}
  [data-fw-edit] .fwc-sec{cursor:pointer;outline:2px dashed transparent;outline-offset:-2px;transition:outline-color .15s}
  [data-fw-edit] .fwc-sec:hover{outline-color:rgba(37,99,235,.5)}
  [data-fw-edit] .fwc-sec.is-sel{outline:3px solid #2563eb}
  [data-fw-edit] .fwc-sec.is-hidden{opacity:.35}
  `;
}

const btns = (list = []) =>
  list.length
    ? `<div class="fwc-btns">${list
        .filter((b) => b.label)
        .map((b) => `<a class="fwc-btn ${esc(b.style || 'primary')}" href="${safeUrl(b.url)}"${/^https?:/i.test(b.url || '') ? ' target="_blank" rel="noopener"' : ''}>${esc(b.label)}</a>`)
        .join('')}</div>`
    : '';

const head = (s) =>
  `<div class="fwc-head">${s.title ? `<h2>${esc(s.title)}</h2>` : ''}${s.subtitle ? `<p class="fwc-sub">${nl(s.subtitle)}</p>` : ''}</div>`;

const renderers = {
  hero: (s) => `
    <div class="fwc-hero ${s.image ? 'has-img' : ''}">
      <div><div class="fwc-head">${s.kicker ? `<span class="fwc-tag">${esc(s.kicker)}</span>` : ''}<h1>${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="fwc-sub">${nl(s.subtitle)}</p>` : ''}</div>${btns(s.buttons)}</div>
      ${s.image ? `<div><img src="${imgUrl(s.image)}" alt="${esc(s.imageAlt || s.title)}"></div>` : ''}
    </div>`,
  features: (s) => `${head(s)}
    <div class="fwc-grid">${(s.items || [])
      .map((i) => `<div class="fwc-card">${i.icon ? `<span class="fwc-ico">${esc(i.icon)}</span>` : ''}<h3>${esc(i.title)}</h3><p>${nl(i.text)}</p></div>`)
      .join('')}</div>${btns(s.buttons)}`,
  courses: (s, pub) => {
    const list = (pub.courses || []).filter((c) => !s.courseIds?.length || s.courseIds.includes(c.id));
    return `${head(s)}<div class="fwc-grid">${list
      .map(
        (c) => `<div class="fwc-card">${c.group ? `<span class="fwc-tag">${esc(c.group)}</span>` : ''}<h3>${esc(c.name)}</h3>
        <p class="fwc-meta">${esc(String(c.hours).replace('.', ','))} horas · ${esc(c.weeks)} semanas</p>
        ${c.format ? `<p>${esc(c.format)}</p>` : ''}
        ${s.showPrices !== false && c.price ? `<div class="fwc-price">$${esc(c.price)}</div>` : ''}</div>`
      )
      .join('')}</div>${btns(s.buttons)}`;
  },
  schedule: (s, pub) => {
    const rows = (pub.schedule || [])
      .filter((b) => !s.categoryIds?.length || s.categoryIds.includes(b.categoryId))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start.localeCompare(b.start));
    return `${head(s)}<div style="overflow-x:auto"><table class="fwc-table"><thead><tr><th>Día</th><th>Horario</th><th>Clase</th></tr></thead><tbody>${rows
      .map((b) => `<tr><td>${esc(b.day)}</td><td>${esc(b.start)} – ${esc(b.end)}</td><td>${esc(b.service)}</td></tr>`)
      .join('')}</tbody></table></div>${btns(s.buttons)}`;
  },
  text: (s) => `
    <div class="fwc-text ${s.image ? 'has-img' : ''} ${s.imageSide === 'left' ? 'img-left' : ''}">
      <div>${head(s)}${s.body ? `<p>${nl(s.body)}</p>` : ''}${btns(s.buttons)}</div>
      ${s.image ? `<div class="fwc-media"><img src="${imgUrl(s.image)}" alt="${esc(s.title)}"></div>` : ''}
    </div>`,
  cta: (s) => `${head(s)}${s.body ? `<p>${nl(s.body)}</p>` : ''}${btns(s.buttons)}`,
  faq: (s) => `${head(s)}<div class="fwc-faq">${(s.items || [])
    .map((i) => `<details><summary>${esc(i.title)}</summary><p>${nl(i.text)}</p></details>`)
    .join('')}</div>`,
  contact: (s, pub, site) => {
    const c = site.contact || {};
    const line = (label, v, href) => (v ? `<div class="fwc-card"><h3>${label}</h3><p>${href ? `<a href="${safeUrl(href)}">${esc(v)}</a>` : esc(v)}</p></div>` : '');
    const wa = c.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}` : '';
    return `${head(s)}<div class="fwc-contact">
      ${line('WhatsApp', c.whatsapp, wa)}${line('Teléfono', c.phone, c.phone && `tel:${c.phone}`)}
      ${line('Correo', c.email, c.email && `mailto:${c.email}`)}${line('Dirección', c.address)}${line('Horario de atención', c.hours)}
      </div>${btns(s.buttons)}${s.mapUrl && /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(s.mapUrl) ? `<iframe class="fwc-map" src="${esc(s.mapUrl)}" loading="lazy"></iframe>` : ''}`;
  },
};

export function renderSection(s, pub, site, { edit = false, selectedId } = {}) {
  const r = renderers[s.type];
  if (!r) return '';
  const style = s.bg === 'custom' ? ` style="background:${col(s.bgColor, '#0b3b8c')};color:${col(s.textColor, '#ffffff')}"` : '';
  const cls = [
    'fwc-sec',
    `fwc-${s.type}-sec`,
    `bg-${s.bg || 'none'}`,
    `al-${s.align || 'left'}`,
    `pad-${s.padding || 'm'}`,
    edit && s.id === selectedId ? 'is-sel' : '',
    edit && !s.visible ? 'is-hidden' : '',
  ].join(' ');
  return `<section class="${cls}"${style} id="${esc(s.anchor || s.id)}"${edit ? ` data-sec="${esc(s.id)}"` : ''}><div class="fwc-in">${r(s, pub, site)}</div></section>`;
}

export function renderAnnouncement(site) {
  const a = site.announcement;
  if (!a?.enabled || !a.text) return '';
  return `<div class="fwc-ann" style="background:${col(a.bg, '#f5b301')};color:${col(a.color, '#14213d')}">${esc(a.text)}${a.link ? `<a href="${safeUrl(a.link)}">${esc(a.linkLabel || 'Ver más')}</a>` : ''}</div>`;
}

/** Página completa (todas las secciones visibles). */
export function renderSite(site, pub, opts = {}) {
  const secs = (site.sections || []).filter((s) => opts.edit || s.visible);
  return `<div class="fwc"${opts.edit ? ' data-fw-edit' : ''}>${renderAnnouncement(site)}${secs
    .map((s) => renderSection(s, pub, site, opts))
    .join('')}</div>`;
}
