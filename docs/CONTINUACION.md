# Guía de continuación — Plataforma Educativa IA

> Este documento es para que cualquier sesión futura de Claude (o el usuario) entienda
> exactamente en qué punto está el proyecto y pueda seguir sin repetir preguntas ya
> respondidas. Léelo completo antes de tocar código.

## 1. Qué es el proyecto

Plataforma web educativa de desarrollo web full stack, administrada por dos agentes de IA:

- **Profesor**: diseña clases, prepara tareas, genera evaluaciones de selección múltiple
  en tiempo real, califica a los estudiantes y decide (según reglas auditables, no
  arbitrariamente) cuándo un estudiante está "capacitado" para recibir certificado.
- **Ingeniero**: es quien tiene la capacidad de crear/modificar/editar herramientas de
  evaluación que el Profesor solicite. El Profesor NUNCA edita código ni estructura de
  datos directamente — solo pide, mediante una solicitud estructurada (ver
  `contrato-agentes.md`).

Los dos agentes negocian: el Ingeniero responde con **aceptado / alternativa / rechazado
con razón técnica**. Máximo 2-3 rondas de negociación; si no hay acuerdo, se escala al
administrador humano (el usuario).

## 2. Decisiones ya tomadas (NO volver a preguntar esto)

- **Stack**: HTML + CSS + JS puro (sin framework de frontend). Firebase para
  autenticación y datos (Firestore). Cloudinary para imágenes y videos.
- **Hosting (desde v14): Netlify, NO Firebase Hosting.** Firebase se queda exclusivamente
  como backend de datos/IA (Auth + Firestore + AI Logic) — el sitio estático
  (HTML/CSS/JS) se despliega y sirve desde Netlify. Ver sección 2.2 para el detalle de
  esta decisión y sus consecuencias en la configuración.
- **Motor de IA de los agentes**: Gemini, vía **Firebase AI Logic** (antes "Vertex AI in
  Firebase"), usando el proveedor **Gemini Developer API** (capa gratuita, sin plan de
  facturación Blaze). Se llama directo desde el cliente web con el SDK JS — Firebase AI
  Logic protege la API key mediante su proxy, así que NO se necesita una Cloud Function
  solo para ocultar la key.
  - Firebase App Check es obligatorio (desde julio 2026) para que las llamadas al SDK
    sean válidas. Configurar modo debug para desarrollo local.
  - El nombre del modelo Gemini a usar debe verificarse en la documentación vigente al
    momento de programar (varios modelos se han retirado durante 2026); no hardcodear un
    modelo viejo copiado de un tutorial.
- **El Ingeniero NO edita código real de la app en producción.** Genera contenido
  estructurado (JSON) en Firestore que la interfaz ya construida sabe interpretar y
  renderizar dinámicamente (tipos de reto: quiz, reto_codigo, etc.). Esto evita que un
  agente rompa la aplicación.
- **Ejecución de código de estudiantes**: por ahora NO se implementa un sandbox de
  ejecución real (sería lo más riesgoso/caro). Se empieza solo con evaluaciones de
  selección múltiple y retos autoevaluados por rúbrica del LLM. Si más adelante se
  quiere ejecutar código real, la opción es un servicio externo (Judge0/Piston) llamado
  desde una Cloud Function — pendiente, no implementado.
- **Suscripción de cada estudiante**: es SOLO un estado de inscripción activa
  (`activa` / `inactiva` / `pausada`), **sin cobros ni pagos de por medio**. Sirve para
  controlar si al estudiante se le sigue generando record/progreso.
- **Donaciones**: en vez de pagos, hay un botón/enlace de donación vía PayPal,
  configurable por el administrador desde el panel admin (guardado en Firestore, no
  hardcodeado). La donación está totalmente desligada del acceso del estudiante — no
  condiciona nada, es solo un botón informativo tipo "Apóyanos". No se implementan
  webhooks de PayPal por ahora (quedaría para una fase futura si se pide).
- **Certificados**: el administrador humano los genera manualmente desde el panel admin,
  una vez el Profesor determina (según reglas auditables) que el estudiante está
  capacitado. El PDF se sube a Cloudinary.
- **Modo de trabajo pedido por el usuario**: Claude debe encargarse de todo el desarrollo
  de forma autónoma, consultando solo cuando sea estrictamente necesario (decisiones que
  cambian arquitectura o alcance, no detalles de implementación). Después de cada avance
  pequeño, generar un ZIP con todo el proyecto + esta guía actualizada, para no perder
  información si se agotan los tokens de la sesión.

## 2.2 Migración de hosting a Netlify + panel de configuración del sitio (desde v14)

