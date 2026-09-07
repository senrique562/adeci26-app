# ADECI26 · App del congreso

Web app (PWA) del Congreso ADECI 2026 · Córdoba, 17 y 18 de septiembre · con el apoyo de ADOX.

- **Asistentes** (`/`): programa en vivo, speakers con bio, avisos en tiempo real, el juego «Tus 5 momentos en ADECI 2026», credencial QR, comité organizador, libro de resúmenes.
- **Stand ADOX** (`/staff.html`): escáner de credenciales que acredita el momento 5.
- **Organización** (`/admin.html`): métricas, avisos, trivia, sorteo, staff, cambios de programa, configuración, exportación CSV.

**Para ponerla en marcha, seguí `GUIA_DESPLIEGUE.md`.** No hace falta programar.

## Arquitectura en una línea
Sitio estático en Netlify (sin build) + una Netlify Function (`netlify/functions/api.mjs`) que habla con Firestore mediante el Admin SDK. El navegador nunca escribe en Firestore: todos los puntos se calculan en el servidor. Los avisos y la configuración se leen en tiempo real desde Firestore (solo lectura, ver `firestore.rules`).

## Cómo se acreditan los momentos y las gotas
| Momento | Acción | Gotas |
|---|---|---|
| 1 | Check-in desde la app (por día) | 60 por día |
| 2 | Trivia diaria (3 preguntas) | 30 por correcta + 30 bonus si 3/3 |
| 3 | Título de un e-póster visitado | 90 |
| 4 | Comentario sobre 3 sesiones | 30 por comentario (máx. 5) |
| 5 | Escaneo en el stand ADOX | 150 |

Habilitado para el sorteo = 5 de 5. El sorteo (panel) elige al azar entre habilitados (o entre todos los escaneados, a elección) y permite re-sortear excluyendo ausentes.

## Datos (Firestore)
`users/{uid}` (uid de 8 caracteres, es lo que va en el QR) · `emails/{email}` → uid · `staff/{email}` · `trivia/d1`, `trivia/d2` · `avisos/*` · `config/app` (libroUrl, standTexto, sorteoInfo, overrides) · `sorteos/*` · `stats/stand`.

## Editar contenido
- Programa y speakers: `public/data/programa.js`, `speakers.js`, `comite.js` (o desde el panel para cambios puntuales de título/participantes, sin tocar archivos).
- Textos e imágenes: `public/index.html`, `public/js/app.js`, `public/img/`.
- Colores y tipografía: `public/css/app.css` (variables al inicio).

## Pruebas
```
npm install
npm test
```
Corre 115 verificaciones (API, app de asistentes de punta a punta y panel) contra un Firestore simulado en memoria, sin red. Útil antes de publicar un cambio.

## Variables de entorno (Netlify)
Ver `.env.example`. Poner `TEST_MODE=false` el 16/9.
