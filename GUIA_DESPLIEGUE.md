# ADECI26 · Guía de puesta en marcha

Tiempo estimado: 25–30 minutos la primera vez. No hace falta escribir código.
Todo se hace desde el navegador con la cuenta **senrique562@gmail.com** (Firebase y Netlify).

Qué vas a tener al final:

| Qué | Dónde |
|---|---|
| App de asistentes | `https://adeci26.netlify.app/` |
| Escáner del stand ADOX | `https://adeci26.netlify.app/staff.html` |
| Panel de administración | `https://adeci26.netlify.app/admin.html` |

---

## Parte 1 · Firebase (la base de datos) — 10 min

### 1.1 Crear el proyecto
1. Entrá a <https://console.firebase.google.com> con senrique562@gmail.com.
2. **Agregar proyecto** → nombre: `adeci26` → desactivá Google Analytics (no hace falta) → **Crear proyecto**.

### 1.2 Activar Firestore
1. En el menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: `southamerica-east1 (São Paulo)`. Modo: **producción**. → **Habilitar**.
3. Pestaña **Reglas**: borrá todo, pegá el contenido del archivo `firestore.rules` de esta carpeta y **Publicar**.

### 1.3 Plan Blaze
Menú izquierdo abajo: **Actualizar** (o "Plan Spark") → elegí **Blaze**. El uso del congreso cuesta centavos; el plan gratuito alcanzaría, pero Blaze evita que un pico de tráfico frene la app. Podés ponerle un presupuesto de alerta de USD 5.

### 1.4 Descargar la cuenta de servicio (la "llave" que usa el servidor)
1. Engranaje ⚙ (arriba a la izquierda) → **Configuración del proyecto → Cuentas de servicio**.
2. **Generar nueva clave privada → Generar clave**. Se descarga un archivo `.json`.
3. **Guardalo en un lugar seguro y no lo compartas ni lo subas a ningún repositorio.** Lo vas a pegar en Netlify en el paso 2.4.

### 1.5 Registrar la app web (para los avisos en tiempo real)
1. Misma pantalla de configuración, pestaña **General** → sección **Tus apps** → ícono **</>** (Web).
2. Nombre: `adeci26-web`. Sin Firebase Hosting. → **Registrar app**.
3. Te muestra un bloque `const firebaseConfig = { apiKey: "...", ... }`. **Copiá solo el objeto entre llaves.**
4. Abrí el archivo `public/js/firebase-config.js` (con cualquier editor de texto, o directamente en GitHub con el lápiz una vez subido el proyecto) y reemplazá `null` por ese objeto, así:

```js
export const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "adeci26.firebaseapp.com",
  projectId: "adeci26",
  storageBucket: "adeci26.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```

> Si este paso te da problemas, dejalo en `null`: la app funciona igual, solo que los avisos tardan hasta 5 minutos en aparecer en vez de ser instantáneos.

---

## Parte 2 · Netlify (donde vive la app) — 10 min

Netlify tiene que **instalar una dependencia del servidor** (`firebase-admin`), y eso solo lo hace cuando el sitio viene de un repositorio. Por eso el camino recomendado pasa por GitHub, que es gratis y no requiere instalar nada.

### 2.1 Subir el proyecto a GitHub
1. Descomprimí `adeci26-app.zip`.
2. Entrá a <https://github.com> (creá una cuenta gratuita con senrique562@gmail.com si no tenés).
3. **New repository** → nombre `adeci26-app` → **Private** → **Create repository**.
4. En la pantalla del repo vacío: **uploading an existing file**. Arrastrá **todo el contenido de la carpeta `adeci26-app`** (los archivos y las carpetas `public`, `netlify`, `tests`; GitHub respeta las subcarpetas). **Commit changes**.
5. Verificá que en el repo se vean `netlify.toml`, `package.json` y las carpetas `public` y `netlify`.

> Cada vez que haya que cambiar algo (por ejemplo `firebase-config.js`), se edita el archivo en GitHub con el lápiz y Netlify republica solo en un minuto.

### 2.2 Conectar Netlify
1. Entrá a <https://app.netlify.com> con senrique562@gmail.com.
2. **Add new site → Import an existing project → GitHub** → autorizá y elegí `adeci26-app`.
3. Dejá todo como viene (Netlify lee `netlify.toml`: publica `public` y usa `netlify/functions`). **Deploy site**.
4. Cuando termine (1–2 minutos), **Site configuration → Site details → Change site name** → `adeci26`. Queda `https://adeci26.netlify.app`.

### 2.3 Si preferís no usar GitHub
Alternativa con Node.js instalado en tu computadora: en la carpeta del proyecto, `npm install -g netlify-cli`, `netlify login`, `netlify init` y `netlify deploy --prod`. Es igual de válido, pero requiere la terminal. Si en algún punto te trabás, es el momento de la sesión conjunta.

### 2.4 Variables de entorno (las claves)
**Site configuration → Environment variables → Add a variable → Add a single variable**. Cargá una por una:

| Clave | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Abrí el `.json` del paso 1.4 con el Bloc de notas, **seleccioná todo, copiá y pegá tal cual**. Es largo y tiene saltos de línea: está bien. |
| `APP_SECRET` | Una frase larga al azar, por ejemplo 40 letras y números mezclados. Nadie la va a tipear: sirve para firmar las sesiones. |
| `ADMIN_PIN` | El PIN del panel de administración (6 dígitos o más). |
| `ADMIN_EMAILS` | `secretaria@essentia-medical.com.ar,info@essentia-medical.com.ar,silvia@essentia-medica.com.ar,senrique562@gmail.com` |
| `STAFF_PIN` | El PIN que van a usar las 10 personas de ADOX en el escáner. Distinto del anterior. |
| `TEST_MODE` | `true` (permite probar check-in y trivia antes del 17). **El 16/9 cambiarlo a `false`.** |

Después de cargar las variables: **Deploys → Trigger deploy → Deploy site** para que tomen efecto.

### 2.5 Probar
1. Abrí `https://adeci26.netlify.app/`. Registrate con tu nombre y correo. Deberías ver "Ahora" y las cinco pestañas.
2. Abrí `https://adeci26.netlify.app/admin.html`. Entrá con tu correo y el `ADMIN_PIN`. Si ves las métricas con "1 registrado", **el servidor está conectado a Firebase**. Listo lo difícil.

Si algo falla: en Netlify, **Logs → Functions → api** muestra el error. Los más comunes:
- *"Falta FIREBASE_SERVICE_ACCOUNT"* → la variable no se cargó o no se redesplegó.
- *"Unexpected token"* al arrancar → el JSON se pegó incompleto. Volvé a copiarlo entero.
- *Error 500 en cualquier acción* → Firestore no está habilitado (paso 1.2).

---

## Parte 3 · Cargar contenido desde el panel — 10 min

Todo esto se hace en `/admin.html`, sin tocar archivos.

1. **Staff ADOX**: agregá los 10 correos de las personas del stand. Ellas entran a `/staff.html` con su correo + `STAFF_PIN`. Probá vos una vez: registrate en la app, abrí "Yo" y escaneá tu propio QR desde otro celular (o escribí el código de 8 letras a mano).
2. **Trivia**: cargá las 3 preguntas de cada día (ver `TRIVIA_BORRADOR.md`, a validar por el Comité Científico). Marcá la opción correcta con el círculo.
3. **Configuración**: ubicación del stand, texto del sorteo (cuando ADOX defina horario y premios) y el enlace al PDF del libro de resúmenes cuando esté.
4. **Avisos**: probá publicar uno y mirá cómo aparece en la app.
5. **Programa**: solo si cambia un título o un speaker. Completás el campo y listo; vacío = original.

---

## Parte 4 · Antes y durante el congreso

**Martes 16/9**
- `TEST_MODE` → `false` y redesplegar. Desde ese momento el check-in y la trivia solo se habilitan en su día.
- Borrá los usuarios de prueba: en Firebase Console → Firestore → colección `users`, borrá los documentos de prueba (y los mismos correos en `emails`). O dejalos: no molestan en las métricas si son pocos.
- Imprimí el QR con la URL `https://adeci26.netlify.app/` para credenciales y cartelería. Cualquier generador de QR sirve.

**Durante**
- Avisos urgentes: panel → Avisos. Aparecen en todos los celulares en segundos.
- Cambio de horario o speaker: panel → Programa.
- Sorteo: panel → Sorteo → botón. Si la persona no está, "Ausente" y volvés a sortear.
- Si un asistente dice que no le anda: que abra la app en el navegador (Chrome o Safari) y se registre con el **mismo correo**. Recupera todo.

**Después**
- Panel → Métricas → **Exportar**: participantes y avance, comentarios por sesión (para el Comité Científico), e-pósters visitados. Se abren en Excel.
- Eso es lo que le va a ADOX como informe post evento, más las visitas al stand.

---

## Costos esperados
- Netlify: plan gratuito alcanza (125.000 llamadas a funciones por mes; el congreso usa unas 25.000). Si preferís no arriesgar, el plan Pro de un mes cuesta USD 19 y se puede dar de baja después.
- Firebase: centavos de dólar por todo el congreso.
- GitHub: gratuito.
- Dominio: ninguno, se usa `adeci26.netlify.app`. Si ADECI quisiera `app.adeci.org.ar`, es un registro DNS que les puede hacer quien administra el sitio.

## Qué hay en la carpeta
```
adeci26-app/
├── netlify.toml                ← configuración de Netlify (no tocar)
├── package.json                ← dependencia firebase-admin
├── firestore.rules             ← reglas para pegar en Firebase (paso 1.2)
├── .env.example                ← lista de variables de entorno (paso 2.4)
├── netlify/functions/api.mjs   ← el servidor: registro, puntos, sorteo, panel
└── public/                     ← lo que ve la gente
    ├── index.html + js/app.js  ← app de asistentes
    ├── staff.html              ← escáner del stand
    ├── admin.html              ← panel
    ├── js/firebase-config.js   ← pegar config web (paso 1.5)
    ├── data/                   ← programa, speakers, comité
    └── img/                    ← logos e íconos
```