El usuario preguntó por un posible "agente de diseño" que pudiera editar directamente el
código de la página (HTML/CSS/JS) y hacer commits a Git para redesplegar. Se descartó
esa idea por seguridad: a diferencia del Ingeniero (que solo genera JSON de contenido
validado por tipos conocidos, `TIPOS_PERMITIDOS`, y por lo tanto no puede romper la app),
un agente con permiso de escribir código real y hacer `push` a la rama de producción sí
podría tumbar el sitio con un solo error, y requeriría un token de Git con permisos de
escritura que nunca puede vivir en el cliente (necesitaría backend propio, saliéndose del
esquema "sin servidor / sin plan de pago" ya decidido). **No se construye ese agente.**

En su lugar se acordó lo siguiente:

- **Hosting pasa de Firebase Hosting a Netlify.** Firebase se mantiene SOLO para
  Authentication, Firestore y Firebase AI Logic (Gemini) — nada de esto cambia. Lo único
  que cambia es dónde vive el HTML/CSS/JS estático.
- Consecuencias prácticas de este cambio (pendientes de aplicar en `docs/INSTALACION.md`
  y `firebase.json` en una próxima sesión de código):
  - `firebase.json` deja de necesitar la sección `hosting`; se conserva solo para
    desplegar `firestore.rules` (`firebase deploy --only firestore:rules`).
  - El dominio real del sitio pasa a ser el de Netlify (ej. `algo.netlify.app` o un
    dominio propio conectado ahí) — ese dominio, NO el de Firebase Hosting, es el que hay
    que agregar a "Authorized domains" en Firebase Authentication y en Firebase App
    Check, o el login y las llamadas a Gemini fallarán en producción.
  - El despliegue pasa a ser el flujo normal de Netlify: conectar el repo de GitHub y
    dejar que Netlify redepliegue solo con cada push a la rama principal (sin necesidad
    de comando manual de Firebase CLI para el sitio).
  - `public/prueba-local/` se sigue excluyendo del despliegue (ahora vía configuración de
    Netlify — `_redirects`/`netlify.toml` con ignore de esa carpeta, o simplemente no
    referenciada desde el sitio real — en vez de la exclusión que antes vivía en
    `firebase.json`).
- **En vez del agente de diseño, se construirá un panel de configuración del sitio**
  dentro de `admin/dashboard.html` para que el propio administrador (tú) edite, sin
  tocar código:
  - **Nombre de la página** (título del sitio, usado donde hoy hay texto fijo tipo
    "Academia..." en los HTML).
  - **Anuncios**: un espacio para agregar/editar/quitar anuncios (texto y opcionalmente
    imagen vía Cloudinary, igual que las clases) que se muestren en el sitio — mecanismo
    concreto de dónde se listan (banner en dashboard del estudiante, etc.) a definir
    cuando se construya.
  - **Pie de página**: texto editable (ej. datos de contacto, redes, aviso legal) que
    reemplaza cualquier pie fijo hardcodeado.
  - Todo esto se guarda en un documento único de Firestore (ej. `configuracion/sitio`),
    igual de sencillo que el enlace de PayPal que ya se configura hoy desde el panel
    admin — es el mismo patrón ya probado, solo con más campos.
  - **Pendiente, no implementado todavía**: esta sección quedó decidida en esta sesión
    pero el código del panel y la lectura de `configuracion/sitio` en las páginas
    públicas aún no se construyó. Es el siguiente punto de roadmap (ver sección 3).

## 3.7 Revisión general de seguridad y correcciones (v15)

El usuario pidió una revisión general del código en busca de fallos, con prioridad en
todo lo que pudiera comprometer la seguridad. Se encontraron y corrigieron:

1. **XSS almacenado (crítico) en el panel admin**: `d.nombre` (elegido libremente por
   cualquiera al registrarse) se insertaba sin escapar vía `innerHTML` en
   `admin/dashboard.js` → cualquier persona podía registrarse con un nombre tipo
   `<img src=x onerror=...>` y ejecutar JS en la sesión del ADMIN la próxima vez que
   abriera el listado de estudiantes. Corregido con una función `escapeHtml()` aplicada
   a `d.nombre` y, por defensa en profundidad, también a `respuestaIngeniero.detalle`.
2. **Fuga del banco de respuestas correctas (crítico)**: `docs/firestore.rules` dejaba
   `plantillas_clase`/`plantillas_evaluacion` con `allow read: if request.auth != null`.
   Cualquier estudiante autenticado podía, desde la consola del navegador, leer la
   colección completa — incluida `respuestaCorrectaIndex` de TODOS los quizzes ya
   generados, no solo del que estuviera resolviendo. Corregido a `allow read: if
   esAdmin()` en ambas colecciones (solo el navegador del admin necesita leerlas).
3. **Reutilización de plantillas por substring**: `buscarPlantilla()` podía confundir
   "CSS" con "CSS Grid" (coincidencia por `.includes()` en ambos sentidos). Ahora exige
   coincidencia EXACTA del texto normalizado, consultando con `where("temaNormalizado",
   "==", ...)` en vez de traer la colección completa — corrige el falso positivo Y el
   costo creciente de lecturas de Firestore en el mismo cambio.
