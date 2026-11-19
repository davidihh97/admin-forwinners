/*
 * For Winners · contenido administrable para forwinnersec.com
 *
 * Inserta en la página principal, antes de </body>:
 *   <script src="https://admin.forwinnersec.com/fw-content.js"
 *           data-url="https://XXXX.supabase.co" data-key="ANON_KEY" defer></script>
 *
 * Luego, en el HTML:
 *   <div id="fw-root"></div>                 → todas las secciones del diseñador
 *   <div data-fw-section="sec-cursos"></div> → solo una sección (por su id)
 *   <span data-fw="hero_titulo"></span>     → un texto suelto ("Textos de la página")
 *   <a data-fw="boton_inscripcion">…</a>    → un enlace (cambia texto y dirección)
 *   <div data-fw-announcement></div>         → la barra de anuncio (si no existe, se pone arriba)
 */
import { renderSite, renderSection, renderAnnouncement, siteCss } from '../site/render.js';

(function () {
  const me = document.currentScript;
  const url = me?.dataset.url;
  const key = me?.dataset.key;
  if (!url || !key) return console.warn('[fw-content] faltan data-url y data-key');

  function mount(host, html, css) {
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style>${html}`;
  }

  function apply(site) {
    const pub = site.public || {};
    const css = siteCss(site.theme);

    for (const b of site.bindings || []) {
      document.querySelectorAll(`[data-fw="${CSS.escape(b.key)}"]`).forEach((el) => {
        if (b.type === 'link') {
          if (b.value) el.setAttribute('href', b.value);
          if (b.text) el.textContent = b.text;
        } else if (b.type === 'image') {
          if (b.value) el.setAttribute('src', b.value);
        } else if (b.value) {
          el.textContent = b.value;
        }
      });
    }

    const root = document.getElementById('fw-root');
    if (root) mount(root, renderSite(site, pub), css);

    document.querySelectorAll('[data-fw-section]').forEach((el) => {
      const s = (site.sections || []).find((x) => x.id === el.dataset.fwSection || x.anchor === el.dataset.fwSection);
      if (s && s.visible) mount(el, `<div class="fwc">${renderSection(s, pub, site)}</div>`, css);
      else el.style.display = 'none';
    });

    if (!root) {
      const ann = renderAnnouncement(site);
      let host = document.querySelector('[data-fw-announcement]');
      if (ann && !host) {
        host = document.createElement('div');
        document.body.prepend(host);
      }
      if (host) mount(host, ann ? `<div class="fwc">${ann}</div>` : '', css);
    }

    if (site.seo?.title) document.title = site.seo.title;
    if (site.seo?.description) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'description';
        document.head.appendChild(m);
      }
      m.content = site.seo.description;
    }
  }

  fetch(`${url}/rest/v1/content?key=eq.site_published&select=value`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
    .then((r) => r.json())
    .then((rows) => rows?.[0]?.value && apply(rows[0].value))
    .catch((e) => console.warn('[fw-content]', e));
})();
