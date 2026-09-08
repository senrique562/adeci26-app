import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
process.env.FIREBASE_SERVICE_ACCOUNT='{"private_key":"x"}'; process.env.APP_SECRET='s'.repeat(40); process.env.TEST_MODE='true';
process.env.ADMIN_PIN='1234'; process.env.ADMIN_EMAILS='admin@test.com'; process.env.STAFF_PIN='9999';
const { default: handler } = await import('../netlify/functions/api.mjs');

const html = readFileSync(new URL('../public/index.html', import.meta.url),'utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,'');
const dom = new JSDOM(html, { url: 'https://adeci26.netlify.app/#/', pretendToBeVisual: true });
const w = dom.window;
for (const k of ['window','document','localStorage','location','HTMLElement','Node','FormData','Event','CustomEvent','requestAnimationFrame']) { try { Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); } catch {} }
Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
globalThis.confirm = () => true;
w.QRCode = globalThis.QRCode = class { constructor(el, o){ el.innerHTML = '<canvas data-text="'+o.text+'"></canvas>'; } static CorrectLevel = { M: 1 }; };
globalThis.fetch = async (url, opts) => handler(new Request('https://adeci26.netlify.app' + url, opts));
w.HTMLElement.prototype.scrollIntoView = () => {};
w.scrollTo = () => {};
Object.defineProperty(w.document, 'visibilityState', { value: 'visible' });

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const tick = (ms=30) => new Promise(r => setTimeout(r, ms));
const $ = (s) => w.document.querySelector(s);
const $$ = (s) => [...w.document.querySelectorAll(s)];
const text = () => w.document.body.textContent;
const nav = async (h) => { w.location.hash = h; w.dispatchEvent(new w.Event('hashchange')); await tick(); };
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const submit = async (f) => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await tick(80); };

// cargar la app y esperar el arranque
await import('/js/app.js');
await tick(120);

console.log('login');
ok($('#f-login'), 'muestra el formulario de registro');
ok($('.apoyo img[alt="ADOX"]'), 'logo ADOX en el ingreso');
$('#nombre').value='María'; $('#apellido').value='López'; $('#email').value='maria@test.com';
await submit($('#f-login'));
ok(!$('#f-login') && text().includes('María'), 'después del registro entra a “Ahora” con su nombre');
ok(!$('#nav').hidden && $$('#nav button').length === 6 && $$('#nav button')[5].textContent.includes('Libro'), 'nav con 6 botones, el último es Libro');
w.open = (u)=>{ w._opened=u; }; click($$('#nav button')[5]); await tick(); ok(!w._opened && $('#toast').textContent.includes('próximamente'), 'Libro sin URL avisa que no está disponible');
ok(!text().includes('Resistencia antimicrobiana'), 'sin etiquetas de eje en el inicio');
ok(text().includes('0 de 5 gotas') && text().includes('Participá y ganá') && text().includes('Recorré tus 5 momentos de ADECI 2026') && text().includes('Retirá tu regalo') && text().includes('Conocé el juego'), 'inicio: nuevo texto y botón al juego');
ok(text().includes('Conocé el congreso') && text().includes('Comité organizador') && !text().includes('Libro de resúmenes'), 'inicio: sección Conocé el congreso, sin libro');
ok([...w.document.querySelectorAll('.body > .card')].pop().querySelector('img[alt^="ADOX"]'), 'logo ADOX al pie');
ok(text().includes('empieza el jueves 17') || text().includes('En sala') || text().includes('Terminó'), 'bloque “ahora” contextual (hoy no es día de congreso)');

console.log('programa');
await nav('#/programa');
ok($$('.slot').length === 13 && !$('.eje'), 'día 1: 13 bloques, sin etiquetas de eje');
click($$('.days button')[1]); await tick();
ok($$('.slot').length === 16 && $$('.days button')[1].classList.contains('on'), 'día 2: 16 bloques y pestaña activa');
ok(text().includes('Biofilms: el enemigo oculto') && text().includes('Mg. Andrea Novau'), 'títulos y nombres renderizados');
const slot = $$('.slot.tap')[0]; click(slot); await tick();
ok(w.location.hash.startsWith('#/sesion/d2-'), 'tap en sesión navega al detalle: ' + w.location.hash);