4. **Firebase App Check nunca se escribió en código**, solo se documentaba en
   `INSTALACION.md`. Se agregó la inicialización real (`initializeAppCheck` +
   `ReCaptchaV3Provider`) en `firebase-config.example.js`, con instrucciones inline de
   qué reemplazar antes de desplegar.
5. **Estado `"alternativa"` del contrato Profesor↔Ingeniero**: estaba documentado pero
   `agente-profesor.js` trataba cualquier estado distinto de `"aceptado"` como escalado,
   descartando un `"alternativa"` con contenido válido. Ahora `solicitarClase`/
   `solicitarQuiz` aceptan y guardan tanto `"aceptado"` como `"alternativa"` (siempre que
   traiga `resultado`); solo `"rechazado"` sigue consumiendo rondas de negociación.
6. **`docs/contrato-agentes.md` no incluía `"clase"`** en la lista de tipos permitidos,
   aunque el código (`TIPOS_PERMITIDOS`) sí la soporta desde v9. Sincronizado.

**Nueva regla de negocio pedida en esta sesión**: el registro de estudiantes ahora exige
correo `@gmail.com` o `@outlook.com`. Se aplicó en dos capas:
- `auth.js` (cliente): valida el dominio antes de llamar a `createUserWithEmailAndPassword`
  y muestra un error claro si no cumple. Esto es solo para dar buen feedback — un cliente
  modificado podría saltárselo.
- `docs/firestore.rules` (real protección): la función `correoPermitido()` exige que
  `email` termine en uno de esos dos dominios para poder **crear** el documento
  `usuarios/{uid}` propio. Esto SÍ protege de verdad porque corre en el servidor de
  Firestore — un cliente modificado no puede saltárselo. La cuenta de Firebase
  Authentication en sí podría llegar a crearse igual con otro correo si alguien llama a
  la API directamente sin pasar por el formulario, pero sin el documento en `usuarios/`
  esa cuenta no puede usar la app (todas las pantallas dependen de leer ese documento).
  El admin (regla `allow write: if esAdmin()`) no tiene esta restricción, por si necesita
  crear/editar manualmente un usuario con otro correo.

**No se tocó** (documentado como limitación aceptada, sin backend no tiene arreglo
completo): la calificación sigue corriendo del lado del cliente — ver sección 3.2, sigue
vigente igual que antes de esta revisión.

## 3.8 Confirmación de correo, filtro de nombres y correcciones encontradas al implementarlas (v16)

El usuario pidió dos reglas de negocio nuevas: que el estudiante confirme su cuenta
desde el correo antes de poder usarla, y un filtro de nombres (reservados + ofensivos)
al registrarse. Al revisar el código real para implementarlas (no solo lo que decía la
sección 3.7 de la entrega anterior) aparecieron dos correcciones adicionales.

**1) Confirmación de correo**
- `auth.js`: al registrarse se llama a `sendEmailVerification()` justo después de crear
  la cuenta. **No** se cierra la sesión de inmediato (a diferencia de lo planteado
  inicialmente en el chat) — se mantiene abierta solo para que el botón "Reenviar
  correo" tenga un `auth.currentUser` válido; el estudiante sigue sin poder llegar al
  dashboard porque no se le redirige y las pantallas protegidas lo bloquean igual (ver
  siguiente punto).
- En "Entrar", si `cred.user.emailVerified` es `false`, no se redirige al dashboard: se
  muestra el panel "confirma tu correo" (mismo panel que tras registrarse) con botón de
  reenviar.
- Nuevo módulo `js/verificacion-correo.js` (`exigirCorreoVerificado()`), integrado en
  los 4 puntos de entrada que ya verificaban rol: `admin/dashboard.js`, `admin/chat.js`,
  `admin/chat-ingeniero.js` y `estudiante/dashboard.js`. Si alguien llega directo a una
  de esas URLs autenticado pero sin correo verificado, se cierra la sesión (para que
  quede fuera de verdad) y se le redirige a `index.html?verificar=1`, que muestra un
  aviso en la pestaña "Entrar" pidiéndole iniciar sesión de nuevo (ahí sí puede
  reenviar, porque esa sesión sí queda activa).
- `docs/firestore.rules`: `usuarios/{uid}` ahora exige `correoVerificado()` (claim
  `request.auth.token.email_verified`) para el `allow update` del propio dueño — un
  estudiante sin correo confirmado no puede escribir ni su propio `progreso` aunque
  escriba directo a Firestore saltándose la app. El admin (`allow write`) no tiene esta
  restricción.
- **Actualización (mismo día, a pedido del usuario)**: se cerró también
  `resultados/{resultadoId}` — `allow create` ahora exige `correoVerificado()` además
  de `request.auth.uid == uid`, mismo patrón que `usuarios/{uid}`. Ya no queda ninguna
  colección donde un estudiante sin correo confirmado pueda escribir algo propio.

