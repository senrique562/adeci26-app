process.env.FIREBASE_SERVICE_ACCOUNT = '{"private_key":"x"}';
process.env.APP_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_PIN = '1234'; process.env.STAFF_PIN = '9999';
process.env.ADMIN_EMAILS = 'admin@test.com';
process.env.TEST_MODE = 'true';
const { default: handler } = await import('../netlify/functions/api.mjs');

let fails = 0;
async function call(accion, body = {}, token = '') {
  const req = new Request('http://x/api/' + accion, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const res = await handler(req);
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
}
function ok(cond, msg) { if (!cond) { fails++; console.log('  ✗', msg); } else console.log('  ✓', msg); }

console.log('registro');
let r = await call('register', { nombre: 'Ana', apellido: 'Pérez', email: 'ANA@Test.com ' });
ok(r.status === 200 && r.data.token && r.data.user.uid.length === 8, 'crea usuario con uid de 8 chars: ' + r.data.user?.uid);
ok(r.data.progreso.completos === 0 && r.data.progreso.gotas === 0, 'progreso inicial en cero');
const tok = r.data.token, uid = r.data.user.uid;
r = await call('register', { nombre: 'Ana', apellido: 'Pérez', email: 'ana@test.com' });
ok(r.data.user.uid === uid && r.data.nuevo === false, 'mismo email → misma cuenta (case-insensitive)');
r = await call('register', { nombre: 'A', apellido: 'P', email: 'mal' });
ok(r.status === 400, 'valida campos');
r = await call('me', {}, 'token.falso');
ok(r.status === 401, 'token falso rechazado');

console.log('momentos');
r = await call('checkin', {}, tok); ok(r.data.progreso.momentos.m1 && r.data.progreso.gotas === 1, 'confirmar llegada → m1, 1 gota');
r = await call('checkin', {}, tok); ok(r.data.progreso.gotas === 1, 'segunda confirmación no duplica');

const admin = (await call('admin_login', { email: 'admin@test.com', pin: '1234' })).data.token;
ok(!!admin, 'login admin');
r = await call('admin_login', { email: 'admin@test.com', pin: '0000' }); ok(r.status === 401, 'pin admin incorrecto');
r = await call('admin_trivia_save', { dia: 1, preguntas: [
  ...[1,2,3,4,5,6].map(n => ({ texto: 'P' + n, opciones: ['a', 'b', 'c', 'd'], correcta: n % 4, explicacion: 'e' + n })),
  { texto: '', opciones: ['a', 'b'], correcta: 0 } ] }, admin);
ok(r.data.cantidad === 6, 'guarda banco de 6 (ignora vacías)');
r = await call('trivia_get', { dia: 1 }, tok);
ok(r.data.disponible && r.data.preguntas.length === 3 && !('correcta' in r.data.preguntas[0]), 'trivia_get da 3 del banco, sin la respuesta correcta');
const ids1 = r.data.preguntas.map(q => q.id);
r = await call('trivia_get', { dia: 1 }, tok); ok(r.data.preguntas.map(q => q.id).join() === ids1.join(), 'la misma persona siempre recibe las mismas 3, en el mismo orden');
{ const otro = await call('register', { nombre: 'Otra', apellido: 'Persona', email: 'otra@test.com' });
  const rr = await call('trivia_get', { dia: 1 }, otro.data.token); ok(rr.data.preguntas.map(q => q.id).join() !== ids1.join(), 'otra persona recibe otra selección/orden'); }
// respondo: correcta la 1ª y 2ª, mal la 3ª (según el banco: correcta = n%4)
{ const corr = ids1.map(id => Number(id.slice(1)) % 4); r = await call('trivia_answer', { dia: 1, respuestas: [corr[0], corr[1], (corr[2] + 1) % 4] }, tok); }
ok(r.data.resultado.correctas === 2 && r.data.progreso.gotas === 2 && r.data.resultado.detalle[0].id === ids1[0], '2/3 correctas, corregidas sobre la misma selección → gota del momento 2');
ok(r.data.progreso.momentos.m2 === true, 'm2 completo con una trivia');
r = await call('trivia_answer', { dia: 1, respuestas: [0, 0, 0] }, tok);
ok(r.data.yaRespondida === true && r.data.progreso.gotas === 2, 'no se puede responder dos veces');
r = await call('trivia_get', { dia: 1 }, tok); ok(r.data.respondida?.correctas === 2, 'trivia_get devuelve resultado previo');

r = await call('eposter', { titulo: 'ab' }, tok); ok(r.status === 400, 'e-póster muy corto');
r = await call('eposter', { titulo: 'Vigilancia de bacteriemias' }, tok); ok(r.status === 400, 'e-póster sin comentario rechazado');
r = await call('eposter', { titulo: 'Vigilancia de bacteriemias', comentario: 'Muy claro el método' }, tok); ok(r.data.progreso.momentos.m3 && r.data.progreso.gotas === 3 && r.data.progreso.detalle.eposter.comentario === 'Muy claro el método', 'm3 con título y comentario → 3 gotas');

r = await call('comentario', { sesionId: 'd1-05', texto: 'Muy buena' }, tok); ok(r.data.progreso.detalle.comentarios.length === 1 && r.data.progreso.gotas === 3, 'comentario 1 guardado (todavía sin gota)');
r = await call('comentario', { sesionId: 'd1-05', texto: 'Editado' }, tok); ok(r.data.progreso.detalle.comentarios.length === 1 && r.data.progreso.detalle.comentarios[0].texto === 'Editado', 'misma sesión reemplaza, no duplica');
r = await call('comentario', { sesionId: 'd1-06', texto: 'Muy útil' }, tok);
r = await call('comentario', { sesionId: 'xx', texto: 'Muy útil' }, tok); ok(r.status === 400, 'sesión inválida');
r = await call('comentario', { sesionId: 'd1-08', texto: 'Muy útil' }, tok); if(!r.data.progreso) console.log('DEBUG', r); ok(r.data.progreso.momentos.m4 && r.data.progreso.completos === 4 && r.data.progreso.gotas === 4, '3 comentarios → m4 (4 gotas)');
ok(r.data.progreso.habilitado === false, 'todavía no habilitado');

console.log('staff');
r = await call('staff_login', { email: 'stand@adox.com', pin: '9999' }); ok(r.status === 403, 'staff no habilitado rechazado');
await call('admin_staff_add', { email: 'stand@adox.com', nombre: 'Stand 1' }, admin);
r = await call('staff_login', { email: 'stand@adox.com', pin: '9999' }); ok(r.status === 200 && r.data.role === 'staff', 'staff habilitado entra');
const staff = r.data.token;
r = await call('staff_login', { email: 'stand@adox.com', pin: '1111' }); ok(r.status === 401, 'pin staff incorrecto');
r = await call('staff_scan', { uid: 'https://adeci26.netlify.app/staff.html?c=' + uid }, staff);
ok(r.status === 200 && r.data.ok === false && r.data.motivo === 'incompleto' && r.data.progreso.gotas === 4, 'con 4 gotas el stand NO inscribe y dice qué falta');
r = await call('adox', { intereses: ['biofilm', 'manos', 'inventado', 'biofilm'] }, tok);
ok(r.data.progreso.momentos.m5 && r.data.progreso.habilitado && r.data.progreso.gotas === 5 && r.data.progreso.detalle.adox.intereses.join() === 'biofilm,manos', '«Conocé ADOX» → m5, 5 gotas, intereses depurados');
r = await call('adox', { intereses: [] }, tok); ok(r.status === 400, 'sin intereses rechazado');
r = await call('staff_scan', { uid: 'ADECI26:' + uid.toLowerCase() }, staff);
ok(r.data.ok && !r.data.yaEstaba && r.data.progreso.inscripto === true, 'con 5 gotas el stand inscribe (QR en cualquier formato)');
r = await call('staff_scan', { uid }, staff); ok(r.data.yaEstaba === true, 'segundo escaneo no duplica');
r = await call('staff_scan', { uid: 'ZZZZZZZZ' }, staff); ok(r.status === 404, 'uid inexistente');
r = await call('staff_scan', { uid }, tok); ok(r.status === 403, 'usuario común no puede escanear');
r = await call('staff_stats', {}, staff); ok(r.data.inscriptos === 1, 'contador: 1 inscripto');

console.log('admin');
r = await call('admin_metricas', {}, admin); ok(r.data.total === 2 && r.data.completos === 1 && r.data.inscriptos === 1 && r.data.m1 === 1 && r.data.m5 === 1 && r.data.comentarios === 3 && r.data.gotasTotal === 5 && r.data.intereses.biofilm === 1, 'métricas (incl. inscriptos e intereses)');
r = await call('admin_metricas', {}, staff); ok(r.status === 403, 'staff no accede a métricas');
r = await call('admin_avisos_add', { titulo: 'Cambio', texto: 'Hola' }, admin); ok(r.data.ok, 'aviso publicado');
r = await call('avisos'); ok(r.data.avisos.length === 1 && r.data.avisos[0].titulo === 'Cambio', 'avisos públicos');
await call('admin_avisos_del', { id: r.data.avisos[0].id }, admin); r = await call('avisos'); ok(r.data.avisos.length === 0, 'aviso borrado');
r = await call('admin_config_save', { libroUrl: 'https://x/y.pdf', overrides: { 'd1-05': { titulo: 'Nuevo' }, 'malo': { titulo: 'x' } } }, admin);
r = await call('config'); ok(r.data.libroUrl === 'https://x/y.pdf' && r.data.overrides['d1-05'].titulo === 'Nuevo' && !r.data.overrides.malo, 'config pública con overrides filtrados');
await call('register', { nombre: 'Beto', apellido: 'Gómez', email: 'beto@test.com' });
r = await call('admin_sorteo', {}, admin); ok(r.data.ok && r.data.ganador.uid === uid && r.data.candidatos === 1 && r.data.ganador, 'sorteo por defecto entre inscriptos en el stand → Ana');
r = await call('admin_sorteo', { modo: 'completos' }, admin); ok(r.data.ok && r.data.candidatos === 1, 'sorteo entre quienes tienen 5 gotas → Ana');
r = await call('admin_sorteo', { modo: 'completos', excluir: [uid] }, admin); ok(r.data.ok === false, 'excluida → sin candidatos');
r = await call('admin_sorteos_list', {}, admin); ok(r.data.sorteos.length === 2, 'historial de sorteos');
r = await call('admin_export', { tipo: 'usuarios' }, admin); ok(typeof r.data === 'string' && r.data.split('\r\n').length === 4 && r.data.includes('ana@test.com'), 'export CSV usuarios (3 filas)');
r = await call('admin_export', { tipo: 'comentarios' }, admin); ok(r.data.split('\r\n').length === 4, 'export CSV comentarios (3 filas)');
r = await call('admin_export', { tipo: 'eposters' }, admin); ok(r.data.includes('Muy claro el método'), 'export CSV e-pósters incluye comentario');
r = await call('admin_export', { tipo: 'usuarios' }, admin); ok(r.data.includes('biofilm, manos'), 'export usuarios incluye intereses ADOX');
r = await call('noexiste', {}, admin); ok(r.status === 404, 'acción desconocida');

console.log(fails ? `\n${fails} PRUEBAS FALLARON` : '\nTODO OK');
process.exit(fails ? 1 : 0);
