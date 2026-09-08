// ADECI26 · app de asistentes
import { DIAS, PROGRAMA } from '/data/programa.js';
import { speaker } from '/data/speakers.js';
import { AUTORIDADES, COMITE_CIENTIFICO } from '/data/comite.js';
import { firebaseConfig } from '/js/firebase-config.js';

// ───────────────────────── estado ─────────────────────────
const LS = 'adeci26';
const S = {
  token: localStorage.getItem(LS + ':token') || '',
  user: JSON.parse(localStorage.getItem(LS + ':user') || 'null'),
  progreso: null,
  config: { overrides: {}, libroUrl: '', standTexto: '', sorteoInfo: '' },
  avisos: [],
  dia: null,
};
const INTERESES = [
  ['manos', 'Higiene de manos y piel'], ['superficies', 'Desinfección de superficies'], ['biofilm', 'Control de biofilm'],
  ['esterilizacion', 'Esterilización y DAN'], ['monitoreo', 'Monitoreo y validación'], ['otro', 'Otra cosa · lo cuento en el stand'],
];
const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $toast = document.getElementById('toast');

// ───────────────────────── utilidades ─────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = (r) => { location.hash = '#/' + r; };
let toastT;
function toast(msg, isErr = false) {
  $toast.textContent = msg; $toast.className = 'toast on' + (isErr ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('on'), 3200);
}