**2) Filtro de nombres**
- Nuevo módulo `js/filtro-nombres.js` (`nombrePermitido()`): bloquea nombres reservados
  que podrían suplantar un rol del sistema (`admin`, `profesor`, `soporte`, etc.) y una
  lista base de palabras ofensivas comunes en español — sin insultos graves ni términos
  discriminatorios, es un filtro básico, no un sistema de moderación completo.
- Aplicado en `auth.js` (mensaje de error claro) y reforzado con la misma lista en
  `docs/firestore.rules` (`nombrePermitido()`, usada en el `allow create` de
  `usuarios/{uid}`) — la del cliente no protege por sí sola.

**3) Hallazgo adicional: escape incompleto en el campo "notas" del perfil de enseñanza**
- `admin/dashboard.js` insertaba `estilo.notas` en un atributo `value="..."` con un
  escape casero que solo reemplazaba comillas dobles (`.replace(/"/g, "&quot;")`).
  Ese campo lo puede escribir el propio estudiante directo en Firestore (las reglas
  permiten que el dueño edite su `progreso`, y `estiloEnsenanza.notas` vive ahí),
  saltándose la UI que en teoría solo lo deja editar al admin. Se reemplazó por
  `escapeAtributo()`, que escapa `&`, `"`, `<`, `>` y `'` en ese orden — el escape
  genérico `escapeHtml()` que ya existía (pensado para `innerHTML` de texto) no sirve
  aquí porque no escapa comillas, que es justo el carácter que importa dentro de un
  atributo.

**4) Hallazgo adicional: `.oculto` solo ocultaba formularios, no paneles**
- La regla CSS era `.form-acceso.oculto{ display:none; }`. Los paneles
  `#panel-clase`/`#panel-quiz` del dashboard del estudiante (y su equivalente en
  `prueba-local/estudiante.html`) usan la clase `acceso-panel oculto`, no
  `form-acceso oculto`, así que esa regla nunca les aplicaba: quedaban visibles y
  vacíos desde que cargaba la página, aunque el JS les agregara la clase `oculto`
  esperando ocultarlos. Se generalizó a `.oculto{ display:none; }`, que también es la
  que ahora usa el nuevo panel `#panel-verificar` en `index.html`.

**Corrección a la sección 3.7**: el punto 6 de esa sección decía que
`docs/contrato-agentes.md` ya incluía `"clase"` como tipo permitido ("Sincronizado").
Al revisar el código real de esta entrega, la línea del ejemplo JSON (línea 17) seguía
sin incluirlo — quedó corregida ahora. Queda como recordatorio de por qué esta sección
siempre revisa el código real y no solo confía en la entrega anterior.

## 3. Qué falta por resolver / construir (roadmap)

Marca con [x] lo que ya esté hecho en el ZIP actual.

- [x] Esquema completo de colecciones Firestore (`docs/firestore-schema.md`)
- [x] Reglas de seguridad de Firestore (`docs/firestore.rules`)
- [x] Contrato de solicitud Profesor → Ingeniero (`docs/contrato-agentes.md`)
- [x] Scaffold HTML/CSS/JS: login/registro (Firebase Auth) — `public/index.html`,
      `public/js/auth.js`, `public/css/style.css`
- [x] Scaffold dashboard estudiante (básico: saluda, muestra estado de suscripción;
      falta listado de módulos/evaluaciones) — `public/estudiante/dashboard.html`
- [x] Scaffold dashboard admin (básico: config de enlace PayPal funcional con
      Firestore; falta listado de estudiantes/certificados) — `public/admin/dashboard.html`
- [x] Integración real de Firebase AI Logic (llamadas a Gemini desde el cliente) —
      `public/js/firebase-config.example.js` (usa Gemini Developer API, modelo
      "gemini-flash-latest", verificar vigencia antes de desplegar)
- [x] Lógica del agente Profesor (generación de clases/evaluaciones, calificación) —
      `public/js/agente-profesor.js`
- [x] Lógica del agente Ingeniero (recibe solicitudes, genera JSON de herramientas) —
      `public/js/agente-ingeniero.js`
- [x] Lógica de negociación entre ambos agentes + límite de rondas + escalamiento a admin
      (dentro de `agente-profesor.js`, función `solicitarQuiz`, MAX_RONDAS = 3)
- [x] Botón de prueba en el panel admin para generar un quiz vía el agente Profesor
      (`public/admin/dashboard.html` + `dashboard.js`)
- [x] Generación de certificado (PDF con jsPDF) y subida a Cloudinary (unsigned upload) —
      `public/js/certificados.js`, botón en panel admin junto a cada estudiante
      capacitado (solo se habilita si `progreso.capacitado === true`)
- [x] Botón/config de donación PayPal (ya estaba)
- [ ] Config real de Firebase Y de Cloudinary (el usuario debe pegar sus credenciales
      reales y crear un "unsigned upload preset" en Cloudinary — nunca inventarlas).
      Guía completa paso a paso: `docs/INSTALACION.md`.
