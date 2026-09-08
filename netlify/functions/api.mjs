// ADECI26 · API (Netlify Function)
// Todas las acciones entran por POST /api/<accion> con JSON. El frontend nunca habla con
// Firestore directamente: todo pasa por acá con el Admin SDK, así el puntaje no puede
// falsificarse desde el celular.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ───────────────────────── configuración ─────────────────────────
const ENV = process.env;
const SECRET = ENV.APP_SECRET || 'cambiar-este-secreto';
const ADMIN_PIN = ENV.ADMIN_PIN || '';
const STAFF_PIN = ENV.STAFF_PIN || '';
const ADMIN_EMAILS = (ENV.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const TEST_MODE = ENV.TEST_MODE === 'true';

const DIAS = { 1: '2026-09-17', 2: '2026-09-18' };
// Una gota por momento completado (5 en total).

function db() {
  if (!getApps().length) {
    let raw = ENV.FIREBASE_SERVICE_ACCOUNT || '';
    if (!raw && ENV.FIREBASE_SERVICE_ACCOUNT_B64) raw = Buffer.from(ENV.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
    if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
    const sa = JSON.parse(raw);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

// ───────────────────────── utilidades ─────────────────────────
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const err = (msg, status = 400) => json({ error: msg }, status);

const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const p = b64u(JSON.stringify(payload));
  const s = createHmac('sha256', SECRET).update(p).digest('base64url');
  return `${p}.${s}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [p, s] = token.split('.');
  const exp = createHmac('sha256', SECRET).update(p).digest('base64url');
  if (exp.length !== s.length || !timingSafeEqual(Buffer.from(exp), Buffer.from(s))) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (payload.x && payload.x < Date.now()) return null;
    return payload;
  } catch { return null; }
}
const pinOk = (a, b) => a && b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const clean = (s, max = 200) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const emailKey = (e) => e.toLowerCase().trim();
const newUid = () => randomBytes(5).toString('hex').toUpperCase().slice(0, 8); // ej. 3F9A1C7B

function hoyAR() {
  // Argentina es UTC-3 sin horario de verano.
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function diaHabilitado(dia) {
  // La trivia de un día se puede responder ese día o después (no antes).
  if (TEST_MODE) return true;
  return hoyAR() >= DIAS[dia];
}

// Trivia: de un banco de hasta 8 preguntas por día, cada participante recibe 3, elegidas y ordenadas
// de forma determinística a partir de su uid. Así dos personas sentadas juntas rara vez ven lo mismo,
// y la corrección usa exactamente la misma selección.
const TRIVIA_POR_PERSONA = 3;
function seleccionTrivia(pool, uid) {
  let h = 2166136261;
  for (const c of uid) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, Math.min(TRIVIA_POR_PERSONA, idx.length)).map(i => pool[i]);
}

// ───────────────────────── progreso ─────────────────────────
function progreso(u) {
  const m2 = u.m2 || {}, m4 = Array.isArray(u.m4) ? u.m4 : [];
  const triviaDias = ['1', '2'].filter(d => m2[d]).length;
  const momentos = {
    m1: !!u.m1,                                  // confirmó su llegada al congreso (un toque en la app)
    m2: triviaDias > 0,                          // trivia respondida (al menos un día)
    m3: !!u.m3,                                  // e-póster: título + comentario
    m4: m4.length >= 3,                          // comentarios en tres sesiones
    m5: !!u.m5,                                  // "Conocé ADOX": marcó sus intereses para el stand
  };
  const completos = Object.values(momentos).filter(Boolean).length;
  return {
    momentos, completos, gotas: completos,
    detalle: {
      llegada: u.m1 ? u.m1.dia : null,
      trivia: { 1: m2['1'] ? { correctas: m2['1'].correctas, total: m2['1'].total } : null, 2: m2['2'] ? { correctas: m2['2'].correctas, total: m2['2'].total } : null },
      eposter: u.m3 ? { titulo: u.m3.titulo, comentario: u.m3.comentario || '' } : null,
      comentarios: m4.map(c => ({ sesionId: c.sesionId, texto: c.texto })),
      adox: u.m5 ? { intereses: u.m5.intereses || [] } : null,
    },
    habilitado: completos === 5,
    inscripto: !!u.stand,   // pasó por el stand: regalo entregado e inscripto en el sorteo
  };
}

const publico = (u) => ({ uid: u.uid, nombre: u.nombre, apellido: u.apellido, email: u.email });
const INTERESES = ['manos', 'superficies', 'biofilm', 'esterilizacion', 'monitoreo', 'otro'];

// ───────────────────────── acciones ─────────────────────────
async function getUser(fs, uid) {
  const snap = await fs.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

const acciones = {
  // ---------- asistentes ----------
  async register({ body, fs }) {
    const nombre = clean(body.nombre, 60), apellido = clean(body.apellido, 60);
    const email = emailKey(clean(body.email, 120));
    if (nombre.length < 2 || apellido.length < 2) return err('Nombre y apellido son obligatorios.');
    if (!emailOk(email)) return err('El correo no parece válido.');

    const idxRef = fs.collection('emails').doc(email);
    const idx = await idxRef.get();
    let uid, u;
    if (idx.exists) {
      uid = idx.data().uid;
      u = await getUser(fs, uid);
      if (!u) return err('Cuenta inconsistente. Escribinos a adeci@adeci.org.ar', 500);
    } else {
      uid = newUid();
      u = { uid, nombre, apellido, email, creado: Date.now(), m1: null, m2: {}, m3: null, m4: [], m5: null, stand: null };
      const batch = fs.batch();
      batch.set(fs.collection('users').doc(uid), u);
      batch.set(idxRef, { uid, email });
      await batch.commit();
    }
    const token = sign({ u: uid, e: email, r: 'user', x: Date.now() + 1000 * 3600 * 24 * 60 });
    return json({ token, user: publico(u), progreso: progreso(u), nuevo: !idx.exists });
  },

  async me({ auth, fs }) {
    const u = await getUser(fs, auth.u);
    if (!u) return err('Sesión inválida.', 401);
    return json({ user: publico(u), progreso: progreso(u) });
  },

  async checkin({ auth, fs }) {
    const hoy = hoyAR();
    const dia = Object.keys(DIAS).find(d => DIAS[d] === hoy) || (TEST_MODE ? '1' : null);
    if (!dia) return err('La confirmación de llegada se habilita el 17 de septiembre, en el congreso.');
    const u = await getUser(fs, auth.u);
    if (!u.m1) await fs.collection('users').doc(auth.u).set({ m1: { at: Date.now(), dia: Number(dia) } }, { merge: true });
    return json({ ok: true, progreso: progreso(await getUser(fs, auth.u)) });
  },

  async adox({ auth, body, fs }) {
    const intereses = [...new Set((Array.isArray(body.intereses) ? body.intereses : []).map(String).filter(x => INTERESES.includes(x)))];
    if (!intereses.length) return err('Marcá al menos una opción.');
    const comentario = clean(body.comentario, 300);
    await fs.collection('users').doc(auth.u).set({ m5: { intereses, comentario, at: Date.now() } }, { merge: true });
    return json({ ok: true, progreso: progreso(await getUser(fs, auth.u)) });
  },

  async trivia_get({ auth, body, fs }) {
    const dia = Number(body.dia);
    if (!DIAS[dia]) return err('Día inválido.');
    const [tSnap, u] = await Promise.all([fs.collection('trivia').doc('d' + dia).get(), getUser(fs, auth.u)]);
    const t = tSnap.exists ? tSnap.data() : null;
    const preguntas = seleccionTrivia(t?.preguntas || [], auth.u).map(({ correcta, explicacion, ...q }) => q);
    const respondida = u?.m2?.[dia] || null;
    return json({
      dia, habilitado: diaHabilitado(dia), disponible: preguntas.length > 0, preguntas,
      respondida: respondida ? { correctas: respondida.correctas, total: respondida.total, detalle: respondida.detalle } : null,
    });
  },

  async trivia_answer({ auth, body, fs }) {
    const dia = Number(body.dia);
    if (!DIAS[dia]) return err('Día inválido.');
    if (!diaHabilitado(dia)) return err('La trivia de este día todavía no está habilitada.');
    const u = await getUser(fs, auth.u);
    if (u?.m2?.[dia]) return json({ ok: true, yaRespondida: true, resultado: u.m2[dia], progreso: progreso(u) });
    const tSnap = await fs.collection('trivia').doc('d' + dia).get();
    const preguntas = seleccionTrivia(tSnap.exists ? (tSnap.data().preguntas || []) : [], auth.u);
    if (!preguntas.length) return err('La trivia de hoy todavía no fue cargada.');
    const resp = Array.isArray(body.respuestas) ? body.respuestas.map(Number) : [];
    if (resp.length !== preguntas.length) return err('Faltan respuestas.');
    let correctas = 0;
    const detalle = preguntas.map((q, i) => {
      const ok = resp[i] === Number(q.correcta);
      if (ok) correctas++;
      return { id: q.id, elegida: resp[i], correcta: Number(q.correcta), ok, explicacion: q.explicacion || '' };
    });
    const resultado = { correctas, total: preguntas.length, detalle, at: Date.now() };
    await fs.collection('users').doc(auth.u).set({ m2: { [dia]: resultado } }, { merge: true });
    const u2 = await getUser(fs, auth.u);
    return json({ ok: true, resultado, progreso: progreso(u2) });
  },

  async eposter({ auth, body, fs }) {
    const titulo = clean(body.titulo, 220), comentario = clean(body.comentario, 600);
    if (titulo.length < 4) return err('Escribí el título del trabajo (al menos 4 caracteres).');
    if (comentario.length < 3) return err('Dejá un comentario breve sobre el trabajo.');
    await fs.collection('users').doc(auth.u).set({ m3: { titulo, comentario, at: Date.now() } }, { merge: true });
    const u = await getUser(fs, auth.u);
    return json({ ok: true, progreso: progreso(u) });
  },

  async comentario({ auth, body, fs }) {
    const sesionId = clean(body.sesionId, 20), texto = clean(body.texto, 600);
    if (!/^d[12]-\d{2}$/.test(sesionId)) return err('Sesión inválida.');
    if (texto.length < 3) return err('El comentario es muy corto.');
    const u = await getUser(fs, auth.u);
    const lista = (Array.isArray(u.m4) ? u.m4 : []).filter(c => c.sesionId !== sesionId);
    if (lista.length >= 10) return err('Ya dejaste el máximo de comentarios.');
    lista.push({ sesionId, texto, at: Date.now() });
    await fs.collection('users').doc(auth.u).update({ m4: lista });
    const u2 = await getUser(fs, auth.u);
    return json({ ok: true, progreso: progreso(u2) });
  },

  // ---------- público (sin token) ----------
  async avisos({ fs }) {
    const snap = await fs.collection('avisos').orderBy('at', 'desc').limit(20).get();
    return json({ avisos: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },

  async config({ fs }) {
    const snap = await fs.collection('config').doc('app').get();
    const c = snap.exists ? snap.data() : {};
    return json({
      libroUrl: c.libroUrl || '',
      standTexto: c.standTexto || 'Stand de ADOX · hall central',
      sorteoInfo: c.sorteoInfo || 'Los sorteos se hacen en el stand de ADOX. Hay que estar presente.',
      overrides: c.overrides || {},
    });
  },

  // ---------- staff (stand ADOX) ----------
  async staff_login({ body, fs }) {
    const email = emailKey(clean(body.email, 120)), pin = clean(body.pin, 20);
    if (!emailOk(email)) return err('Correo inválido.');
    const esAdmin = ADMIN_EMAILS.includes(email) && pinOk(pin, ADMIN_PIN);
    if (!esAdmin) {
      if (!pinOk(pin, STAFF_PIN)) return err('PIN incorrecto.', 401);
      const s = await fs.collection('staff').doc(email).get();
      if (!s.exists) return err('Este correo no está habilitado como staff.', 403);
    }
    const token = sign({ e: email, r: esAdmin ? 'admin' : 'staff', x: Date.now() + 1000 * 3600 * 24 * 7 });
    return json({ token, role: esAdmin ? 'admin' : 'staff', email });
  },

  async staff_scan({ auth, body, fs }) {
    if (!['staff', 'admin'].includes(auth.r)) return err('No autorizado.', 403);
    const uid = clean(body.uid, 200).toUpperCase().replace(/^.*[?&]C=/, '').replace(/^ADECI26:/, '').replace(/[^A-Z0-9].*$/, '');
    if (!/^[A-Z0-9]{6,12}$/.test(uid)) return err('Código inválido.');
    const u = await getUser(fs, uid);
    if (!u) return err('No encontramos ese código. Pedile que abra "Mi credencial" en la app.', 404);
    const p = progreso(u);
    if (!p.habilitado) return json({ ok: false, motivo: 'incompleto', user: publico(u), progreso: p });
    const yaEstaba = !!u.stand;
    if (!yaEstaba) {
      await fs.collection('users').doc(uid).set({ stand: { at: Date.now(), por: auth.e } }, { merge: true });
      await fs.collection('stats').doc('stand').set({ inscriptos: FieldValue.increment(1) }, { merge: true });
    }
    const u2 = yaEstaba ? u : await getUser(fs, uid);
    return json({ ok: true, yaEstaba, user: publico(u2), progreso: progreso(u2) });
  },

  async staff_stats({ auth, fs }) {
    if (!['staff', 'admin'].includes(auth.r)) return err('No autorizado.', 403);
    const s = await fs.collection('stats').doc('stand').get();
    const d = s.exists ? s.data() : {};
    return json({ inscriptos: d.inscriptos || 0 });
  },

  // ---------- administración ----------
  async admin_login({ body }) {
    const email = emailKey(clean(body.email, 120)), pin = clean(body.pin, 20);
    if (!ADMIN_EMAILS.includes(email)) return err('Este correo no es administrador.', 403);
    if (!pinOk(pin, ADMIN_PIN)) return err('PIN incorrecto.', 401);
    const token = sign({ e: email, r: 'admin', x: Date.now() + 1000 * 3600 * 24 * 7 });
    return json({ token, role: 'admin', email });
  },

  async admin_avisos_add({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const titulo = clean(body.titulo, 80), texto = clean(body.texto, 400);
    if (!titulo && !texto) return err('Escribí un aviso.');
    const ref = await fs.collection('avisos').add({ titulo, texto, at: Date.now(), por: auth.e });
    return json({ ok: true, id: ref.id });
  },
  async admin_avisos_del({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    await fs.collection('avisos').doc(clean(body.id, 40)).delete();
    return json({ ok: true });
  },

  async admin_trivia_get({ auth, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const [a, b] = await Promise.all([fs.collection('trivia').doc('d1').get(), fs.collection('trivia').doc('d2').get()]);
    return json({ 1: a.exists ? a.data().preguntas : [], 2: b.exists ? b.data().preguntas : [] });
  },
  async admin_trivia_save({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const dia = Number(body.dia);
    if (!DIAS[dia]) return err('Día inválido.');
    const preguntas = (Array.isArray(body.preguntas) ? body.preguntas : []).slice(0, 8).map((q, i) => ({
      id: 'q' + (i + 1),
      texto: clean(q.texto, 300),
      opciones: (Array.isArray(q.opciones) ? q.opciones : []).slice(0, 4).map(o => clean(o, 160)),
      correcta: Number(q.correcta) || 0,
      explicacion: clean(q.explicacion, 400),
    })).filter(q => q.texto && q.opciones.length >= 2);
    await fs.collection('trivia').doc('d' + dia).set({ preguntas, actualizado: Date.now() });
    return json({ ok: true, cantidad: preguntas.length });
  },

  async admin_staff_list({ auth, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const snap = await fs.collection('staff').get();
    return json({ staff: snap.docs.map(d => d.data()) });
  },
  async admin_staff_add({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const email = emailKey(clean(body.email, 120)), nombre = clean(body.nombre, 80);
    if (!emailOk(email)) return err('Correo inválido.');
    await fs.collection('staff').doc(email).set({ email, nombre, alta: Date.now() });
    return json({ ok: true });
  },
  async admin_staff_del({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    await fs.collection('staff').doc(emailKey(clean(body.email, 120))).delete();
    return json({ ok: true });
  },

  async admin_config_get({ auth, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const snap = await fs.collection('config').doc('app').get();
    return json(snap.exists ? snap.data() : {});
  },
  async admin_config_save({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const data = {};
    if ('libroUrl' in body) data.libroUrl = clean(body.libroUrl, 400);
    if ('standTexto' in body) data.standTexto = clean(body.standTexto, 120);
    if ('sorteoInfo' in body) data.sorteoInfo = clean(body.sorteoInfo, 300);
    if ('overrides' in body && typeof body.overrides === 'object') {
      const ov = {};
      for (const [k, v] of Object.entries(body.overrides || {})) {
        if (!/^d[12]-\d{2}$/.test(k) || !v) continue;
        const o = {};
        if (v.titulo) o.titulo = clean(v.titulo, 300);
        if (v.participantes) o.participantes = clean(v.participantes, 400);
        if (Object.keys(o).length) ov[k] = o;
      }
      data.overrides = ov;
    }
    await fs.collection('config').doc('app').set(data, { merge: true });
    return json({ ok: true });
  },

  async admin_metricas({ auth, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const snap = await fs.collection('users').get();
    const M = { total: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, completos: 0, inscriptos: 0, triviaD1: 0, triviaD2: 0, triviaAciertosD1: 0, triviaAciertosD2: 0, comentarios: 0, gotasTotal: 0, porCompletos: [0, 0, 0, 0, 0, 0] };
    const comentariosPorSesion = {}; const intereses = {};
    snap.forEach(d => {
      const u = d.data(); const p = progreso(u);
      M.total++;
      for (const k of ['m1', 'm2', 'm3', 'm4', 'm5']) if (p.momentos[k]) M[k]++;
      if (p.habilitado) M.completos++;
      if (u.stand) M.inscriptos++;
      for (const k of (u.m5?.intereses || [])) intereses[k] = (intereses[k] || 0) + 1;
      M.porCompletos[p.completos]++;
      if (u.m2?.[1]) { M.triviaD1++; M.triviaAciertosD1 += u.m2[1].correctas || 0; }
      if (u.m2?.[2]) { M.triviaD2++; M.triviaAciertosD2 += u.m2[2].correctas || 0; }
      M.comentarios += (u.m4 || []).length;
      M.gotasTotal += p.gotas;
      for (const c of (u.m4 || [])) comentariosPorSesion[c.sesionId] = (comentariosPorSesion[c.sesionId] || 0) + 1;
    });
    return json({ ...M, comentariosPorSesion, intereses });
  },

  async admin_export({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const tipo = clean(body.tipo, 20) || 'usuarios';
    const snap = await fs.collection('users').get();
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    let filas = [];
    if (tipo === 'comentarios') {
      filas.push(['sesionId', 'nombre', 'apellido', 'email', 'comentario', 'fecha'].map(esc).join(';'));
      snap.forEach(d => { const u = d.data(); for (const c of (u.m4 || [])) filas.push([c.sesionId, u.nombre, u.apellido, u.email, c.texto, new Date(c.at).toISOString()].map(esc).join(';')); });
    } else if (tipo === 'eposters') {
      filas.push(['nombre', 'apellido', 'email', 'titulo_eposter', 'comentario', 'fecha'].map(esc).join(';'));
      snap.forEach(d => { const u = d.data(); if (u.m3) filas.push([u.nombre, u.apellido, u.email, u.m3.titulo, u.m3.comentario || '', new Date(u.m3.at).toISOString()].map(esc).join(';')); });
    } else {
      filas.push(['uid', 'nombre', 'apellido', 'email', 'registro', 'm1_llegada', 'm2_trivia', 'm3_eposter', 'm4_comentarios', 'm5_adox', 'gotas', 'intereses_adox', 'inscripto_sorteo_el', 'trivia_d1', 'trivia_d2'].map(esc).join(';'));
      snap.forEach(d => {
        const u = d.data(); const p = progreso(u);
        filas.push([u.uid, u.nombre, u.apellido, u.email, new Date(u.creado || 0).toISOString(),
          p.momentos.m1 ? 1 : 0, p.momentos.m2 ? 1 : 0, p.momentos.m3 ? 1 : 0, p.momentos.m4 ? 1 : 0, p.momentos.m5 ? 1 : 0,
          p.gotas, (u.m5?.intereses || []).join(', '), u.stand ? new Date(u.stand.at).toISOString() : '',
          u.m2?.[1] ? `${u.m2[1].correctas}/${u.m2[1].total}` : '', u.m2?.[2] ? `${u.m2[2].correctas}/${u.m2[2].total}` : ''].map(esc).join(';'));
      });
    }
    return new Response('\uFEFF' + filas.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="adeci26-${tipo}.csv"` } });
  },

  async admin_sorteo({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const modo = body.modo === 'completos' ? 'completos' : 'inscriptos';
    const excluir = new Set((Array.isArray(body.excluir) ? body.excluir : []).map(String));
    const snap = await fs.collection('users').get();
    const candidatos = [];
    snap.forEach(d => {
      const u = d.data(); const p = progreso(u);
      const elegible = modo === 'inscriptos' ? !!u.stand : p.habilitado;
      if (elegible && !excluir.has(u.uid)) candidatos.push(u);
    });
    if (!candidatos.length) return json({ ok: false, mensaje: 'No hay participantes elegibles con ese criterio.', candidatos: 0 });
    const idx = randomBytes(4).readUInt32BE(0) % candidatos.length;
    const g = candidatos[idx];
    const reg = { at: Date.now(), modo, uid: g.uid, nombre: g.nombre, apellido: g.apellido, email: g.email, por: auth.e, candidatos: candidatos.length };
    const ref = await fs.collection('sorteos').add(reg);
    return json({ ok: true, id: ref.id, ganador: publico(g), candidatos: candidatos.length });
  },
  async admin_sorteos_list({ auth, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const snap = await fs.collection('sorteos').orderBy('at', 'desc').limit(50).get();
    return json({ sorteos: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  },
  async admin_sorteo_marcar({ auth, body, fs }) {
    if (auth.r !== 'admin') return err('No autorizado.', 403);
    const id = clean(body.id, 40), estado = clean(body.estado, 20); // 'entregado' | 'ausente'
    await fs.collection('sorteos').doc(id).set({ estado }, { merge: true });
    return json({ ok: true });
  },
};

const SIN_TOKEN = new Set(['register', 'avisos', 'config', 'staff_login', 'admin_login']);

// ───────────────────────── handler ─────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return err('Método no permitido.', 405);

  const url = new URL(req.url);
  const accion = url.pathname.split('/').filter(Boolean).pop();
  const fn = acciones[accion];
  if (!fn) return err('Acción desconocida: ' + accion, 404);

  let body = {};
  try { body = await req.json(); } catch { body = {}; }

  let auth = null;
  if (!SIN_TOKEN.has(accion)) {
    const h = req.headers.get('authorization') || '';
    auth = verify(h.replace(/^Bearer\s+/i, ''));
    if (!auth) return err('Sesión inválida o vencida.', 401);
  }

  try {
    return await fn({ body, auth, fs: db() });
  } catch (e) {
    console.error('[api]', accion, e);
    return err('Error interno: ' + (e.message || 'desconocido'), 500);
  }
};

export const config = { path: '/api/*' };
