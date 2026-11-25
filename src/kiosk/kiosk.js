// Página pública de firma de asistencia: /firmar?k=CLAVE
// Funciona en una tablet fija en recepción (vuelve sola al inicio) o en el celular de cada estudiante.
import './kiosk.css';

const KEY = new URLSearchParams(location.search).get('k') || '';
const $ = (s) => document.querySelector(s);
const body = $('#k-body');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const TZ = 'America/Guayaquil';
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const dur = (min) => { const h = Math.floor(min / 60); const m = Math.round(min % 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
let info = null;
let resetTimer = null;

function tick() {
  const d = new Date();
  $('#k-time').textContent = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  $('#k-date').textContent = d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
}
tick();
setInterval(tick, 15000);

async function api(path, payload) {
  const res = await fetch(`/api/kiosk/${path}`, payload
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, k: KEY }) }
    : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo conectar. Intenta otra vez.');
  return data;
}

function blocked(msg) {
  body.innerHTML = `<h1>Enlace no disponible</h1><p>${esc(msg)}</p>`;
}

/* ---------- paso 1: buscar el nombre ---------- */
function start() {
  clearTimeout(resetTimer);
  body.innerHTML = `
    <h1>¿Quién eres?</h1>
    <p>Escribe tu nombre o apellido y elígelo de la lista.</p>
    <input class="k-input" id="q" placeholder="Ej.: Ana Pérez" autocomplete="off" autocapitalize="words" spellcheck="false" />
    <div class="k-list" id="list"></div>
    ${info.allowUnknown ? '<button class="k-link" id="unknown" type="button">No aparezco en la lista</button>' : ''}`;
  const q = $('#q');
  const list = $('#list');
  let t = null;
  let seq = 0;
  q.focus();
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const v = q.value.trim();
      if (v.length < 2) { list.innerHTML = ''; return; }
      const my = ++seq;
      try {
        const res = await fetch(`/api/kiosk/search?k=${encodeURIComponent(KEY)}&q=${encodeURIComponent(v)}`).then((r) => r.json());
        if (my !== seq) return;
        if (!Array.isArray(res)) throw new Error(res.error);
        list.innerHTML = res.length
          ? res.map((p, i) => `<button class="k-item" data-i="${i}" type="button"><span class="av">${esc(initials(p.name))}</span><span class="grow">${esc(p.name)}</span>${p.type === 'teacher' ? '<span class="k-tag">Profesor</span>' : ''}${p.inside ? '<span class="k-tag in">Dentro</span>' : ''}</button>`).join('')
          : `<p>No encontramos «${esc(v)}».${info.allowUnknown ? ' Revisa cómo lo escribiste o usa «No aparezco en la lista».' : ' Avisa en recepción.'}</p>`;
        list.querySelectorAll('.k-item').forEach((b) => b.addEventListener('click', () => sign(res[+b.dataset.i])));
      } catch (e) {
        list.innerHTML = `<div class="k-err">${esc(e.message || 'Error de conexión')}</div>`;
      }
    }, 220);
  });
  $('#unknown')?.addEventListener('click', () => {
    body.innerHTML = `
      <h1>Escribe tu nombre completo</h1>
      <p>Lo revisaremos en recepción para agregarte a la lista.</p>
      <input class="k-input" id="nm" placeholder="Nombre y apellido" autocapitalize="words" />
      <div class="k-row"><button class="k-btn ghost" id="back" type="button">Volver</button><button class="k-btn grow" id="go" type="button">Continuar</button></div>`;
    $('#nm').focus();
    $('#back').onclick = start;
    $('#go').onclick = () => { const n = $('#nm').value.trim(); if (n.split(/\s+/).length >= 2) sign({ name: n, unknown: true }); else $('#nm').focus(); };
  });
}

