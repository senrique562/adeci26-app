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
r = await call('checkin', { dia: 1 }, tok); ok(r.data.progreso.momentos.m1 && r.data.progreso.gotas === 60, 'checkin día 1 → m1, 60 gotas');
r = await call('checkin', { dia: 2 }, tok); ok(r.data.progreso.gotas === 120, 'checkin día 2 → 120 gotas');
r = await call('checkin', { dia: 3 }, tok); ok(r.status === 400, 'día inválido');

const admin = (await call('admin_login', { email: 'admin@test.com', pin: '1234' })).data.token;
ok(!!admin, 'login admin');
r = await call('admin_login', { email: 'admin@test.com', pin: '0000' }); ok(r.status === 401, 'pin admin incorrecto');
r = await call('admin_trivia_save', { dia: 1, preguntas: [
  { texto: 'P1', opciones: ['a', 'b', 'c', 'd'], correcta: 1, explicacion: 'e1' },
  { texto: 'P2', opciones: ['a', 'b', 'c', 'd'], correcta: 2, explicacion: 'e2' },
  { texto: 'P3', opciones: ['a', 'b', 'c', 'd'], correcta: 3, explicacion: 'e3' },
  { texto: '', opciones: ['a', 'b'], correcta: 0 } ] }, admin);
ok(r.data.cantidad === 3, 'guarda trivia (ignora vacías)');
r = await call('trivia_get', { dia: 1 }, tok);
ok(r.data.disponible && r.data.preguntas.length === 3 && !('correcta' in r.data.preguntas[0]), 'trivia_get no filtra la respuesta correcta');
r = await call('trivia_answer', { dia: 1, respuestas: [1, 2, 0] }, tok);
ok(r.data.resultado.correctas === 2 && r.data.progreso.gotas === 120 + 60, '2/3 correctas → +60');
ok(r.data.progreso.momentos.m2 === true, 'm2 completo con una trivia');
r = await call('trivia_answer', { dia: 1, respuestas: [1, 2, 3] }, tok);
ok(r.data.yaRespondida === true && r.data.progreso.gotas === 180, 'no se puede responder dos veces');
r = await call('trivia_get', { dia: 1 }, tok); ok(r.data.respondida?.correctas === 2, 'trivia_get devuelve resultado previo');

r = await call('eposter', { titulo: 'ab' }, tok); ok(r.status === 400, 'e-póster muy corto');
r = await call('eposter', { titulo: 'Vigilancia de bacteriemias' }, tok); ok(r.data.progreso.momentos.m3 && r.data.progreso.gotas === 270, 'm3 → +90');

r = await call('comentario', { sesionId: 'd1-05', texto: 'Muy buena' }, tok); ok(r.data.progreso.detalle.comentarios.length === 1 && r.data.progreso.gotas === 300, 'comentario 1 → +30');
r = await call('comentario', { sesionId: 'd1-05', texto: 'Editado' }, tok); ok(r.data.progreso.detalle.comentarios.length === 1 && r.data.progreso.detalle.comentarios[0].texto === 'Editado', 'misma sesión reemplaza, no duplica');
r = await call('comentario', { sesionId: 'd1-06', texto: 'Muy útil' }, tok);
r = await call('comentario', { sesionId: 'xx', texto: 'Muy útil' }, tok); ok(r.status === 400, 'sesión inválida');
r = await call('comentario', { sesionId: 'd1-08', texto: 'Muy útil' }, tok); if(!r.data.progreso) console.log('DEBUG', r); ok(r.data.progreso.momentos.m4 && r.data.progreso.completos === 4 && r.data.progreso.gotas === 360, '3 comentarios → m4, 4/5');
ok(r.data.progreso.habilitado === false, 'todavía no habilitado');

console.log('staff');
r = await call('staff_login', { email: 'stand@adox.com', pin: '9999' }); ok(r.status === 403, 'staff no habilitado rechazado');
await call('admin_staff_add', { email: 'stand@adox.com', nombre: 'Stand 1' }, admin);
r = await call('staff_login', { email: 'stand@adox.com', pin: '9999' }); ok(r.status === 200 && r.data.role === 'staff', 'staff habilitado entra');
const staff = r.data.token;
r = await call('staff_login', { email: 'stand@adox.com', pin: '1111' }); ok(r.status === 401, 'pin staff incorrecto');
r = await call('staff_scan', { uid: 'ADECI26:' + uid.toLowerCase() }, staff);
ok(r.data.ok && !r.data.yaEstaba && r.data.progreso.habilitado === true && r.data.progreso.gotas === 510, 'escaneo → m5, habilitado, 510 gotas');
r = await call('staff_scan', { uid }, staff); ok(r.data.yaEstaba === true, 'segundo escaneo no duplica');
r = await call('staff_scan', { uid: 'ZZZZZZZZ' }, staff); ok(r.status === 404, 'uid inexistente');
r = await call('staff_scan', { uid }, tok); ok(r.status === 403, 'usuario común no puede escanear');
r = await call('staff_stats', {}, staff); ok(r.data.visitas === 1, 'contador de visitas = 1');

console.log('admin');
r = await call('admin_metricas', {}, admin); ok(r.data.total === 1 && r.data.completos === 1 && r.data.m5 === 1 && r.data.comentarios === 3, 'métricas');
r = await call('admin_metricas', {}, staff); ok(r.status === 403, 'staff no accede a métricas');
r = await call('admin_avisos_add', { titulo: 'Cambio', texto: 'Hola' }, admin); ok(r.data.ok, 'aviso publicado');
r = await call('avisos'); ok(r.data.avisos.length === 1 && r.data.avisos[0].titulo === 'Cambio', 'avisos públicos');
await call('admin_avisos_del', { id: r.data.avisos[0].id }, admin); r = await call('avisos'); ok(r.data.avisos.length === 0, 'aviso borrado');
r = await call('admin_config_save', { libroUrl: 'https://x/y.pdf', overrides: { 'd1-05': { titulo: 'Nuevo' }, 'malo': { titulo: 'x' } } }, admin);
r = await call('config'); ok(r.data.libroUrl === 'https://x/y.pdf' && r.data.overrides['d1-05'].titulo === 'Nuevo' && !r.data.overrides.malo, 'config pública con overrides filtrados');
await call('register', { nombre: 'Beto', apellido: 'Gómez', email: 'beto@test.com' });
r = await call('admin_sorteo', { modo: 'completos' }, admin); ok(r.data.ok && r.data.ganador.uid === uid && r.data.candidatos === 1, 'sorteo entre habilitados (5/5) → Ana');
r = await call('admin_sorteo', { modo: 'completos', excluir: [uid] }, admin); ok(r.data.ok === false, 'excluida → sin candidatos');
r = await call('admin_sorteos_list', {}, admin); ok(r.data.sorteos.length === 1, 'historial de sorteos');
r = await call('admin_export', { tipo: 'usuarios' }, admin); ok(typeof r.data === 'string' && r.data.split('\r\n').length === 3 && r.data.includes('ana@test.com'), 'export CSV usuarios (2 filas)');
r = await call('admin_export', { tipo: 'comentarios' }, admin); ok(r.data.split('\r\n').length === 4, 'export CSV comentarios (3 filas)');
r = await call('noexiste', {}, admin); ok(r.status === 404, 'acción desconocida');

console.log(fails ? `\n${fails} PRUEBAS FALLARON` : '\nTODO OK');
process.exit(fails ? 1 : 0);
