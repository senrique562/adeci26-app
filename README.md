# ADECI26 · App del congreso

Web app (PWA) del Congreso ADECI 2026 · Córdoba, 17 y 18 de septiembre · con el apoyo de ADOX.

- **Asistentes** (`/`): programa en vivo, speakers con bio, avisos en tiempo real, el juego «Tus 5 momentos en ADECI 2026», credencial QR, comité organizador, libro de resúmenes.
- **Stand ADOX** (`/staff.html`): escáner que inscribe en el sorteo a quien llega con las 5 gotas y marca la entrega del regalo.
- **Organización** (`/admin.html`): métricas, avisos, trivia, sorteo, staff, cambios de programa, configuración, exportación CSV.

**Para ponerla en marcha, seguí `GUIA_DESPLIEGUE.md`.** No hace falta programar.

## Arquitectura en una línea
Sitio estático en Netlify (sin build) + una Netlify Function (`netlify/functions/api.mjs`) que habla con Firestore mediante el Admin SDK. El navegador nunca escribe en Firestore: todos los puntos se calculan en el servidor. Los avisos y la configuración se leen en tiempo real desde Firestore (solo lectura, ver `firestore.rules`).

## Los cinco momentos (una gota cada uno, todos se registran solos en la app)
| Momento | Cómo se gana la gota |
|---|---|
| 1 · Llegada | Tocar «Ya estoy en el congreso» (se habilita los días del congreso) |
| 2 · Trivia | Responder las 3 preguntas del día |
| 3 · E-pósters | Escribir título y comentario de un trabajo visitado |
| 4 · Sesiones | Comentar tres sesiones desde el programa |
| 5 · Conocé ADOX | Marcar qué soluciones le interesa ver en el stand |

**Stand ADOX (cierre):** con las 5 gotas, el participante pasa por el stand, el staff escanea su QR una sola vez, se le entrega el regalo y queda inscripto en el sorteo. El escáner rechaza a quien no tiene las 5 gotas y le dice qué le falta. El sorteo (panel) elige al azar entre inscriptos (o entre todos los que tienen 5 gotas, a elección) y permite re-sortear excluyendo ausentes.

## Datos (Firestore)
`users/{uid}` (uid de 8 caracteres, es lo que va en el QR; `stand` = inscripto en el sorteo) · `emails/{email}` → uid · `staff/{email}` · `trivia/d1`, `trivia/d2` · `avisos/*` · `config/app` (libroUrl, standTexto, sorteoInfo, overrides) · `sorteos/*` · `stats/stand`.

## Editar contenido
- Programa y speakers: `public/data/programa.js`, `speakers.js`, `comite.js` (o desde el panel para cambios puntuales de título/participantes, sin tocar archivos).
- Textos e imágenes: `public/index.html`, `public/js/app.js`, `public/img/`.
- Colores y tipografía: `public/css/app.css` (variables al inicio).

## Pruebas
```
npm install
npm test
```
Corre 120 verificaciones (API, app de asistentes de punta a punta y panel) contra un Firestore simulado en memoria, sin red. Útil antes de publicar un cambio.

## Variables de entorno (Netlify)
Ver `.env.example`. Poner `TEST_MODE=false` el 16/9.
