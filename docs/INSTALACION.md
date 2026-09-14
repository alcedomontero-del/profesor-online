# Guía de instalación y despliegue

> Objetivo de este documento: que la versión que subas a Git y despliegues a **Netlify**
> quede **configurada y funcional desde el primer despliegue** — no solo que "abra", sino
> que login, Firestore, Cloudinary y los agentes (Gemini vía Firebase AI Logic) funcionen
> realmente en el dominio público. Sigue los pasos en orden.
>
> **Reparto de roles:** Netlify sirve el sitio estático (HTML/CSS/JS). Firebase se usa
> SOLO como backend — Authentication, Firestore y AI Logic (Gemini) — nunca como hosting.

## 0. Qué necesitas antes de empezar
- Una cuenta de Google (para Firebase Console).
- Una cuenta de Netlify (gratuita) — [netlify.com](https://www.netlify.com).
- Una cuenta de Cloudinary (gratuita).
- Node.js instalado en tu máquina, solo si quieres usar el CLI de Firebase para publicar
  las reglas de Firestore (paso 3) — no lo necesitas para el código de la app ni para
  Netlify; la app sigue siendo HTML/JS puro, sin build step.
- Git y una cuenta de GitHub (Netlify despliega conectando tu repo directamente).

## 1. Crear el proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com) → **Agregar proyecto**.
2. Dentro del proyecto, entra a **Compilación → Authentication** → pestaña
   "Sign-in method" → habilita **Correo electrónico/contraseña**.
3. Entra a **Compilación → Firestore Database** → **Crear base de datos** → modo
   producción (las reglas reales se publican en el paso 4) → elige la región más cercana
   a tus estudiantes.

## 2. Copiar tus credenciales reales al código
1. En Firebase Console: ⚙️ **Configuración del proyecto** → pestaña **General** → sección
   "Tus apps" → si no hay una app web, créala (ícono `</>`) → copia el objeto
   `firebaseConfig`.
2. En el proyecto, copia `public/js/firebase-config.example.js` a
   `public/js/firebase-config.js` y pega ahí tus valores reales de `firebaseConfig`.
3. **Esta clave es pública por diseño** (así lo indica el propio comentario del archivo):
   no protege nada por sí sola, la seguridad real la dan las Reglas de Firestore. Por eso
   `firebase-config.js` **sí se sube a Git normalmente**, no hace falta ignorarlo ni
   tratarlo como secreto.

## 3. Publicar las reglas de seguridad de Firestore
Con el [CLI de Firebase](https://firebase.google.com/docs/cli) instalado
(`npm install -g firebase-tools`), desde la raíz del proyecto:
```bash
firebase login
firebase use --add        # elige tu proyecto, dale un alias como "default"
firebase deploy --only firestore:rules
```
Esto requiere que exista `firebase.json` apuntando a `docs/firestore.rules` (ya viene
incluido en este proyecto — ver sección 6).

## 4. Crear tu usuario administrador
El registro público del formulario de login **siempre crea `rol: "estudiante"`** — nunca
un admin, a propósito, por seguridad. Para tener un admin:
1. Regístrate normalmente una vez desde `public/index.html` (o la web ya desplegada) con
   tu correo real.
2. En Firebase Console → Firestore → colección `usuarios` → busca tu documento (el ID es
   tu UID de Authentication) → edita el campo `rol` de `"estudiante"` a `"admin"`.
3. **Confirma tu correo antes de intentar entrar** (desde v16, esto aplica a cualquier
   cuenta, admin incluido — el chequeo de `emailVerified` no distingue roles). Al
   registrarte te llega un correo de confirmación normal; ábrelo y haz clic en el
   enlace. Si prefieres saltarte ese paso para tu propia cuenta de admin, puedes marcar
   el correo como verificado a mano desde Firebase Console → Authentication → busca tu
   usuario →⋮ → "Marcar correo electrónico como verificado" — pero sin uno de los dos
   pasos (confirmar o marcarlo a mano), el login te dejará atascado en la pantalla
   "confirma tu correo" aunque ya seas admin en Firestore.
4. Vuelve a iniciar sesión para que el cambio de rol tome efecto.

## 5. Configurar Cloudinary (certificados, media de clases, recursos de los agentes)
1. Crea una cuenta en [Cloudinary](https://cloudinary.com) → copia tu **Cloud name**
   desde el dashboard.
2. Ve a **Settings → Upload → Upload presets → Add upload preset** → modo
   **Unsigned** (obligatorio, es lo que permite subir directo desde el navegador sin
   backend propio) → guarda y copia el nombre del preset.
3. Copia `public/js/cloudinaryConfig.js` (ya viene con placeholders `"TU-CLOUD-NAME"` /
   `"TU-UPLOAD-PRESET"`) y reemplaza esos dos valores por los tuyos. No hace falta
   pasar por el panel admin ni por Firestore — es el mismo archivo que ya usas en tus
   otros proyectos para esto. Igual que `firebase-config.js`, este archivo **sí se
   commitea** con tus valores reales: el cloud name y un upload preset *unsigned* no
   son secretos (la seguridad de un preset unsigned la da su configuración del lado de
   Cloudinary — restricciones de carpeta, tamaño, tipos de archivo — no que su nombre
   quede oculto).

## 6. Configurar Firebase AI Logic (Gemini) — el paso que más falla si se salta
Esta es la parte que hace funcionar a los agentes Profesor e Ingeniero. El código ya está
correctamente estructurado sobre el SDK actual (`getAI` + `GoogleAIBackend` +
`getGenerativeModel` desde `firebase-ai.js`, sin las funciones viejas `getVertexAI` de la
versión preview) — lo que falta es la configuración del lado de Firebase Console:

1. Firebase Console → **Compilación → AI Logic** → **Comenzar**.
2. Cuando te pregunte el proveedor de la API, elige **Gemini Developer API** (capa
   gratuita, sin necesidad del plan de pago Blaze) — NO elijas Vertex AI.
3. **El código ya trae un modelo estable fijado, no un alias.** `firebase-config.example.js`
   usa `MODELO_GEMINI = "gemini-3.5-flash"` — verificado el 2026-09-14 en la
   [página oficial de modelos de Firebase AI Logic](https://firebase.google.com/docs/ai-logic/models):
   versión estable, sin costo de Blaze, con fecha de retiro garantizada "no antes de
   mayo de 2027". La propia documentación de Google desaconseja usar el alias
   `-latest` (como `gemini-flash-latest`) en producción porque puede cambiar de
   versión sin aviso — por eso no se usa aquí.
   - Si para cuando despliegues ya pasó bastante tiempo desde esa fecha de
     verificación, entra a esa misma página y confirma que `gemini-3.5-flash` (o el
     que hayas puesto) sigue vigente antes de irte a producción — los modelos Gemini
     se retiran con relativa frecuencia.
   - Si ya copiaste `firebase-config.example.js` a tu `firebase-config.js` real antes
     de esta corrección y todavía dice `"gemini-flash-latest"`, cambia esa línea a
     `"gemini-3.5-flash"` (o el modelo estable vigente que confirmes en el paso
     anterior) antes de desplegar en serio.
4. **Firebase App Check** — desde el 2 de noviembre de 2026, Google lo exige para que
   cualquier llamada a Firebase AI Logic funcione (antes de esa fecha ya es lo más
   recomendado, pero pasa a ser obligatorio ese día). Sin esto, el chat del Profesor y
   del Ingeniero fallarán silenciosamente aunque todo lo demás esté bien configurado:
   - Firebase Console → **Compilación → App Check** → registra tu app web.
   - Para producción (el sitio ya en tu dominio de Netlify — ver paso 7): elige
     **reCAPTCHA Enterprise** como proveedor (es el que Google recomienda para
     integraciones nuevas y el que ya trae configurado el código; gratis hasta 1 millón
     de llamadas/mes, no requiere plan Blaze). Para generar la site key:
     1. Abre [Google Cloud Console → reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha)
        (mismo proyecto que tu Firebase).
     2. Habilita la API si te lo pide (gratis).
     3. **Crear clave** → tipo **Sitio web** → agrega tu dominio de Netlify
        (`tu-sitio.netlify.app` o el personalizado) y `localhost` si vas a probar local.
        Deja **sin marcar** "usar desafío de casilla de verificación".
     4. Copia la clave de sitio y pégala en la pantalla de App Check de Firebase Console
        donde te la pide, y también en el bloque de inicialización que **ya viene
        incluido** en `firebase-config.example.js` (`initializeAppCheck` +
        `ReCaptchaEnterpriseProvider`) — reemplaza el placeholder
        `"TU_RECAPTCHA_ENTERPRISE_SITE_KEY"`.
     - **Importante**: el proveedor que eliges al registrar la app en Firebase Console
       (paso anterior) y el que usa el código (`ReCaptchaEnterpriseProvider` vs.
       `ReCaptchaV3Provider`) tienen que ser el mismo — si no coinciden, App Check
       rechaza las peticiones en silencio.
   - Para desarrollo local (antes de desplegar, probando en tu máquina): descomenta la
     línea `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;` que ya está en el archivo
     (comentada, justo arriba del bloque de App Check) y pega el token que te da la
     consola del navegador en Firebase Console → App Check → tu app → "Manage debug
     tokens", para no tener que pasar por reCAPTCHA mientras programas.
   - Sin este paso, es la causa más común de "todo se ve bien pero el chat no responde"
     una vez que subes el sitio a un dominio público.

## 7. Desplegar el sitio estático en Netlify
Firebase Hosting **no se usa en este proyecto** — Firebase se queda solo como backend
(Authentication, Firestore, AI Logic). El sitio (`public/`) se publica en Netlify.

1. Sube el proyecto a un repositorio de GitHub (ver paso 9) — Netlify despliega
   conectando el repo, no con un comando de CLI manual.
2. En [Netlify](https://app.netlify.com) → **Add new site → Import an existing
   project** → conecta tu cuenta de GitHub → elige el repositorio.
3. Configuración de build (Netlify debería detectarla sola desde `netlify.toml`, que ya
   viene incluido en la raíz del proyecto — confírmala igual):
   - **Build command**: `rm -rf public/prueba-local` (borra la carpeta de pruebas antes
     de publicar; ver por qué en el paso 8 más abajo).
   - **Publish directory**: `public`.
4. **Deploy site**. Netlify te da un dominio del tipo `algo-al-azar.netlify.app`
   (puedes renombrarlo en Site settings → Domain management, o conectar un dominio
   propio ahí mismo).
5. Desde ahora, cada `git push` a la rama principal redespliega solo — no hace falta
   ningún comando manual para el sitio (a diferencia de `firebase deploy`, que sí había
   que repetir a mano en versiones anteriores de este proyecto).

**Antes de dar el deploy por bueno, verifica dos cosas:**
- Que `public/js/firebase-config.js` ya exista con tus credenciales reales (paso 2) y
  esté commiteado — si no existe, el sitio se sube pero nada de login/Firestore/IA
  funcionará.
- Que `public/prueba-local/` **no sea accesible** en la URL pública de Netlify (ej.
  `https://tu-sitio.netlify.app/prueba-local/admin.html` debe dar 404). El
  `netlify.toml` incluido borra esa carpeta en cada build para garantizarlo — esa
  carpeta permite entrar como "admin" sin autenticación real y es solo para desarrollo.

Después del primer deploy, en Firebase Console → Authentication → **Settings → Authorized
domains**, agrega tu dominio de Netlify (`tu-sitio.netlify.app` o el personalizado) — si
no aparece ahí, el login fallará en producción aunque funcione en local. Repite lo mismo
para el dominio registrado en **App Check** (paso 6): tiene que ser el de Netlify, no uno
de Firebase.

## 8. Archivos de configuración incluidos en este proyecto

`firebase.json` — se usa SOLO para publicar las reglas de Firestore (paso 3), ya no tiene
sección `hosting`:
```json
{
  "firestore": { "rules": "docs/firestore.rules" }
}
```

`netlify.toml` — en la raíz del proyecto, controla el despliegue del sitio estático:
```toml
[build]
  command = "rm -rf public/prueba-local"
  publish = "public"
```
El `command` es la red de seguridad para que, aunque olvides borrar esa carpeta a mano,
nunca quede publicada en el dominio público — Netlify la borra antes de subir el sitio
en cada build.

## 9. Flujo de Git recomendado
```bash
git init
git add .
git commit -m "Versión inicial desplegable"
git branch -M main
git remote add origin <url-de-tu-repo>
git push -u origin main
```
Notas:
- `public/js/firebase-config.js` **sí se commitea** (ver paso 2 — no es secreto).
- No hace falta `.env` ni variables de entorno: no hay build step real de la app, todo es
  estático (el único "build command" es el que borra `prueba-local`, ver paso 8).
- A partir de aquí, conecta el repo en Netlify (paso 7) una sola vez; cada `git push`
  posterior a la rama principal redespliega automáticamente, sin comandos manuales.

## 10. Checklist final antes de dar por "funcional" el sitio en línea
- [ ] `firebase-config.js` con credenciales reales, commiteado y desplegado.
- [ ] Reglas de `docs/firestore.rules` publicadas (paso 3).
- [ ] Tu usuario admin creado, con `rol: "admin"` en Firestore Y con el correo
      confirmado o marcado como verificado a mano (paso 4) — sin esto, el login se
      queda atascado en "confirma tu correo" aunque el rol ya sea admin.
- [ ] Cloudinary configurado en `public/js/cloudinaryConfig.js` (paso 5).
- [ ] AI Logic con proveedor Gemini Developer API, modelo concreto fijado (no el alias
      por defecto sin verificar), y **App Check activo, con la site key generada para tu
      dominio de Netlify** (paso 6).
- [ ] Sitio conectado y desplegado en Netlify, con `netlify.toml` detectado (paso 7).
- [ ] Dominio de Netlify agregado a "Authorized domains" en Firebase Authentication Y en
      App Check (paso 7).
- [ ] `public/prueba-local/` da 404 en la URL pública de Netlify (paso 7 y 8).
- [ ] Probar en la URL real (no en local): registrar un estudiante de prueba, iniciar
      sesión como admin, abrir el chat del Profesor y confirmar que responde (esto valida
      Firebase AI Logic + App Check juntos).
