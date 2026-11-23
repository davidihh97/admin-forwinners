// Registro de asistencia de estudiantes.
//   /firmar?k=CLAVE  → registro individual al salir de clase
//   /firmar?c=CÓDIGO → clase grupal (QR que muestra el profesor): profesor, materia y horario ya vienen fijados
import './kiosk.css';

const qs = new URLSearchParams(location.search);
const KEY = qs.get('k') || '';
const CODE = qs.get('c') || '';
const TZ = 'America/Guayaquil';
const $ = (s) => document.querySelector(s);
const body = $('#k-body');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const dur = (min) => { const h = Math.floor(min / 60); const m = Math.round(min % 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
const auth = () => (CODE ? { c: CODE } : { k: KEY });
let info = null;
let resetTimer = null;

function tick() {
  const d = new Date();
  $('#k-time').textContent = d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  $('#k-date').textContent = d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
}
tick();
setInterval(tick, 15000);

async function post(path, payload) {
  const res = await fetch(`/api/kiosk/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...auth() }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo conectar. Intenta otra vez.');
  return data;
}
async function get(path, params = {}) {
  const res = await fetch(`/api/kiosk/${path}?${new URLSearchParams({ ...params, ...auth() })}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo conectar.');
  return data;
}
const blocked = (title, msg) => { body.innerHTML = `<h1>${esc(title)}</h1><p>${esc(msg)}</p>`; };
const errBox = (msg) => `<div class="k-err">${esc(msg)}</div>`;

/* ---------- identidad: nombre + 4 dígitos ---------- */
function identity(container, onPick) {
  container.innerHTML = `
    <label class="k-label" for="q">Tu nombre</label>
    <input class="k-input" id="q" placeholder="Escribe tu nombre o apellido" autocomplete="off" autocapitalize="words" spellcheck="false" />
    <div class="k-list" id="list"></div>`;
  const q = container.querySelector('#q');
  const list = container.querySelector('#list');
  let t = null;
  let seq = 0;
  q.addEventListener('input', () => {
    clearTimeout(t);
    onPick(null);
    t = setTimeout(async () => {
      const v = q.value.trim();
      if (v.length < 2) { list.innerHTML = ''; return; }
      const my = ++seq;
      try {
        const res = await get('search', { q: v });
        if (my !== seq) return;
        list.innerHTML = res.length
          ? res.map((p, i) => `<button class="k-item" data-i="${i}" type="button"><span class="av">${esc(initials(p.name))}</span><span class="grow">${esc(p.name)}</span></button>`).join('')
          : `<p>No encontramos «${esc(v)}» entre los estudiantes. Revisa cómo lo escribiste o avisa en recepción.</p>`;
        list.querySelectorAll('.k-item').forEach((b) => b.addEventListener('click', () => {
          const p = res[+b.dataset.i];
          q.value = p.name;
          list.innerHTML = `<div class="k-picked"><span class="av">${esc(initials(p.name))}</span><b class="grow">${esc(p.name)}</b><button class="k-link" type="button" id="chg">Cambiar</button></div>`;
          list.querySelector('#chg').onclick = () => { q.value = ''; list.innerHTML = ''; onPick(null); q.focus(); };
          onPick(p);
        }));
      } catch (e) {
        list.innerHTML = errBox(e.message);
      }
    }, 220);
  });
  return q;
}

/* ---------- registro individual ---------- */
function startIndividual() {
  clearTimeout(resetTimer);
  body.className = 'k-card';
  body.innerHTML = `
    <div class="k-steps"><span class="on">1. Quién eres</span><span>2. Tu clase</span></div>
    <h1>Registrar asistencia</h1>
    <p>Hazlo al terminar tu clase. La fecha de hoy se toma automáticamente.</p>
    <div id="who"></div>
    <label class="k-label" for="pin">Últimos 4 dígitos de tu celular</label>
    <input class="k-input k-phone" id="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" />
    <div id="err"></div>
    <button class="k-btn" id="go" type="button" disabled>Continuar</button>`;
  let person = null;
  const go = $('#go');
  const ready = () => { go.disabled = !(person && /^\d{4}$/.test($('#pin').value)); };
  identity($('#who'), (p) => { person = p; ready(); }).focus();
  $('#pin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); ready(); });
  go.onclick = async () => {
    go.disabled = true;
    go.textContent = 'Verificando…';
    try {
      await post('verify', { person_id: person.id, phone4: $('#pin').value });
      classForm(person, $('#pin').value);
    } catch (e) {
      $('#err').innerHTML = errBox(e.message);
      go.textContent = 'Continuar';
      ready();
    }
  };
}

function roundNow(step = 5) {
  const [h, m] = info.now.split(':').map(Number);
  const t = Math.floor((h * 60 + m) / step) * step;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function classForm(person, pin) {
  const teachers = info.teachers || [];
  body.innerHTML = `
    <div class="k-steps"><span class="done">1. Quién eres</span><span class="on">2. Tu clase</span></div>
    <div class="k-who"><span class="av">${esc(initials(person.name))}</span><div><h1>${esc(person.name)}</h1><span class="k-action in">Hoy · ${esc(new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', timeZone: TZ }))}</span></div></div>
    <div class="k-grid2">
      <div><label class="k-label" for="start">Hora de entrada</label><input class="k-input" id="start" type="time" step="300" /></div>
      <div><label class="k-label" for="end">Hora de salida</label><input class="k-input" id="end" type="time" step="300" value="${roundNow()}" /></div>
    </div>
    <label class="k-label">Profesor</label>
    <div class="k-chips" id="teachers">${teachers.map((t) => `<button type="button" class="k-chip" data-id="${t.id}">${esc(t.name)}</button>`).join('') || '<p>No hay profesores registrados. Avisa en recepción.</p>'}</div>
    <label class="k-label" for="subject">Materia</label>
    <select class="k-input" id="subject"><option value="">Elige la materia…</option></select>
    <label class="k-label" for="topic">Tema revisado <span class="opt">(opcional)</span></label>
    <input class="k-input" id="topic" maxlength="200" placeholder="Ej.: Ecuaciones de segundo grado" />
    ${info.needSignature ? sigHtml() : ''}
    <div id="err"></div>
    <div class="k-row"><button class="k-btn ghost" id="back" type="button">Volver</button><button class="k-btn grow" id="ok" type="button">Registrar asistencia</button></div>`;
  let teacher = null;
  const fillSubjects = () => {
    const mine = teacher?.subjects?.length ? teacher.subjects : [];
    const rest = info.subjects.filter((s) => !mine.includes(s));
    $('#subject').innerHTML = '<option value="">Elige la materia…</option>'
      + (mine.length ? `<optgroup label="Materias de ${esc(teacher.name.split(' ')[0])}">${mine.map((s) => `<option>${esc(s)}</option>`).join('')}</optgroup><optgroup label="Otras">` : '')
      + rest.map((s) => `<option>${esc(s)}</option>`).join('') + (mine.length ? '</optgroup>' : '');
    if (mine.length === 1) $('#subject').value = mine[0];
  };
  fillSubjects();
  document.querySelectorAll('#teachers .k-chip').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#teachers .k-chip').forEach((x) => x.classList.toggle('on', x === b));
    teacher = teachers.find((t) => String(t.id) === b.dataset.id);
    fillSubjects();
  }));
  const pad = info.needSignature ? signaturePad($('#pad'), () => { $('#hint').style.display = 'none'; }) : null;
  $('#clear')?.addEventListener('click', () => { pad.clear(); $('#hint').style.display = ''; });
  $('#back').onclick = startIndividual;
  $('#ok').onclick = async () => {
    const err = $('#err');
    const start = $('#start').value;
    const end = $('#end').value;
    const problems = [];
    if (!start) problems.push('la hora de entrada');
    if (!end) problems.push('la hora de salida');
    if (!teacher) problems.push('el profesor');
    if (!$('#subject').value) problems.push('la materia');
    if (problems.length) { err.innerHTML = errBox(`Falta elegir ${problems.join(', ')}.`); return; }
    if (pad && pad.isEmpty()) { err.innerHTML = errBox('Firma en el recuadro antes de continuar.'); return; }
    const btn = $('#ok');
    btn.disabled = true;
    btn.textContent = 'Registrando…';
    try {
      done(await post('register', { person_id: person.id, phone4: pin, start, end, teacher_id: teacher.id, subject: $('#subject').value, topic: $('#topic').value, signature: pad && !pad.isEmpty() ? pad.toDataURL() : '' }), startIndividual, true);
    } catch (e) {
      err.innerHTML = errBox(e.message);
      btn.disabled = false;
      btn.textContent = 'Registrar asistencia';
    }
  };
}

/* ---------- clase grupal ---------- */
function startClass() {
  clearTimeout(resetTimer);
  const c = info.class;
  body.className = 'k-card';
  const card = `
    <div class="k-class">
      <small>Clase de hoy</small>
      <b>${esc(c.subject)}${c.topic ? ` · ${esc(c.topic)}` : ''}</b>
      <span>Profesor: ${esc(c.teacher)} · ${esc(c.start)} a ${esc(c.end)}</span>
    </div>`;
  if (c.state === 'early') return (body.innerHTML = `${card}<h1>Aún no se abre el registro</h1><p>Podrás registrarte desde las ${esc(c.opensAt)}. Vuelve a escanear el código al terminar la clase.</p>`);
  if (c.state === 'closed') return (body.innerHTML = `${card}<h1>El registro de esta clase ya se cerró</h1><p>Si no alcanzaste a registrarte, avisa a tu profesor o en recepción.</p>`);
  body.innerHTML = `
    ${card}
    <h1>Registra tu asistencia</h1>
    <p>Solo tu nombre y los últimos 4 dígitos de tu celular. El horario es el de la clase.</p>
    <div id="who"></div>
    <label class="k-label" for="pin">Últimos 4 dígitos de tu celular</label>
    <input class="k-input k-phone" id="pin" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" />
    <details class="k-late"><summary>¿Llegaste tarde o saliste antes?</summary>
      <p>Indica tu hora real. Solo puede ser dentro del horario de la clase.</p>
      <div class="k-grid2">
        <div><label class="k-label" for="start">Entré a las</label><input class="k-input" id="start" type="time" step="300" min="${esc(c.start)}" max="${esc(c.end)}" value="${esc(c.start)}" /></div>
        <div><label class="k-label" for="end">Salí a las</label><input class="k-input" id="end" type="time" step="300" min="${esc(c.start)}" max="${esc(c.end)}" value="${esc(c.end)}" /></div>
      </div>
    </details>
    ${info.needSignature ? sigHtml() : ''}
    <div id="err"></div>
    <button class="k-btn" id="ok" type="button" disabled>Registrar asistencia</button>`;
  let person = null;
  const ok = $('#ok');
  const ready = () => { ok.disabled = !(person && /^\d{4}$/.test($('#pin').value)); };
  identity($('#who'), (p) => { person = p; ready(); });
  $('#pin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); ready(); });
  const pad = info.needSignature ? signaturePad($('#pad'), () => { $('#hint').style.display = 'none'; }) : null;
  $('#clear')?.addEventListener('click', () => { pad.clear(); $('#hint').style.display = ''; });
  ok.onclick = async () => {
    const err = $('#err');
    const start = $('#start').value || c.start;
    const end = $('#end').value || c.end;
    if (start < c.start || end > c.end) { err.innerHTML = errBox(`La clase fue de ${c.start} a ${c.end}. Solo puedes indicar una hora dentro de ese horario.`); return; }
    if (pad && pad.isEmpty()) { err.innerHTML = errBox('Firma en el recuadro antes de continuar.'); return; }
    ok.disabled = true;
    ok.textContent = 'Registrando…';
    try {
      done(await post('register', { person_id: person.id, phone4: $('#pin').value, start, end, signature: pad && !pad.isEmpty() ? pad.toDataURL() : '' }), startClass, false);
    } catch (e) {
      err.innerHTML = errBox(e.message);
      ok.textContent = 'Registrar asistencia';
      ready();
    }
  };
}

/* ---------- listo ---------- */
function done(r, again, autoReset) {
  const first = String(r.name).split(/\s+/)[0];
  body.className = 'k-card k-done';
  body.innerHTML = `
    <div class="ic">✓</div>
    <h1>¡Listo, ${esc(first)}!</h1>
    <p>Asistencia registrada: ${esc(r.subject)} con ${esc(r.teacher)}, de ${esc(r.start)} a ${esc(r.end)}.</p>
    <div class="k-stats">
      <div class="k-stat"><small>Esta clase</small><b>${dur(r.minutes)}</b></div>
      <div class="k-stat"><small>Total este mes</small><b>${dur(r.monthMinutes || 0)}</b></div>
    </div>
    ${autoReset ? '<div class="k-bar"><i id="bar" style="width:100%"></i></div>' : ''}
    <button class="k-btn ghost" id="next" type="button">Registrar a otra persona</button>`;
  $('#next').onclick = again;
  if (autoReset) {
    requestAnimationFrame(() => { const b = $('#bar'); b.style.transitionDuration = '8s'; b.style.width = '0%'; });
    resetTimer = setTimeout(again, 8000);
  }
}

/* ---------- firma (opcional, según la configuración) ---------- */
const sigHtml = () => `
  <div><label class="k-label">Firma</label>
    <div class="k-sig-wrap"><canvas id="pad" aria-label="Recuadro para firmar"></canvas><div class="k-sig-line"></div><div class="k-sig-hint" id="hint">Firma sobre la línea</div></div>
    <button class="k-link" id="clear" type="button">Borrar firma</button></div>`;

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
    ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink += Math.hypot(p.x - last.x, p.y - last.y);
    onInk();
    last = p;
    e.preventDefault();
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  return {
    isEmpty: () => ink < 40,
    clear: size,
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
  if (!KEY && !CODE) return blocked('Enlace incompleto', 'Abre el enlace o escanea el código que te dieron en For Winners.');
  try {
    info = await get('info');
    if (info.title) $('#k-title').textContent = info.title;
    if (CODE) startClass();
    else startIndividual();
  } catch (e) {
    blocked('Enlace no disponible', e.message || 'No se pudo conectar.');
  }
})();