- [x] Listado de estudiantes/puntuaciones en panel admin (`public/admin/dashboard.html`)
- [x] UI de estudiante para RESOLVER el quiz — `public/estudiante/dashboard.html` +
      `dashboard.js`: lista evaluaciones disponibles, renderiza el quiz con
      `prepararPreguntasParaEstudiante` (nunca expone la respuesta correcta en el DOM),
      envía con `calificarIntento` y muestra puntaje + si ya está "capacitado"
- [x] Vista del historial de `solicitudes_agente` en el panel admin (auditoría) —
      últimas 20 negociaciones, con tipo/módulo/ronda/estado (resuelto o escalado)
- [x] Generación de clases (no solo quizzes) — `solicitarClase()` en
      `agente-profesor.js` (mismo patrón de negociación que `solicitarQuiz`), guarda
      en el array `clases` de `modulos/{moduloId}` (crea el módulo si no existe);
      tipo "clase" agregado a `TIPOS_PERMITIDOS` del Ingeniero
- [x] UI de estudiante para VER las clases generadas — `public/estudiante/dashboard.html`
      + `dashboard.js`: lista todas las clases de todos los módulos, al hacer clic
      muestra título, contenido y la imagen/video adjunto si existe
- [x] Subida de imágenes/videos de clases a Cloudinary — `public/js/media.js`
      (`adjuntarMediaAClase`), formulario en panel admin ("adjuntar a la clase",
      usa la misma config de Cloudinary que los certificados). El admin debe copiar
      el ID de clase que se muestra al generarla para adjuntarle media después.
- [ ] Migrar `docs/INSTALACION.md` / `firebase.json` para reflejar hosting en Netlify
      en vez de Firebase Hosting (ver decisión completa en sección 2.2).
- [ ] Panel de configuración del sitio en `admin/dashboard.html`: nombre de la página,
      anuncios, pie de página — guardado en `configuracion/sitio` de Firestore, leído
      por las páginas públicas (ver sección 2.2). Reemplaza la idea descartada de un
      "agente de diseño" que editara código directamente.

## 2.1 Cambio de arquitectura: el Profesor conversa y decide por sí mismo (desde v9)

El usuario pidió poder hablarle al Profesor como a un profesor real (no solo llenar
formularios de "moduloId" + "tema"), que el propio Profesor decida la metodología y
genere clases/quizzes por su cuenta, que pueda investigar información, y que "al subir
a un hosting" empiece a trabajar solo. Como el usuario NO tiene presupuesto para plan
de pago (Blaze) ni Cloud Functions programadas, se acordó explícitamente esta versión
gratuita del comportamiento: el Profesor se "activa" la PRIMERA VEZ que alguien abre
`admin/chat.html` (no hay nada corriendo en segundo plano sin que alguien tenga la
pestaña abierta), y desde ahí es el propio modelo — vía **function calling** de
Gemini — quien decide cuándo llamar a `crear_clase` / `crear_quiz`, en vez de que el
admin dispare formularios módulo por módulo. Si el Profesor necesita generar muchas
cosas seguidas, su instrucción de sistema le pide explícitamente que le avise al admin
cuántos pasos tomará y que le pida quedarse conectado — así se cumple lo que el usuario
aceptó en vez de prometer automatización real en segundo plano que costaría dinero.

- `public/js/chat-profesor.js`: define las funciones que el modelo puede llamar
  (`crear_clase`, `crear_quiz`), la instrucción de sistema (persona del Profesor,
  reglas de negocio, límite técnico de "solo funciono con la pestaña abierta"), el
  loop que resuelve automáticamente las function calls del modelo (máx. 8 pasos por
  mensaje, para no gastar de más), y `investigarTema()` con **Grounding de Google
  Search** (`tools: [{ googleSearch: {} }]`) para que el Profesor busque información
  vigente antes de diseñar contenido — en un modelo APARTE del de function calling,
  porque combinar ambos tipos de tool en la misma llamada no siempre es compatible
  (revisar documentación vigente si se quiere intentar combinarlos más adelante).
- `public/admin/chat.html` + `chat.js`: la UI de chat. Al abrirse, si `modulos` está
  vacío en Firestore, le manda automáticamente un primer mensaje al Profesor pidiéndole
  que se presente y proponga cómo arrancar — esto es el "arranque automático al
  desplegar" que sí es posible sin pagar nada (se activa con la primera visita, no
  antes). Tiene un botón "Pedir que investigue un tema" que usa `investigarTema()`.
- **LIMITACIÓN A VERIFICAR ANTES DE USAR EN PRODUCCIÓN**: Grounding con Google Search
  puede tener límites de cuota o coste distintos a las llamadas normales de Gemini
  incluso en la capa gratuita — no se confirmó el detalle exacto de precios/cuota al
  momento de escribir esto. Revisar la documentación de Firebase AI Logic sobre
  Grounding with Google Search antes de depender de esa función con muchos usuarios.