// Hora Argentina (UTC-3). Para probar otro momento: localStorage.setItem('adeci26:fakeNow','2026-09-17T14:50')
function nowAR() {
  const fake = localStorage.getItem(LS + ':fakeNow');
  const d = fake ? new Date(fake + ':00Z') : new Date(Date.now() - 3 * 3600e3);
  const iso = d.toISOString();
  return { fecha: iso.slice(0, 10), hm: iso.slice(11, 16), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
function diaDeHoy() { const f = nowAR().fecha; const d = DIAS.find(x => x.fecha === f); return d ? d.n : null; }

async function api(accion, body = {}) {
  const headers = { 'content-type': 'application/json' };
  if (S.token) headers.authorization = 'Bearer ' + S.token;
  const r = await fetch('/api/' + accion, { method: 'POST', headers, body: JSON.stringify(body) });
  let d; try { d = await r.json(); } catch { d = { error: 'Respuesta inválida del servidor.' }; }
  if (!r.ok) {
    if (r.status === 401 && S.token && accion !== 'register') { logout(false); }
    throw new Error(d.error || 'Error ' + r.status);
  }
  return d;
}

function setSession(token, user) {
  S.token = token; S.user = user;
  localStorage.setItem(LS + ':token', token);
  localStorage.setItem(LS + ':user', JSON.stringify(user));
}
function logout(redirect = true) {
  S.token = ''; S.user = null; S.progreso = null;
  localStorage.removeItem(LS + ':token'); localStorage.removeItem(LS + ':user');
  if (redirect) { location.hash = '#/'; render(); }
}

// ───────────────────────── datos derivados ─────────────────────────
function sesion(id) {
  const s = PROGRAMA.find(x => x.id === id); if (!s) return null;
  const ov = S.config.overrides?.[id];
  return ov ? { ...s, titulo: ov.titulo || s.titulo, participantesOverride: ov.participantes || null } : s;
}
function programaDia(n) { return PROGRAMA.filter(s => s.dia === n).map(s => sesion(s.id)); }
function enCurso() {
  const { fecha, min } = nowAR();
  const dia = DIAS.find(d => d.fecha === fecha); if (!dia) return { dia: null };
  const lista = programaDia(dia.n);
  const actual = lista.find(s => toMin(s.ini) <= min && min < toMin(s.fin));
  const proximas = lista.filter(s => toMin(s.ini) > min).slice(0, 2);
  return { dia: dia.n, actual, proximas, terminado: !actual && !proximas.length };
}
function nombresDe(s) {
  if (s.participantesOverride) return s.participantesOverride;
  return (s.roles || []).flatMap(r => r.ids.map(id => speaker(id).nombre)).join(' · ');
}

// ───────────────────────── vistas ─────────────────────────
function appbar(titulo, back = null, right = '') {
  return `<div class="appbar">
    ${back ? `<button class="back" data-go="${back}" aria-label="Volver">‹</button>` : ''}
    <div class="word grow">${titulo}</div>
    <div class="right">${right}</div>
  </div>`;
}

function vLogin() {
  $app.className = 'no-nav'; $nav.hidden = true;
  return `<div class="login">
    <img class="banner" src="https://adeci.org.ar/congresos/2026/img/ADECI-2026-logo-congreso-blanco.png" alt="ADECI 2026 · Córdoba, 17 y 18 de septiembre" onerror="this.style.display='none'">
    <div class="plate">
      <h2>Bienvenido al congreso</h2>
      <p>Registrate con tu nombre y tu correo para guardar tu avance en <b>Tus 5 momentos</b> y participar del sorteo de ADOX.</p>
      <form id="f-login" class="mt">
        <div class="field"><label for="nombre">Nombre</label><input id="nombre" name="nombre" autocomplete="given-name" required maxlength="60"></div>
        <div class="field"><label for="apellido">Apellido</label><input id="apellido" name="apellido" autocomplete="family-name" required maxlength="60"></div>
        <div class="field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="email" required maxlength="120" placeholder="nombre@correo.com">
          <div class="help">Si ya te registraste, con el mismo correo recuperás tu avance.</div></div>
        <div class="error" id="login-err" hidden></div>
        <button class="btn btn-p full" type="submit" id="login-btn">Entrar</button>
      </form>
    </div>
    <div class="foot">Congreso ADECI 2026 · Córdoba, 17 y 18 de septiembre</div>
    <div class="apoyo"><span>Con el apoyo de</span><img src="/img/adox-wordmark-white.png" alt="ADOX"></div>
  </div>`;
}

function vAhora() {
  const ec = enCurso();
  const p = S.progreso;
  const hoy = diaDeHoy();
  let live = '';
  if (ec.dia && ec.actual) {
    const s = ec.actual;
    live = `<div class="live">
      <div class="now"><span class="dot"></span> En sala · hasta las ${s.fin}</div>
      <h3>${esc(s.titulo)}</h3>
      ${s.sub ? `<div class="who">${esc(s.sub)}</div>` : ''}
      ${nombresDe(s) ? `<div class="who">${esc(nombresDe(s))}</div>` : ''}
      <div class="cta">
        <button class="btn btn-w" data-go="sesion/${s.id}">Ver sesión</button>
        ${!['pausa', 'posters', 'acto'].includes(s.tipo) ? `<button class="btn btn-o" data-go="sesion/${s.id}#comentar">Comentar</button>` : ''}
      </div></div>`;
  } else if (ec.dia && ec.terminado) {
    live = `<div class="live"><div class="now">Día ${ec.dia}</div><h3>Terminó la jornada de hoy</h3><div class="who">${ec.dia === 1 ? 'Mañana seguimos desde las 8:00.' : 'Gracias por acompañarnos. Hasta ADECI 2027.'}</div></div>`;
  } else if (!ec.dia) {
    const antes = nowAR().fecha < DIAS[0].fecha;
    live = `<div class="live"><div class="now">${antes ? 'Falta poco' : 'Congreso finalizado'}</div>
      <h3>${antes ? 'ADECI 2026 empieza el jueves 17' : 'Gracias por participar'}</h3>
      <div class="who">${antes ? 'Mientras tanto, mirá el programa y conocé a los speakers.' : 'El programa y los speakers siguen disponibles.'}</div>
      <div class="cta"><button class="btn btn-w" data-go="programa">Ver programa</button></div></div>`;
  }
  const prox = ec.dia && ec.proximas?.length ? `<div class="sec-t">A continuación</div>` + ec.proximas.map(s =>
    `<div class="card tap next" data-go="sesion/${s.id}"><div class="t">${s.ini}</div><div><div class="n">${esc(s.titulo)}</div>${nombresDe(s) ? `<div class="s">${esc(nombresDe(s))}</div>` : ''}</div></div>`).join('') : '';

  const avisos = S.avisos.length ? S.avisos.slice(0, 3).map(a => `<div class="aviso">${a.titulo ? `<div class="t">${esc(a.titulo)}</div>` : ''}${a.texto ? `<div class="x">${esc(a.texto)}</div>` : ''}<div class="h">${hora(a.at)}</div></div>`).join('') : '';

  const completos = p?.completos ?? 0;
  return appbar('ADECI<span>26</span>', null, `<span class="muted" style="color:var(--celeste)">${esc(S.user?.nombre || '')}</span>`) + `<div class="body">
    ${avisos}
    ${live}
    ${prox}
    <div class="sec-t">Participá y ganá</div>
    <div class="card" style="border-left:3px solid var(--teal)">
      <div style="font-size:22px;font-weight:900;color:var(--navy);letter-spacing:-.5px;line-height:1.15">Recorré tus 5 momentos de ADECI 2026</div>
      <div class="small mt-s" style="color:var(--txt-2);line-height:1.55">Te invitamos a un recorrido interactivo por el congreso.<br>Cuando cumplís cada uno de tus 5 momentos, sumás una gota.<br>Con tus 5 gotas, acercate al stand de ADOX.<br>Retirá tu regalo y registrate para el sorteo.</div>
      <div class="row mt" style="gap:10px">
        <div style="display:flex;gap:5px">${[1,2,3,4,5].map(n => `<span style="font-size:18px;${n <= completos ? '' : 'opacity:.25;filter:grayscale(1)'}">💧</span>`).join('')}</div>
        <div class="muted grow">${completos} de 5 gotas</div>
      </div>
      <button class="btn btn-p full mt" data-go="juego">Conocé el juego</button>
    </div>
    <div class="sec-t">Conocé el congreso</div>
    <div class="card tap row" data-go="comite"><div class="grow"><div class="b">Comité organizador</div><div class="muted">Autoridades y Comité Científico</div></div><span style="color:var(--txt-3);font-size:20px">›</span></div>
    <div class="sec-t">Con el apoyo de</div>
    <div class="card tap center" data-go="adox" style="padding:22px 15px 18px">
      <img src="/img/adox-logo.png" alt="ADOX · Gestionando innovación" style="width:82%;max-width:320px">
      <div class="muted mt">${esc(S.config.standTexto || 'Stand de ADOX')} · Cómo participar del sorteo →</div>
    </div>
  </div>`;
}
const hora = (ts) => { const d = new Date(ts - 3 * 3600e3); return d.toISOString().slice(11, 16); };

function vPrograma() {
  const n = S.dia || diaDeHoy() || 1;
  S.dia = n;
  const ec = enCurso();
  const lista = programaDia(n).map(s => {
    const brk = ['pausa', 'posters'].includes(s.tipo);
    const live = ec.dia === n && ec.actual?.id === s.id;
    const nombres = nombresDe(s);
    return `<div class="card slot ${brk ? 'break' : ''} ${s.tipo === 'acto' ? 'key' : ''} ${live ? 'live-now' : ''} ${brk ? '' : 'tap'}" ${brk ? '' : `data-go="sesion/${s.id}"`}>
      <div class="h"><span>${s.ini} – ${s.fin}</span>${live ? '<span class="tag">● en curso</span>' : ''}</div>
      ${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}
      <div class="ti">${esc(s.titulo)}</div>
      ${nombres ? `<div class="sp">${esc(nombres)}</div>` : ''}
    </div>`;
  }).join('');
  return appbar('Programa') + `<div class="days">${DIAS.map(d => `<button class="${d.n === n ? 'on' : ''}" data-dia="${d.n}">${d.label} · Día ${d.n}</button>`).join('')}</div>
    <div class="body"><div class="tl">${lista}</div>
    <div class="muted center mt">Tocá una sesión para ver quién participa y dejar tu comentario.<br>Sala plenaria única · Hotel Quórum, Córdoba.</div></div>`;
}

function personHTML(id, tema) {
  const sp = speaker(id);
  const ini = sp.nombre.replace(/^(Lic\.|Dra?\.|Mg\.|Prof\.|Esp\.|Farm\.|Ing\.|Antrop\.)\s*/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('');
  const ph = sp.foto ? `<img class="ph" src="${sp.foto}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;ph ini&quot;>${esc(ini)}</div>'">` : `<div class="ph ini">${esc(ini)}</div>`;
  if (sp.sinPerfil) return `<div class="person plain">${ph}<div><div class="nm">${esc(sp.nombre)}</div>${tema ? `<div class="tm">${esc(tema)}</div>` : ''}</div></div>`;
  return `<button class="person" data-speaker="${esc(id)}">${ph}<div><div class="nm">${esc(sp.nombre)}</div>${tema ? `<div class="tm">${esc(tema)}</div>` : '<div class="tm">Ver perfil</div>'}</div><span class="go">›</span></button>`;
}

function vSesion(id) {
  const s = sesion(id); if (!s) return appbar('Sesión', 'programa') + `<div class="empty">No encontramos esa sesión.</div>`;
  const dia = DIAS.find(d => d.n === s.dia);
  const comentable = !['pausa', 'posters'].includes(s.tipo);
  const mio = S.progreso?.detalle?.comentarios?.find(c => c.sesionId === id);
  let gente = '';
  if (s.participantesOverride) gente = `<div class="card"><div class="muted" style="letter-spacing:1.6px;text-transform:uppercase;font-weight:800;font-size:11px">Participan</div><div class="mt-s" style="font-size:14.5px;line-height:1.45">${esc(s.participantesOverride)}</div></div>`;
  else if (s.roles?.length) gente = `<div class="card people" style="padding-top:4px">` + s.roles.map(r => `<div class="rol">${esc(r.rol)}</div>` + r.ids.map(id => personHTML(id, r.temas?.[id])).join('')).join('') + `</div>`;

  return appbar('Sesión', 'programa') + `<div class="hero">
      <div class="kicker">${esc(dia.label)} · ${s.ini} – ${s.fin}</div>
      ${s.sub ? `<div class="kicker" style="color:#fff;opacity:.9">${esc(s.sub)}</div>` : ''}
      <h1>${esc(s.titulo)}</h1><p>Sala plenaria · Hotel Quórum</p>
    </div>
    <div class="body">
      ${gente}
      ${comentable ? `<div class="sec-t" id="comentar">Tu comentario sobre esta sesión</div>
      <div class="card">
        <div class="muted small" style="margin-bottom:10px">Qué te llevás, qué te sorprendió, qué aplicarías en tu servicio. Con tres sesiones comentadas ganás la gota del <b>momento 4</b>.</div>
        <form id="f-coment" data-sesion="${id}">
          <div class="field"><textarea name="texto" maxlength="600" placeholder="Escribí tu comentario…" required>${esc(mio?.texto || '')}</textarea></div>
          <div class="error" id="coment-err" hidden></div>
          <button class="btn btn-p full" type="submit">${mio ? 'Actualizar comentario' : 'Guardar comentario'}</button>
          ${mio ? '<div class="muted center mt-s">Ya dejaste tu comentario en esta sesión ✓</div>' : ''}
        </form>
      </div>` : ''}
    </div>`;
}

function vJuego() {
  const p = S.progreso || { momentos: {}, completos: 0, gotas: 0, inscripto: false, detalle: { trivia: {}, comentarios: [] } };
  const m = p.momentos, d = p.detalle;
  const hoy = diaDeHoy();
  const stepCls = (k, isNow) => `step ${m[k] ? 'ok' : ''} ${!m[k] && isNow ? 'now' : ''}`;
  const primeroPendiente = ['m1', 'm2', 'm3', 'm4', 'm5'].find(k => !m[k]);
  const gota = (k) => m[k] ? `<div class="st">Gota ganada 💧</div>` : '';

  // M1 · llegada
  let m1act = '';
  if (!m.m1) m1act = hoy ? `<div class="act"><button class="btn btn-p sm" data-act="checkin">Ya estoy en el congreso</button></div>` : `<div class="st" style="color:var(--txt-3)">Se habilita el 17 de septiembre, cuando llegues.</div>`;

  // M5 · conocé ADOX
  const ad = d.adox;
  const m5act = ad ? `<div class="dd">Te interesa: ${ad.intereses.map(k => (INTERESES.find(x => x[0] === k) || [k, k])[1]).join(' · ')}</div>`
    : `<form class="act" id="f-adox"><div class="dd" style="margin-bottom:8px">¿Qué te interesaría ver en el stand? Marcá una o más:</div>
       ${INTERESES.map(([k, l]) => `<label class="chk"><input type="checkbox" name="int" value="${k}"><span>${esc(l)}</span></label>`).join('')}
       <div class="error" hidden></div><button class="btn btn-p sm mt-s" type="submit">Guardar</button></form>`;

  const final = p.completos === 5 ? `<div class="card" style="background:var(--grad);color:#fff;border:0;margin-bottom:16px">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--celeste)">${p.inscripto ? 'Inscripción confirmada' : '¡Completaste los 5 momentos!'}</div>
      <div style="font-size:19px;font-weight:900;margin-top:4px;line-height:1.2">${p.inscripto ? 'Ya estás en el sorteo. ¡Suerte!' : 'Pasá por el stand de ADOX a retirar tu regalo y registrarte para el sorteo'}</div>
      <div class="small mt-s" style="color:var(--celeste-pale)">${p.inscripto ? 'Tu regalo ya fue entregado. Acercate al stand para el sorteo: para ganar, hay que estar presente.' : 'Abrí «Yo» y mostrá tu QR: el staff de ADOX lo escanea con su celular y listo.'}</div>
      ${p.inscripto ? '' : `<button class="btn btn-w mt" data-go="yo">Mostrar mi QR</button>`}</div>` : '';

  // M2 · trivia
  const tr = d.trivia || {};
  const trDias = [1, 2].filter(x => tr[x]);
  const m2st = trDias.length ? `<div class="st">${trDias.map(x => `Día ${x}: ${tr[x].correctas} de ${tr[x].total} correctas`).join(' · ')}</div>` : '';
  let m2act = '';
  if (hoy && !tr[hoy]) m2act = `<div class="act"><button class="btn btn-p sm" data-go="trivia/${hoy}">Responder la trivia de hoy</button></div>`;
  else if (hoy && tr[hoy]) m2act = `<div class="act"><button class="btn btn-g sm" data-go="trivia/${hoy}">Ver mis respuestas</button></div>`;
  else if (!hoy) m2act = `<div class="st" style="color:var(--txt-3)">Se habilita el 17 de septiembre.</div>`;

  // M3 · e-póster
  const m3 = d.eposter;
  const m3act = m3 ? `<div class="st">«${esc(m3.titulo)}»</div>${m3.comentario ? `<div class="dd" style="font-style:italic">“${esc(m3.comentario)}”</div>` : ''}<div class="act"><button class="btn link" data-act="eposter-edit">Cambiar</button></div>`
    : `<form class="act" id="f-eposter"><div class="field" style="margin-bottom:8px"><input name="titulo" maxlength="220" placeholder="Título del trabajo" required></div><div class="field" style="margin-bottom:8px"><textarea name="comentario" maxlength="600" placeholder="Tu comentario sobre el trabajo" required style="min-height:72px"></textarea></div><button class="btn btn-p sm" type="submit">Guardar</button></form>`;

  // M4 · comentarios
  const nc = (d.comentarios || []).length;
  const m4st = `<div class="st" style="${nc >= 3 ? '' : 'color:var(--txt-3)'}">${Math.min(nc, 3)} de 3 comentarios</div>`;
  const m4act = `<div class="act"><button class="btn ${nc >= 3 ? 'btn-g' : 'btn-p'} sm" data-go="programa">${nc >= 3 ? 'Comentar otra sesión' : 'Ir al programa y comentar'}</button></div>`;

  return appbar('Tus 5 momentos') + `<div class="body">
    <div class="score ${p.completos === 5 ? 'done' : ''}">
      <div><div class="lb">Tus gotas</div><div class="big">${p.gotas}<span style="font-size:18px;font-weight:800;opacity:.7"> / 5</span></div></div>
      <div class="rt"><b>${p.completos === 5 ? '¡Completo!' : `Faltan ${5 - p.completos}`}</b>${p.completos === 5 ? (p.inscripto ? 'inscripto en el sorteo' : 'pasá por el stand ADOX') : 'para entrar al sorteo'}</div>
    </div>
    ${final}

    <div class="card" style="border-left:3px solid var(--teal);margin-bottom:16px">
      <div class="muted" style="font-size:10.5px;font-weight:800;letter-spacing:2.2px;text-transform:uppercase;color:var(--teal)">Tus 5 momentos en ADECI 2026</div>
      <div style="font-size:24px;font-weight:900;color:var(--navy);letter-spacing:-.6px;line-height:1.1;margin-top:5px">Viví el congreso y ganá</div>
      <div class="small mt-s" style="color:var(--txt-2);line-height:1.5">Viví tus «cinco momentos» en ADECI 2026 y participá de un sorteo auspiciado por ADOX. Cada momento marca una instancia de tu participación activa en el congreso, y lo pensamos para ayudarte a aprovecharlo al máximo. Enterate cómo, ganando una gota en cada momento:</div>
      <div class="callout mt"><div class="t">Con las 5 gotas, pasá por el stand de ADOX</div><div class="x">Retirás tu regalo y te registrás para el sorteo mostrando tu QR (pestaña «Yo»). Para ganar, hay que estar presente. ${esc(S.config.sorteoInfo || '')}</div></div>
    </div>

    <div class="ruta">
      <svg viewBox="0 0 56 500" preserveAspectRatio="none" aria-hidden="true">
        <path d="M28 10 C 4 70, 52 130, 28 190 S 4 310, 28 370 S 52 450, 28 498" stroke="#B7E1E7" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M28 10 C 52 70, 4 130, 28 190 S 52 310, 28 370 S 4 450, 28 498" stroke="#DBE3EE" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>
      <div class="${stepCls('m1', primeroPendiente === 'm1')}"><div class="num">${m.m1 ? '✓' : '1'}</div>
        <div class="mm">Momento 1</div><div class="tt">Registrate y confirmá tu llegada</div>
        <div class="dd">Ya estás registrado. Cuando llegues al congreso, tocá el botón y ganás la primera gota.</div>
        ${gota('m1')}${m1act}</div>
      <div class="${stepCls('m2', primeroPendiente === 'm2')}"><div class="num">${m.m2 ? '✓' : '2'}</div>
        <div class="mm">Momento 2</div><div class="tt">Respondé la trivia</div>
        <div class="dd">Está acá, en la app. Cada día del congreso se habilitan tres preguntas sobre control de infecciones. Con responderlas ganás la gota.</div>
        ${gota('m2')}${m2st}${m2act}</div>
      <div class="${stepCls('m3', primeroPendiente === 'm3')}"><div class="num">${m.m3 ? '✓' : '3'}</div>
        <div class="mm">Momento 3</div><div class="tt">Recorré los e-pósters</div>
        <div class="dd">Contanos el título y dejá un comentario sobre uno de los trabajos que visitaste.</div>
        ${gota('m3')}${m3act}</div>
      <div class="${stepCls('m4', primeroPendiente === 'm4')}"><div class="num">${m.m4 ? '✓' : '4'}</div>
        <div class="mm">Momento 4</div><div class="tt">Comentá las sesiones</div>
        <div class="dd">Dejá un comentario en tres de las sesiones en las que participaste. Desde el programa, entrá a la sesión y escribí.</div>
        ${gota('m4')}${m4st}${m4act}</div>
      <div class="${stepCls('m5', primeroPendiente === 'm5')}" style="min-height:auto"><div class="num">${m.m5 ? '✓' : '5'}</div>
        <div class="mm">Momento 5</div><div class="tt">Conocé ADOX</div>
        <div class="dd">ADOX acompaña este congreso. Contanos qué soluciones te interesa conocer y llegá al stand con tu recorrido armado.</div>
        ${gota('m5')}${m5act}</div>
    </div>
  </div>`;
}

function vTrivia(dia, data) {
  dia = Number(dia);
  const dl = DIAS.find(d => d.n === dia);
  if (!data) return appbar('Trivia · Día ' + dia, 'juego') + `<div class="spinner"></div>`;
  let cuerpo = '';
  if (!data.habilitado) cuerpo = `<div class="empty">La trivia del ${dl.label.toLowerCase()} se habilita ese día.</div>`;
  else if (!data.disponible) cuerpo = `<div class="empty">La trivia de hoy todavía no fue publicada. Volvé en un rato.</div>`;
  else if (data.respondida) {
    const r = data.respondida;
    cuerpo = `<div class="score ${r.correctas === r.total ? 'done' : ''}"><div><div class="lb">Tu resultado</div><div class="big">${r.correctas}/${r.total}</div></div><div class="rt"><b>Gota ganada 💧</b>${r.correctas === r.total ? '¡todas correctas!' : 'mirá las explicaciones'}</div></div>` +
      data.preguntas.map((q, i) => {
        const det = r.detalle?.[i];
        return `<div class="card qcard"><div class="qn">Pregunta ${i + 1}</div><div class="qt">${esc(q.texto)}</div>` +
          q.opciones.map((o, j) => `<div class="opt ${det && j === det.correcta ? 'right' : ''} ${det && j === det.elegida && !det.ok ? 'wrong' : ''}"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span></div>`).join('') +
          (det?.explicacion ? `<div class="expl">${esc(det.explicacion)}</div>` : '') + `</div>`;
      }).join('');
  } else {
    cuerpo = `<form id="f-trivia" data-dia="${dia}">` + data.preguntas.map((q, i) => `<div class="card qcard" data-q="${i}"><div class="qn">Pregunta ${i + 1} de ${data.preguntas.length}</div><div class="qt">${esc(q.texto)}</div>` +
      q.opciones.map((o, j) => `<button type="button" class="opt" data-q="${i}" data-o="${j}"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('') + `</div>`).join('') +
      `<div class="error" id="trivia-err" hidden></div><button class="btn btn-p full" type="submit">Enviar respuestas</button>
       <div class="muted center mt-s">Se responde una sola vez por día. Tomate tu tiempo.</div></form>`;
  }
  return appbar('Trivia · ' + dl.label, 'juego') + `<div class="body">${cuerpo}</div>`;
}

function vAdox() {
  return `<div class="adox-band"></div><div class="appbar" style="background:#fff;color:var(--navy)"><button class="back" data-go="ahora" style="background:var(--paper);color:var(--navy)">‹</button><div class="word grow">Sponsor</div></div>
  <div class="adox-head"><img src="/img/adox-logo.png" alt="ADOX · Gestionando innovación"></div>
  <div class="body">
    <div class="card" style="border-left:3px solid var(--adox)">
      <div class="b" style="font-size:15.5px">${esc(S.config.standTexto || 'Stand de ADOX · hall central')}</div>
      <div class="small mt-s" style="color:var(--txt-2)">Acá retirás tu regalo y te registrás para el sorteo cuando tengas las cinco gotas.</div>
    </div>
    <div class="sec-t">Cómo participar</div>
    <div class="card">
      <div class="stepline"><span class="numb">1</span><div><b class="b">Juntá las cinco gotas</b> en la app: llegada, trivia, e-pósters, tres comentarios y «Conocé ADOX».</div></div>
      <div class="stepline"><span class="numb">2</span><div><b class="b">Vení al stand con la app abierta en «Yo».</b> Escaneamos tu QR, retirás tu regalo y quedás registrado para el sorteo.</div></div>
      <div class="stepline" style="margin-bottom:0"><span class="numb t">3</span><div><b class="b">Acercate al stand para el sorteo.</b> Para ganar, hay que estar presente. ${esc(S.config.sorteoInfo || '')}</div></div>
      <button class="btn ${(S.progreso?.completos === 5) ? 'btn-adox' : 'btn-g'} full mt" data-go="${(S.progreso?.completos === 5) ? 'yo' : 'juego'}">${(S.progreso?.completos === 5) ? 'Mostrar mi QR' : 'Ver mis 5 momentos'}</button>
    </div>
    <div class="sec-t">Qué vas a encontrar</div>
    <div class="card">
      <div class="prod"><div class="ic">🧴</div><div><div class="nn">Higiene de manos y piel</div><div class="ds">Antisépticos, toallitas, dispensadores</div></div></div>
      <div class="prod"><div class="ic">🧪</div><div><div class="nn">Desinfección de superficies</div><div class="ds">Detergentes enzimáticos y desinfectantes</div></div></div>
      <div class="prod"><div class="ic">🦠</div><div><div class="nn">Control de biofilm</div><div class="ds">Protocolos y productos específicos</div></div></div>
      <div class="prod"><div class="ic">🌡️</div><div><div class="nn">Mapeo térmico y monitoreo</div><div class="ds">Validación de ambientes y equipos</div></div></div>
    </div>
    <a class="btn btn-w full" href="https://adox.com.ar/" target="_blank" rel="noopener">Visitar adox.com.ar ↗</a>
    <div class="muted center mt">ADOX · Gestionando innovación</div>
  </div>`;
}

function vYo() {
  const u = S.user, p = S.progreso;
  const hab = p?.habilitado;
  return appbar('Mi QR') + `<div class="body">
    <div class="badge">
      <div class="nm">${esc(u.nombre)} ${esc(u.apellido)}</div>
      <div class="ro">Congreso ADECI 2026</div>
      <div class="qrbox"><div id="qr"></div></div>
      <div class="id">${esc(u.uid)}</div>
      <div class="hab ${hab ? 'on' : ''}">${p?.inscripto ? '✓ Inscripto en el sorteo' : hab ? '✓ 5 gotas · pasá por el stand ADOX' : `${p?.completos ?? 0} de 5 gotas`}</div>
    </div>
    <div class="muted center small mb">${p?.inscripto ? 'Ya retiraste tu regalo y estás en el sorteo. Acercate al stand para el sorteo: para ganar, hay que estar presente.' : hab ? 'Mostrá este QR en el stand de ADOX: te lo escanean, retirás tu regalo y quedás en el sorteo.' : 'Cuando tengas las cinco gotas, mostrá este QR en el stand de ADOX.'}</div>
    <div class="card">
      <div class="kv"><span class="k">Correo</span><span class="v">${esc(u.email)}</span></div>
      <div class="kv"><span class="k">Gotas</span><span class="v" style="color:var(--teal)">${p?.gotas ?? 0} de 5</span></div>
    </div>
    <div class="sec-t">Información útil</div>
    <div class="card">
      <div class="kv"><span class="k">Sede</span><span class="v">Hotel Quórum, Córdoba</span></div>
      <div class="kv"><span class="k">Fechas</span><span class="v">17 y 18 de septiembre</span></div>
      <div class="kv"><span class="k">Consultas</span><span class="v"><a href="mailto:adeci@adeci.org.ar">adeci@adeci.org.ar</a></span></div>
      <div class="kv"><span class="k">Sitio</span><span class="v"><a href="https://adeci.org.ar/congresos/2026/" target="_blank" rel="noopener">adeci.org.ar</a></span></div>
    </div>
    <button class="btn btn-w full mt" data-act="logout">Cerrar sesión</button>
  </div>`;
}

function vComite() {
  const item = (c, i, grupo) => `<button class="cm" data-comite="${grupo}:${i}"><img src="${c.foto}" alt="" loading="lazy"><div>${c.cargo ? `<div class="c">${esc(c.cargo)}</div>` : ''}<div class="n">${esc(c.nombre)}</div><div class="muted">Ver perfil ›</div></div></button>`;
  return appbar('Comité organizador', 'yo') + `<div class="body">
    <div class="sec-t">Autoridades</div><div class="card" style="padding-top:2px;padding-bottom:2px">${AUTORIDADES.map((c, i) => item(c, i, 'a')).join('')}</div>
    <div class="sec-t">Comité científico</div><div class="card" style="padding-top:2px;padding-bottom:2px">${COMITE_CIENTIFICO.map((c, i) => item(c, i, 'c')).join('')}</div>
  </div>`;
}
// ───────────────────────── modal ─────────────────────────
function modal(html) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><button class="close" aria-label="Cerrar">✕</button>${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
  document.body.appendChild(bg);
}
function modalSpeaker(id) {
  const sp = speaker(id); if (sp.sinPerfil) return;
  const en = PROGRAMA.filter(s => (s.roles || []).some(r => r.ids.includes(id)));
  modal(`<img class="foto" src="${sp.foto}" alt="" onerror="this.style.display='none'"><h3>${esc(sp.nombre)}</h3>
    <div class="bio">${esc(sp.bio)}</div>
    ${en.length ? `<div class="en"><div class="sec-t">Participa en</div>${en.map(s => `<div class="card tap next" data-go="sesion/${s.id}" data-close><div class="t">${DIAS.find(d => d.n === s.dia).corto}<br>${s.ini}</div><div><div class="n">${esc(sesion(s.id).titulo)}</div></div></div>`).join('')}</div>` : ''}`);
}
function modalComite(grupo, i) {
  const c = (grupo === 'a' ? AUTORIDADES : COMITE_CIENTIFICO)[i]; if (!c) return;
  modal(`<img class="foto" src="${c.foto}" alt="" onerror="this.style.display='none'"><h3>${esc(c.nombre)}</h3>${c.cargo ? `<div class="cargo">${esc(c.cargo)}</div>` : ''}
    <ul class="bio">${c.bio.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`);
}

// ───────────────────────── render + eventos ─────────────────────────
const NAVMAP = { ahora: 'ahora', programa: 'programa', sesion: 'programa', juego: 'juego', trivia: 'juego', adox: 'adox', yo: 'yo', comite: 'yo' };
let triviaCache = {};

function render() {
  if (!S.token || !S.user) { $app.innerHTML = vLogin(); return; }
  $app.className = ''; $nav.hidden = false;
  const [r, arg] = location.hash.replace(/^#\/?/, '').split('#')[0].split('/');
  const ruta = r || 'ahora';
  const anchor = location.hash.split('#')[2];
  let html;
  switch (ruta) {
    case 'programa': html = vPrograma(); break;
    case 'sesion': html = vSesion(arg); break;
    case 'juego': html = vJuego(); break;
    case 'trivia': html = vTrivia(arg, triviaCache[arg]); if (!triviaCache[arg]) cargarTrivia(arg); break;
    case 'adox': html = vAdox(); break;
    case 'yo': html = vYo(); break;
    case 'comite': html = vComite(); break;
    default: html = vAhora();
  }
  $app.innerHTML = html;
  $nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === (NAVMAP[ruta] || 'ahora')));
  window.scrollTo(0, 0);
  if (ruta === 'yo') dibujarQR();
  if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

function dibujarQR() {
  const el = document.getElementById('qr'); if (!el || !S.user) return;
  const draw = () => { el.innerHTML = ''; new QRCode(el, { text: location.origin + '/staff.html?c=' + S.user.uid, width: 168, height: 168, colorDark: '#012951', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); };
  if (window.QRCode) draw(); else setTimeout(dibujarQR, 150);
}

async function cargarTrivia(dia) {
  try { triviaCache[dia] = await api('trivia_get', { dia }); } catch (e) { triviaCache[dia] = { habilitado: true, disponible: false }; toast(e.message, true); }
  if (location.hash.includes('trivia/' + dia)) render();
}

async function refrescar() {
  if (!S.token) return;
  try { const d = await api('me'); S.progreso = d.progreso; S.user = d.user; localStorage.setItem(LS + ':user', JSON.stringify(d.user)); } catch { /* sesión cerrada por api() */ }
}
async function cargarPublico() {
  try { const [c, a] = await Promise.all([api('config'), api('avisos')]); S.config = c; S.avisos = a.avisos || []; } catch { /* sin red: seguimos con lo que hay */ }
}

// delegación de eventos
document.addEventListener('click', async (e) => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) { if (goEl.hasAttribute('data-close')) document.querySelector('.modal-bg')?.remove(); go(goEl.dataset.go); return; }
  const nb = e.target.closest('#nav button'); if (nb) { if (nb.dataset.r === 'libro') { if (S.config.libroUrl) window.open(S.config.libroUrl, '_blank', 'noopener'); else toast('El libro de resúmenes estará disponible próximamente.'); return; } go(nb.dataset.r); return; }
  const db = e.target.closest('[data-dia]'); if (db && db.closest('.days')) { S.dia = Number(db.dataset.dia); render(); return; }
  const sp = e.target.closest('[data-speaker]'); if (sp) { modalSpeaker(sp.dataset.speaker); return; }
  const cm = e.target.closest('[data-comite]'); if (cm) { const [g, i] = cm.dataset.comite.split(':'); modalComite(g, Number(i)); return; }
  const opt = e.target.closest('.opt[data-q]'); if (opt) { opt.parentElement.querySelectorAll('.opt').forEach(o => o.classList.remove('sel')); opt.classList.add('sel'); return; }
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'logout') { if (confirm('¿Cerrar sesión? Podés volver a entrar con el mismo correo.')) logout(); }
    if (a === 'eposter-edit') { S.progreso.detalle.eposter = null; render(); }
    if (a === 'checkin') { act.disabled = true; try { const d = await api('checkin'); S.progreso = d.progreso; toast('¡Gota ganada! Bienvenido/a al congreso.'); render(); } catch (er) { toast(er.message, true); act.disabled = false; } }
  }
});

document.addEventListener('submit', async (e) => {
  const f = e.target; e.preventDefault();
  const btn = f.querySelector('button[type=submit]'); const errEl = f.querySelector('.error');
  const fail = (m) => { if (errEl) { errEl.textContent = m; errEl.hidden = false; } else toast(m, true); if (btn) btn.disabled = false; };
  if (btn) btn.disabled = true; if (errEl) errEl.hidden = true;
  const fd = new FormData(f);
  try {
    if (f.id === 'f-login') {
      const d = await api('register', { nombre: fd.get('nombre'), apellido: fd.get('apellido'), email: fd.get('email') });
      setSession(d.token, d.user); S.progreso = d.progreso;
      toast(d.nuevo ? `¡Bienvenido/a, ${d.user.nombre}!` : `Hola de nuevo, ${d.user.nombre}`);
      await cargarPublico(); location.hash = '#/'; render(); iniciarAvisos();
    } else if (f.id === 'f-coment') {
      const d = await api('comentario', { sesionId: f.dataset.sesion, texto: fd.get('texto') });
      S.progreso = d.progreso; const n = d.progreso.detalle.comentarios.length;
      toast(n >= 3 ? '¡Gota ganada! Momento 4 completo.' : `Comentario guardado (${n} de 3).`); render();
    } else if (f.id === 'f-eposter') {
      const d = await api('eposter', { titulo: fd.get('titulo'), comentario: fd.get('comentario') }); S.progreso = d.progreso; toast('¡Gota ganada! Momento 3 completo.'); render();
    } else if (f.id === 'f-adox') {
      const intereses = [...f.querySelectorAll('input[name=int]:checked')].map(i => i.value);
      if (!intereses.length) return fail('Marcá al menos una opción.');
      const d = await api('adox', { intereses }); S.progreso = d.progreso;
      toast(d.progreso.completos === 5 ? '¡Cinco gotas! Pasá por el stand de ADOX.' : '¡Gota ganada! Momento 5 completo.'); render();
    } else if (f.id === 'f-trivia') {
      const dia = f.dataset.dia; const qs = [...f.querySelectorAll('.qcard')];
      const resp = qs.map(q => { const s = q.querySelector('.opt.sel'); return s ? Number(s.dataset.o) : null; });
      if (resp.includes(null)) return fail('Respondé todas las preguntas antes de enviar.');
      const d = await api('trivia_answer', { dia, respuestas: resp }); S.progreso = d.progreso; delete triviaCache[dia];
      toast(`¡Gota ganada! ${d.resultado.correctas} de ${d.resultado.total} correctas`); cargarTrivia(dia); render();
    }
  } catch (er) { fail(er.message); }
});

window.addEventListener('hashchange', render);

let avisosTimer, rtActivo = false;
function normalizarConfig(c) {
  return { libroUrl: c.libroUrl || '', standTexto: c.standTexto || 'Stand de ADOX · hall central',
    sorteoInfo: c.sorteoInfo || 'Los sorteos se hacen en el stand de ADOX. Hay que estar presente.', overrides: c.overrides || {} };
}
function nuevoAviso(prev) {
  if (S.avisos[0] && S.avisos[0].id !== prev) {
    toast('📣 ' + (S.avisos[0].titulo || S.avisos[0].texto));
    if (!location.hash || location.hash === '#/' || location.hash === '#/ahora') render();
  }
}
// Tiempo real con Firestore (si firebase-config.js está completo). Si no, consulta la API cada 5 minutos.
async function iniciarAvisos() {
  clearInterval(avisosTimer);
  if (firebaseConfig && !rtActivo) {
    try {
      const [{ initializeApp }, { getFirestore, collection, doc, query, orderBy, limit, onSnapshot }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js'),
      ]);
      const fdb = getFirestore(initializeApp(firebaseConfig));
      onSnapshot(query(collection(fdb, 'avisos'), orderBy('at', 'desc'), limit(20)), snap => {
        const prev = S.avisos[0]?.id;
        S.avisos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        nuevoAviso(prev);
      });
      onSnapshot(doc(fdb, 'config', 'app'), snap => { S.config = normalizarConfig(snap.exists() ? snap.data() : {}); if (location.hash.includes('sesion') || location.hash.includes('yo') || location.hash.includes('adox')) render(); });
      rtActivo = true;
      return;
    } catch (e) { console.warn('Sin tiempo real, uso respaldo:', e.message); }
  }
  avisosTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || !S.token) return;
    const prev = S.avisos[0]?.id; await cargarPublico(); nuevoAviso(prev);
  }, 5 * 60000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token) { refrescar().then(render); if (!rtActivo) cargarPublico(); } });

// ───────────────────────── arranque ─────────────────────────
(async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  await cargarPublico();
  if (S.token) { await refrescar(); iniciarAvisos(); }
  render();
})();