console.log('sesión + speaker');
await nav('#/sesion/d2-04');
ok(text().includes('Biofilms: el enemigo oculto') && $$('.person').length === 3, 'detalle con 3 participantes');
ok($('#f-coment'), 'formulario de comentario presente');
click($$('button.person')[0]); await tick();
ok($('.modal-bg') && $('.modal h3').textContent.includes('Novau') && $('.modal .bio').textContent.length > 100, 'modal con foto/bio de la speaker');
ok($$('.modal .next').length >= 2, 'modal lista sus sesiones (Novau participa en 2)');
click($('.modal .close')); await tick(); ok(!$('.modal-bg'), 'modal se cierra');
await nav('#/sesion/d2-07'); ok($$('.person.plain').length === 1 && !$('button.person'), 'speaker sin perfil se muestra sin link (Fabián Mateo)');

console.log('comentarios (momento 4)');
for (const id of ['d1-05','d1-06','d1-08']) { await nav('#/sesion/'+id); $('#f-coment textarea').value = 'Muy interesante la sesión ' + id; await submit($('#f-coment')); }
ok(text().includes('Ya dejaste tu comentario'), 'confirma comentario guardado');
await nav('#/juego');
ok(text().includes('3 de 3 comentarios') && $$('.step.ok').length === 1, 'momento 4 completo en la ruta');
ok(text().includes('participá de un sorteo auspiciado por ADOX') && !text().includes('OMS'), 'texto nuevo del juego, sin referencia a OMS');
ok(text().includes('Registrate y confirmá tu llegada') && text().includes('Recorré los e-pósters') && !text().includes('En el congreso:'), 'momentos reescritos');

console.log('acreditación y e-póster');
w.localStorage.setItem('adeci26:fakeNow','2026-09-17T14:50'); await nav('#/ahora');
ok(text().includes('En sala') && text().includes('Agua en el hospital'), 'con hora simulada, muestra la sesión en curso correcta (14:45–15:30)');
ok(text().includes('15:30') && text().includes('Biofilm y limpieza'), 'muestra “a continuación”');
await nav('#/juego');
ok($('[data-act=checkin]'), 'momento 1: botón «Ya estoy en el congreso» (hora simulada = día 1)');
click($('[data-act=checkin]')); await tick(100); ok($$('.step.ok').length === 2 && text().includes('Gota ganada'), 'llegada confirmada (2 gotas con el momento 4)');
$('#f-eposter input').value = 'Vigilancia de bacteriemias asociadas a catéter'; $('#f-eposter textarea').value = 'Buen diseño del estudio'; await submit($('#f-eposter'));
ok(text().includes('«Vigilancia') && text().includes('Buen diseño') && $$('.step.ok').length === 3, 'e-póster con comentario acreditado (3 gotas)');

console.log('trivia');
// cargar trivia como admin
const adm = await (await fetch('/api/admin_login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@test.com',pin:'1234'})})).json();
await fetch('/api/admin_trivia_save',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+adm.token},body:JSON.stringify({dia:1,preguntas:[1,2,3,4,5,6].map(n=>({texto:'Pregunta número '+n,opciones:['a','b','c','d'],correcta:n%4,explicacion:'Explicación '+n}))})});
await nav('#/trivia/1'); await tick(120);
ok($$('.qcard').length === 3 && $('#f-trivia'), 'trivia del día 1 muestra 3 preguntas del banco de 6');
const nums = $$('.qcard .qt').map(e => Number(e.textContent.replace(/\D/g,'')));
click($$('.opt[data-q="0"]')[nums[0]%4]); click($$('.opt[data-q="1"]')[nums[1]%4]);
await submit($('#f-trivia')); ok(text().includes('Respondé todas'), 'exige responder todo');
click($$('.opt[data-q="2"]')[(nums[2]+1)%4]); await submit($('#f-trivia')); await tick(150);
ok(text().includes('2/3') && text().includes('Explicación '+nums[0]), 'resultado 2/3 con explicaciones de sus propias preguntas');
await nav('#/juego'); ok(text().includes('Día 1: 2 de 3 correctas') && $$('.step.ok').length === 4, 'momento 2 acreditado (4 gotas)');