- Equivalente en modo de prueba local: `public/prueba-local/chat.html` +
  `js/chat.js` + `js/chat-local.js` — SIN Gemini real, reconoce intención con
  expresiones regulares simples ("crea una clase sobre X", "crea un quiz sobre X",
  "adelante" para disparar un programa de 2 módulos de ejemplo), para poder ver el
  mismo comportamiento conversacional antes de conectar credenciales.
- El panel admin (`dashboard.html`, real y de prueba) ahora tiene un enlace
  "💬 Hablar con el Profesor" que lleva a esta pantalla de chat. Los formularios viejos
  de "Generar clase" / "Generar quiz" en el dashboard SIGUEN funcionando (no se
  quitaron) — quedan como vía alterna directa si el admin prefiere no conversar.

## 3.0 Modo de prueba local (public/prueba-local/) — SOLO PARA EVALUAR, NUNCA DESPLEGAR

Se agregó una carpeta separada, `public/prueba-local/`, para poder correr el proyecto
con VSCode (extensión "Live Server" o cualquier servidor estático) y ver el
comportamiento de los agentes SIN tener credenciales de Firebase/Cloudinary todavía.

- **No usa Firebase.** `js/db-local.js` simula Firestore guardando todo en
  `localStorage` del navegador (clave `academia_prueba_db_v1`), con dos usuarios ya
  creados: `admin-prueba` y `estudiante-prueba`.
- **No llama a Gemini.** `js/agente-ingeniero-local.js` tiene el MISMO contrato
  (tipos permitidos, forma de respuesta) que el Ingeniero real, pero genera contenido
  de ejemplo con plantillas de texto en vez de llamar a la IA — así se puede probar el
  flujo de negociación, la generación de clases/quizzes, la calificación y el
  certificado sin ninguna clave configurada.
- `js/agente-profesor-local.js` replica la lógica real (negociación máx. 3 rondas,
  umbral de 80% para "capacitado") pero contra la BD simulada.
- `admin.html`: mismos formularios de generar clase/quiz, historial de negociación, y
  listado de estudiantes con botón de certificado — el PDF se descarga directo
  (jsPDF `.save()`), sin subir a Cloudinary.
- `estudiante.html`: mismo flujo de leer clases y resolver quizzes que la versión real.
- `index.html` (dentro de prueba-local): pantalla con dos botones — "Entrar como
  estudiante de prueba" / "Entrar como administrador de prueba" — sin formulario de
  login real, y un botón para reiniciar los datos de prueba.

**Cómo correrlo**: abrir la carpeta del proyecto en VSCode, clic derecho sobre
`public/prueba-local/index.html` → "Open with Live Server" (o cualquier servidor
estático — no sirve abrir el archivo directo con `file://` porque los `import`
de ES modules lo bloquean). Todo funciona sin conexión a internet ni credenciales.

**IMPORTANTE — antes de desplegar a producción**: `public/index.html` (el login real)
tiene un enlace en el pie a `prueba-local/index.html` ("Modo de prueba local"). Ese
enlace y toda la carpeta `public/prueba-local/` deben eliminarse (o al menos no
subirse a hosting público) antes de publicar el sitio real, porque permite entrar
como "admin" sin ninguna autenticación. Es solo una herramienta de desarrollo.

## 3.4 Recursos por agente + chat del Ingeniero + plantillas reutilizables (desde v10)

El usuario pidió tres cosas en la misma sesión:

1. **Un "casillero" de recursos por agente** — no es una carpeta del sistema operativo
   (una app web no puede leer el disco del usuario), es un área de subida equivalente:
   `public/js/recursos.js` (`subirRecurso`, `listarRecursos`, `resumenRecursosParaPrompt`).
   Sube a Cloudinary + guarda en Firestore (`recursos/{id}`, campo `agente`). Cada chat
   (Profesor e Ingeniero) inyecta un resumen de sus propios recursos en la instrucción de
   sistema al abrirse, y también se le avisa dentro de la conversación en el momento en
   que se sube uno nuevo (no solo queda guardado silenciosamente en Firestore).
   Formularios de subida: sección "recursos para el Profesor" en `admin/chat.html`,
   sección "recursos para el Ingeniero" en `admin/chat-ingeniero.html`.
2. **Chat propio para el Ingeniero** — `admin/chat-ingeniero.html` + `chat-ingeniero.js`
   (UI) + `public/js/chat-ingeniero.js` (lógica). A propósito NO tiene function calling
   (a diferencia del Profesor): es un canal conversacional para que el admin le consulte
   viabilidad técnica/arquitectura, NO una forma de saltarse el contrato Profesor→Ingeniero
   para generar contenido. El Ingeniero solo construye herramientas pedagógicas cuando el
   Profesor se lo pide vía `docs/contrato-agentes.md`, igual que antes.