/* ---------- paso 2: firmar ---------- */
function sign(person) {
  const inside = !!person.inside;
  body.innerHTML = `
    <div class="k-who"><span class="av">${esc(initials(person.name))}</span><div><h1>${esc(person.name)}</h1>
      <span class="k-action ${inside ? 'out' : 'in'}">${inside ? '← Registrar salida' : '→ Registrar entrada'} · ${hm(new Date().toISOString())}</span></div></div>
    ${info.needPhone && !person.unknown ? '<label><p style="margin-bottom:6px">Últimos 4 dígitos de tu celular</p><input class="k-input k-phone" id="ph" inputmode="numeric" maxlength="4" autocomplete="off" /></label>' : ''}
    <div><p style="margin-bottom:8px">Firma aquí con el dedo o el mouse</p>
      <div class="k-sig-wrap"><canvas id="pad" aria-label="Recuadro para firmar"></canvas><div class="k-sig-line"></div><div class="k-sig-hint" id="hint">Firma sobre la línea</div></div></div>
    <div id="err"></div>
    <div class="k-row"><button class="k-btn ghost" id="back" type="button">Volver</button><button class="k-btn ghost" id="clear" type="button">Borrar firma</button><button class="k-btn grow" id="ok" type="button">Firmar y registrar</button></div>`;
  const pad = signaturePad($('#pad'), () => { $('#hint').style.display = 'none'; $('#err').innerHTML = ''; });
  $('#back').onclick = start;
  $('#clear').onclick = () => { pad.clear(); $('#hint').style.display = ''; };
  $('#ok').onclick = async () => {
    const err = $('#err');
    err.innerHTML = '';
    if (info.needSignature && pad.isEmpty()) { err.innerHTML = '<div class="k-err">Firma en el recuadro antes de continuar.</div>'; return; }
    const btn = $('#ok');
    btn.disabled = true;
    btn.textContent = 'Registrando…';
    try {
      const r = await api('sign', { person_id: person.unknown ? undefined : person.id, name: person.unknown ? person.name : undefined, phone4: $('#ph')?.value, signature: pad.isEmpty() ? '' : pad.toDataURL() });
      done(r);
    } catch (e) {
      err.innerHTML = `<div class="k-err">${esc(e.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Firmar y registrar';
    }
  };
}

/* ---------- paso 3: listo ---------- */
function done(r) {
  const first = String(r.name).split(/\s+/)[0];
  const out = r.action === 'out';
  body.className = 'k-card k-done';
  body.innerHTML = `
    <div class="ic ${out ? 'out' : ''}">${out ? '👋' : '✓'}</div>
    <h1>${out ? `¡Hasta pronto, ${esc(first)}!` : `¡Bienvenido, ${esc(first)}!`}</h1>
    <p>${out ? `Salida registrada a las ${hm(r.check_out)}` : `Entrada registrada a las ${hm(r.check_in)}`}</p>
    <div class="k-stats">
      ${out ? `<div class="k-stat"><small>Hoy estuviste</small><b>${dur(r.minutes)}</b></div>` : ''}
      <div class="k-stat"><small>Total este mes</small><b>${dur(r.monthMinutes || 0)}</b></div>
    </div>
    <div class="k-bar"><i id="bar" style="width:100%"></i></div>
    <button class="k-btn ghost" id="next" type="button">Siguiente persona</button>`;
  const next = () => { body.className = 'k-card'; start(); };
  $('#next').onclick = next;
  requestAnimationFrame(() => { const b = $('#bar'); b.style.transitionDuration = '7s'; b.style.width = '0%'; });
  resetTimer = setTimeout(next, 7000);
}

/* ---------- recuadro de firma ---------- */
function signaturePad(canvas, onInk) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let last = null;
  let ink = 0;
  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b2a5b';
    ctx.lineWidth = 2.6;
    ink = 0;
  }
  size();
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    const mx = (last.x + p.x) / 2;
    const my = (last.y + p.y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, mx, my);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink += Math.hypot(p.x - last.x, p.y - last.y);
    if (ink > 0) onInk();
    last = p;
    e.preventDefault();
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  return {
    isEmpty: () => ink < 40,
    clear: size,
    // Copia reducida para que cada firma pese poco.
    toDataURL() {
      const c = document.createElement('canvas');
      const r = canvas.getBoundingClientRect();
      const scale = Math.min(1, 480 / r.width);
      c.width = Math.round(r.width * scale);
      c.height = Math.round(r.height * scale);
      c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    },
  };
}

/* ---------- inicio ---------- */
(async () => {
  if (!KEY) return blocked('Abre el enlace completo que te dieron en For Winners.');
  try {
    info = await fetch(`/api/kiosk/info?k=${encodeURIComponent(KEY)}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
    if (info.title) $('#k-title').textContent = info.title;
    start();
  } catch (e) {
    blocked(e.message || 'No se pudo conectar.');
  }
})();