console.log('credencial y stand');
await nav('#/yo'); await tick(200);
ok($('#qr canvas')?.dataset.text?.startsWith('https://adeci26.netlify.app/staff.html?c='), 'QR es una URL que abre el escáner: ' + $('#qr canvas')?.dataset.text);
ok(text().includes('4 de 5 gotas') && !text().includes('Inscripto') && text().includes('Mi QR'), 'todavía no habilitado; pantalla «Mi QR»');
const uid = $('#qr canvas').dataset.text.split('?c=')[1];
await fetch('/api/admin_staff_add',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+adm.token},body:JSON.stringify({email:'stand@adox.com'})});
const st = await (await fetch('/api/staff_login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'stand@adox.com',pin:'9999'})})).json();
const rechazo = await (await fetch('/api/staff_scan',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+st.token},body:JSON.stringify({uid:$('#qr canvas').dataset.text})})).json();
ok(rechazo.ok === false && rechazo.motivo === 'incompleto', 'con 4 gotas el stand no inscribe');
await nav('#/juego'); ok($('#f-adox') && $$('#f-adox input[name=int]').length === 6, 'momento 5: formulario «Conocé ADOX» con 6 opciones');
await submit($('#f-adox')); ok(text().includes('Marcá al menos una opción'), 'exige marcar algo');
$$('#f-adox input[name=int]')[2].checked = true; $$('#f-adox input[name=int]')[0].checked = true; await submit($('#f-adox'));
ok($$('.step.ok').length === 5 && text().includes('Pasá por el stand de ADOX a retirar tu regalo'), '5 gotas → tarjeta final con regalo y sorteo');
ok(text().includes('Control de biofilm') && text().includes('Higiene de manos'), 'muestra los intereses guardados');
await nav('#/yo'); await tick(200); ok(text().includes('5 gotas · pasá por el stand'), 'credencial: 5 gotas, pendiente stand');
const scan = await (await fetch('/api/staff_scan',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+st.token},body:JSON.stringify({uid:'ADECI26:'+uid})})).json();
ok(scan.ok && scan.progreso.inscripto, 'escaneo en stand con 5 gotas inscribe');
w.document.dispatchEvent(new w.Event('visibilitychange')); await tick(120);
ok(text().includes('Inscripto en el sorteo'), 'al volver a la app, la credencial dice inscripto');
await nav('#/juego'); ok($$('.step.ok').length === 5 && $('.score.done') && text().includes('Ya estás en el sorteo'), '5 de 5, inscripto, tarjeta final confirmada');

console.log('otros');
await nav('#/adox'); ok($('.adox-head img') && text().includes('Cómo participar') && text().includes('adox.com.ar'), 'pantalla ADOX');
await nav('#/comite'); ok($$('.cm').length === 9, 'comité: 2 autoridades + 7 científico');
click($$('.cm')[0]); await tick(); ok($('.modal h3').textContent.includes('Suayter') && $$('.modal li').length >= 5, 'bio de la presidenta');
click($('.modal .close')); await tick();
await nav('#/yo'); ok(!text().includes('Ejes temáticos') && !text().includes('Comité organizador') && !text().includes('certificado') && text().includes('Hotel Quórum'), 'Yo: sin comité, libro ni certificado; sede Hotel Quórum');
await fetch('/api/admin_config_save',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+adm.token},body:JSON.stringify({libroUrl:'https://adeci.org.ar/libro.pdf'})}); w.document.dispatchEvent(new w.Event('visibilitychange')); await tick(120);
click($$('#nav button')[5]); await tick(); ok(w._opened === 'https://adeci.org.ar/libro.pdf', 'Libro con URL abre el PDF');
// aviso
await fetch('/api/admin_avisos_add',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+adm.token},body:JSON.stringify({titulo:'Cambio de horario',texto:'La mesa arranca 15:00'})});
w.document.dispatchEvent(new w.Event('visibilitychange')); await tick(120); await nav('#/ahora');
ok($('.aviso') && text().includes('Cambio de horario'), 'aviso visible en Ahora');
// overrides
await fetch('/api/admin_config_save',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+adm.token},body:JSON.stringify({overrides:{'d2-04':{titulo:'Biofilms (título nuevo)'}}})});
w.document.dispatchEvent(new w.Event('visibilitychange')); await tick(120); await nav('#/sesion/d2-04');
ok(text().includes('Biofilms (título nuevo)') && $$('.person').length === 3, 'override de título aplicado, speakers intactos');
// logout / reingreso
await nav('#/yo'); click($('[data-act=logout]')); await tick();
ok($('#f-login'), 'cerrar sesión vuelve al ingreso');
$('#nombre').value='María'; $('#apellido').value='López'; $('#email').value='MARIA@test.com'; await submit($('#f-login')); await tick(50);
await nav('#/juego'); ok($$('.step.ok').length === 5, 'reingreso con el mismo mail recupera los 5 momentos');

console.log(fails ? `\n${fails} PRUEBAS FALLARON` : '\nTODO OK');
process.exit(fails ? 1 : 0);