3. **Trabajo reutilizable entre sesiones** (plantillas + perfil de enseñanza por
   estudiante) — el usuario aclaró que ya sabía que las clases/quizzes se guardaban
   permanentemente en Firestore (eso ya existía desde antes); lo que pedía es que el
   Profesor sea más RÁPIDO con el tiempo, reutilizando lo ya construido en vez de volver
   a generarlo desde cero cada vez que se repite un tema. Implementado en
   `public/js/plantillas.js` + cambios en `solicitarClase`/`solicitarQuiz` de
   `agente-profesor.js` (ver sección "Reutilización de plantillas" en
   `docs/contrato-agentes.md` para el flujo completo). Decisiones confirmadas por el
   usuario:
   - Si ya existe una plantilla para el tema, se reutiliza automáticamente; solo se
     adapta si el perfil de enseñanza del estudiante (`estiloEnsenanza`) pide algo
     distinto al estándar.
   - El perfil de enseñanza vive dentro de `usuarios/{uid}.progreso.estiloEnsenanza`
     (no en una colección aparte). Funciones: `obtenerPerfilEnsenanza(uid)` /
     `actualizarPerfilEnsenanza(uid, { ritmo, notas })` en `agente-profesor.js`.
   - **Pendiente de conectar a UI**: hoy `estiloEnsenanza` se puede leer/escribir por
     código, pero no hay todavía un botón en el panel admin ni en el chat del Profesor
     para que el admin (o el propio Profesor conversando) lo edite para un estudiante
     puntual. Construir esa UI si el usuario lo pide.
   - **Pendiente**: `public/prueba-local/` (modo sin Firebase) NO se actualizó con
     plantillas/recursos/chat-ingeniero — sigue reflejando el comportamiento anterior a
     v10. Actualizar si el usuario quiere seguir probando ahí antes de tener credenciales.

**Aclaración de arquitectura respondida en esta sesión**: el usuario preguntó por
Cloudflare Workers. No se usa en este proyecto — la arquitectura sigue siendo 100%
cliente (sin servidor propio), por decisión explícita de no requerir plan de pago.
Cloudflare Workers quedó anotado como una alternativa gratuita posible a futuro para
resolver la limitación de seguridad de "calificación client-side" (sección 3.2) sin
necesitar el plan Blaze de Firebase — no implementado, solo mencionado si se retoma esa
limitación más adelante.

## 3.5 Guía de instalación/despliegue consolidada (v11)

Se creó `docs/INSTALACION.md` con el flujo completo Git → Hosting, más los archivos que
lo soportan en la raíz del proyecto: `firebase.json` (reglas de Firestore + Hosting,
excluye `prueba-local/` del deploy automáticamente), `.firebaserc.example` (plantilla —
el usuario copia a `.firebaserc` con su ID real de proyecto, ese archivo se ignora en
Git porque es específico de cada quien) y `.gitignore` (deja claro que
`firebase-config.js` SÍ se commitea a propósito, no es un secreto). Cubre puntos que
antes solo se mencionaban sueltos en distintas partes de este documento: fijar un modelo
Gemini concreto en vez del alias `-latest` sin verificar, activar Firebase App Check
(paso que más falla si se salta), y agregar el dominio de Hosting a "Authorized domains"
de Authentication. No cambia nada del código de la app, solo consolida la puesta en
producción.

## 3.6 UI del perfil de enseñanza por estudiante (v12)

Se conectó a la interfaz lo que en v10 solo existía por código
(`obtenerPerfilEnsenanza`/`actualizarPerfilEnsenanza` en `agente-profesor.js`). En el
panel admin, cada estudiante de la lista tiene un botón "🎯 Perfil de enseñanza" que
despliega un panel con `ritmo` (estándar/lento/acelerado) y `notas` libres — se guarda en
`usuarios/{uid}.progreso.estiloEnsenanza` (`public/admin/dashboard.js`,
`cargarEstudiantes`). Es lo que `solicitarClase`/`solicitarQuiz` consultan (cuando se les
pasa `perfilEstudiante`) para decidir si reutilizar la plantilla tal cual o adaptarla.

**DECIDIDO (no pendiente) — el Profesor NO genera contenido por estudiante**: por
costo/complejidad, se confirmó que el flujo de negociación Profesor↔Ingeniero
(`solicitarClase(moduloId, tema)` / `solicitarQuiz(...)`) sigue operando a nivel de
MÓDULO/TEMA, genérico y compartido por todos los estudiantes — no una versión distinta
por cada uno. Esto es lo que ya hacía por defecto y se deja así intencionalmente:

- Las plantillas reutilizables (v10) siguen ahorrando lo importante: la primera vez que
  sale un tema se gasta una llamada a Gemini; después, cualquier otro módulo/estudiante
  que necesite ese mismo tema reutiliza la plantilla sin gastar nada más.
