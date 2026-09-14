# Guía de instalación y despliegue

> Objetivo de este documento: que la versión que subas a Git y despliegues a Firebase
> Hosting quede **configurada y funcional desde el primer despliegue** — no solo que
> "abra", sino que login, Firestore, Cloudinary y los agentes (Gemini vía Firebase AI
> Logic) funcionen realmente en el dominio público. Sigue los pasos en orden.

## 0. Qué necesitas antes de empezar
- Una cuenta de Google (para Firebase Console).
- Una cuenta de Cloudinary (gratuita).
- Node.js instalado en tu máquina (solo para el CLI de Firebase, no para el código de
  la app — la app sigue siendo HTML/JS puro, sin build step).
- Git y una cuenta de GitHub (o el hosting de repos que uses).

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
3. Vuelve a iniciar sesión para que el cambio tome efecto.

## 5. Configurar Cloudinary (certificados, media de clases, recursos de los agentes)
1. Crea una cuenta en [Cloudinary](https://cloudinary.com) → copia tu **Cloud name**
   desde el dashboard.
2. Ve a **Settings → Upload → Upload presets → Add upload preset** → modo
   **Unsigned** (obligatorio, es lo que permite subir directo desde el navegador sin
   backend propio) → guarda y copia el nombre del preset.
3. Ya con la app desplegada y con tu usuario admin, entra al panel admin → sección
   "cloudinary (certificados)" → pega el Cloud name y el nombre del preset → Guardar.
   Esto se guarda en Firestore (`configuracion/cloudinary`), no hace falta tocar código.

## 6. Configurar Firebase AI Logic (Gemini) — el paso que más falla si se salta
Esta es la parte que hace funcionar a los agentes Profesor e Ingeniero. El código ya está
correctamente estructurado sobre el SDK actual (`getAI` + `GoogleAIBackend` +
`getGenerativeModel` desde `firebase-ai.js`, sin las funciones viejas `getVertexAI` de la
versión preview) — lo que falta es la configuración del lado de Firebase Console:

1. Firebase Console → **Compilación → AI Logic** → **Comenzar**.
2. Cuando te pregunte el proveedor de la API, elige **Gemini Developer API** (capa
   gratuita, sin necesidad del plan de pago Blaze) — NO elijas Vertex AI.
3. **Fija un modelo concreto, no el alias por defecto.** El código trae
   `MODELO_GEMINI = "gemini-flash-latest"` en `firebase-config.example.js`. Ese alias es
   real y Google lo va actualizando solo, pero la propia documentación de Google advierte
   que puede apuntar a versiones experimentales con cuota más restringida — no siempre
   apto para producción. Antes de desplegar en serio:
   - Entra a la pestaña de modelos disponibles dentro de AI Logic en Firebase Console.
   - Copia el nombre exacto del modelo Flash **estable** más reciente (a la fecha de esta
     guía, la familia vigente es Gemini 3.x — verifica el nombre exacto vigente ahí
     mismo, no lo copies de un tutorial viejo).
   - Reemplaza el valor de `MODELO_GEMINI` en tu `firebase-config.js` real por ese nombre
     concreto (ej. `"gemini-3-flash"` — confirma el nombre real en la consola, este es
     solo un ejemplo de formato).
4. **Firebase App Check es obligatorio** (Google lo exige desde julio de 2026 para que
   cualquier llamada a Firebase AI Logic funcione — sin esto, el chat del Profesor y del
   Ingeniero fallarán silenciosamente aunque todo lo demás esté bien configurado):
   - Firebase Console → **Compilación → App Check** → registra tu app web.
   - Para producción (el sitio ya en tu dominio de Hosting): elige **reCAPTCHA
     Enterprise** o **reCAPTCHA v3** como proveedor, sigue el asistente para generar la
     site key, y agrégala a la inicialización de App Check en `firebase-config.js`
     (`import { initializeAppCheck, ReCaptchaV3Provider } from ".../firebase-app-check.js"`
     — este bloque no viene aún en el scaffold, agrégalo en este paso siguiendo el
     asistente de Firebase Console, que te da el snippet exacto para tu proyecto).
   - Para desarrollo local (antes de desplegar, probando en tu máquina): activa el
     **modo debug de App Check** y usa el token de depuración que te da la consola, para
     no tener que pasar por reCAPTCHA mientras programas.
   - Sin este paso, es la causa más común de "todo se ve bien pero el chat no responde"
     una vez que subes el sitio a un dominio público.

## 7. Configurar Firebase Hosting y desplegar
Este proyecto ya incluye `firebase.json` y `.firebaserc.example` en la raíz (ver sección
siguiente si necesitas recrearlos). Pasos:
```bash
firebase deploy --only hosting
```
Esto sube el contenido de `public/` a tu URL `tu-proyecto.web.app` (o tu dominio propio si
lo conectas en Hosting → Agregar dominio personalizado).

**Antes de este paso, verifica dos cosas:**
- Que `public/js/firebase-config.js` ya exista con tus credenciales reales (paso 2) — si
  no existe, el sitio se sube pero nada de login/Firestore/IA funcionará.
- Que la carpeta `public/prueba-local/` NO se publique — `firebase.json` ya la excluye
  por defecto (ver `"ignore"` en la sección 8), pero si la modificaste, confírmalo. Esa
  carpeta permite entrar como "admin" sin autenticación real y es solo para desarrollo.

Después del primer deploy, en Firebase Console → Authentication → **Settings → Authorized
domains**, confirma que tu dominio de Hosting (`tu-proyecto.web.app` o el personalizado)
aparezca en la lista — si no aparece, el login fallará en producción aunque funcione en
local.

## 8. `firebase.json` incluido en este proyecto
```json
{
  "firestore": { "rules": "docs/firestore.rules" },
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "prueba-local/**"],
    "rewrites": []
  }
}
```
El campo `"ignore": ["prueba-local/**"]` es la red de seguridad para que, aunque olvides
borrar esa carpeta, `firebase deploy` nunca la publique al dominio público.

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
- No hace falta `.env` ni variables de entorno: no hay build step, todo es estático.
- Cada vez que quieras actualizar el sitio en vivo tras un `git push`, corre de nuevo
  `firebase deploy --only hosting` (Firebase Hosting no redespliega solo con el push a
  Git a menos que configures GitHub Actions — fuera de alcance de este MVP; hazlo cuando
  lo pidas).

## 10. Checklist final antes de dar por "funcional" el sitio en línea
- [ ] `firebase-config.js` con credenciales reales, commiteado y desplegado.
- [ ] Reglas de `docs/firestore.rules` publicadas (paso 3).
- [ ] Tu usuario admin creado y con `rol: "admin"` en Firestore (paso 4).
- [ ] Cloudinary configurado desde el panel admin (paso 5).
- [ ] AI Logic con proveedor Gemini Developer API, modelo concreto fijado (no el alias
      por defecto sin verificar), y **App Check activo** (paso 6).
- [ ] Dominio de Hosting agregado a "Authorized domains" en Authentication (paso 7).
- [ ] `public/prueba-local/` no visible en la URL pública (paso 7 y 8).
- [ ] Probar en la URL real (no en local): registrar un estudiante de prueba, iniciar
      sesión como admin, abrir el chat del Profesor y confirmar que responde (esto valida
      Firebase AI Logic + App Check juntos).