- El perfil de enseñanza (`estiloEnsenanza`: ritmo/notas) que se guarda desde el panel
  admin (sección UI descrita arriba) queda como información de REFERENCIA — para el
  admin y para cuando se conversa con el Profesor (ej. "a Juan le cuesta CSS, ¿cómo lo
  reforzarías?") — pero NO dispara una generación de contenido aparte por estudiante.
  Así se evita multiplicar llamadas a Gemini por cada estudiante con notas distintas.
- Si en el futuro el usuario pide personalización real por estudiante, es un cambio de
  flujo (no solo de UI): habría que decidir explícitamente el disparador (¿automático?
  ¿bajo demanda desde el chat?) y aceptar el costo extra en llamadas a Gemini. No
  construir esto sin que el usuario lo pida de nuevo explícitamente.

## 3.1.1 Estado del roadmap: MVP funcional completo

A partir de v7, todo el roadmap original de la sección 3 está construido, salvo el
único punto que le corresponde al usuario (pegar sus credenciales reales de Firebase
y Cloudinary — ningún agente debe inventarlas). Si una sesión futura retoma esto y
todo sigue con [x], no hay "siguiente paso" obligatorio: preguntar al usuario qué
quiere ampliar antes de inventar alcance nuevo. Ideas razonables para cuando lo pida
(NO implementar sin que lo pida): UI para el tipo "reto_codigo_autoevaluado" (hoy solo
existe el tipo "quiz" con interfaz completa), uso real de "rubrica"/"caso_practico" en
alguna pantalla, moduloActual/orden real en el dashboard estudiante (hoy se listan
todos los módulos sin orden pedagógico), y la migración de calificación a Cloud
Function (ver limitación de seguridad abajo) si se necesita integridad real.

## 3.2 Limitaciones de seguridad conocidas (aceptadas por ahora, revisar si se necesita más rigor)

- **Calificación client-side**: `calificarIntento()` corre en el navegador del propio
  estudiante y compara sus respuestas contra `respuestaCorrectaIndex` que SÍ llega al
  cliente dentro del documento de `evaluaciones` (las reglas de Firestore permiten leer
  la evaluación completa). Un estudiante que inspeccione el JS o la respuesta de
  Firestore podría ver las respuestas correctas o falsificar su progreso, porque no
  hay backend que valide de forma independiente. Mitigación futura si se necesita
  integridad real: mover la calificación a una Cloud Function que sea la única que
  pueda escribir en `resultados` y `usuarios/{uid}.progreso`, y que las reglas de
  Firestore bloqueen la escritura directa del cliente a esos campos. No implementado
  por decisión de mantener el proyecto sin backend por ahora.
- Las reglas de `usuarios/{uid}` sí protegen `suscripcion` y `rol` (el estudiante no
  puede tocarlos), pero permiten que el estudiante escriba su propio `progreso` — es la
  misma limitación de arriba, documentada explícitamente en `docs/firestore.rules`.

## 3.1 Para que el scaffold actual funcione (pendiente del usuario, no de Claude)

**Ver `docs/INSTALACION.md` — guía completa y en orden, desde crear el proyecto Firebase
hasta el checklist final para confirmar que el sitio YA DESPLEGADO (Git → Hosting)
funciona de verdad.** Se agregó en v11 porque las instrucciones estaban repartidas y
faltaban pasos críticos para producción que no estaban documentados en ningún lado:
fijar un modelo Gemini concreto (no el alias `gemini-flash-latest` sin verificar),
activar Firebase App Check (obligatorio desde julio 2026, causa más común de que el chat
de los agentes no responda en producción aunque todo lo demás esté bien), agregar el
dominio de Hosting a "Authorized domains", y excluir `prueba-local/` del despliegue. Esta
sección se deja como resumen corto; el detalle vive en `docs/INSTALACION.md`.

## 3.3 Versionado de los ZIP de entrega

Para evitar que el usuario confunda un avance con otro, cada ZIP se entrega numerado:
`plataforma-educativa-ia-vN-YYYYMMDD.zip`. El número actual vive en `docs/VERSION.txt`
(un solo entero). Antes de generar un nuevo ZIP:
1. Lee `docs/VERSION.txt`.
2. Súmale 1.
3. Escribe ese nuevo número de vuelta en `docs/VERSION.txt`.
4. Nombra el ZIP con ese número y la fecha del día.
Así cada entrega queda claramente identificada y no se pisan entre sí.

## 4. Cómo retomar

1. Descomprime el ZIP más reciente que te haya compartido el usuario.
2. Lee este archivo completo primero.
3. Revisa el roadmap de la sección 3 para saber qué sigue.
4. Continúa sin volver a preguntar nada de la sección 2 — ya está decidido.
5. Al terminar cualquier avance, regenera el ZIP completo (todo el proyecto, no solo lo
   nuevo) y actualiza el checklist de la sección 3.
