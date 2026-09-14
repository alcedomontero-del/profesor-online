// Copia este archivo como firebase-config.js y pega tus credenciales reales
// (Firebase Console > Configuración del proyecto > Tus apps > SDK config).
// Las claves de Firebase Web son públicas por diseño; la seguridad real la dan
// las Reglas de Seguridad de Firestore (docs/firestore.rules), no esta clave.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Firebase App Check ---
// Desde el 2 de noviembre de 2026, Google lo exige para que las llamadas a Gemini
// (Firebase AI Logic) funcionen — antes de esa fecha ya es lo más recomendado, pero
// pasa a ser obligatorio ese día. Sin esto, el sitio fallará en producción — es la
// causa más común de que "no responda" tras desplegar.
// Proveedor: reCAPTCHA Enterprise (Google lo recomienda para integraciones nuevas
// desde 2026, en vez de reCAPTCHA v3; gratis hasta 1 millón de llamadas/mes).
// 1. Mientras programas en local: descomenta la línea de abajo para activar el modo
//    debug (te dará un token en la consola del navegador que debes pegar en
//    Firebase Console > App Check > tu app > "Manage debug tokens").
// self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
//
// 2. Antes de desplegar a producción: reemplaza "TU_RECAPTCHA_ENTERPRISE_SITE_KEY" con
//    la clave de sitio real que generas en Google Cloud Console > reCAPTCHA Enterprise
//    > Crear clave (tipo "Sitio web", con tu dominio de Netlify) y que luego registras
//    en Firebase Console > Compilación > App Check > registra tu app web (ver
//    docs/INSTALACION.md paso 6). La clave DEBE corresponder al mismo proveedor que
//    elegiste al registrar la app en App Check — si ahí eliges reCAPTCHA v3 en vez de
//    Enterprise, cambia también aquí a ReCaptchaV3Provider, o las verificaciones
//    fallarán en silencio aunque todo lo demás esté bien configurado.
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("TU_RECAPTCHA_ENTERPRISE_SITE_KEY"),
  isTokenAutoRefreshEnabled: true
});

// --- Firebase AI Logic (Gemini Developer API, capa gratuita) ---
// Requiere que en Firebase Console > AI Services > AI Logic hayas elegido
// "Gemini Developer API" y configurado Firebase App Check (arriba).
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Nombre del modelo: NO uses "gemini-flash-latest" en producción — la propia
// documentación de Firebase AI Logic lo desaconseja explícitamente (el alias
// "-latest" puede cambiar de versión sin aviso). Se deja aquí "gemini-3.5-flash":
// versión ESTABLE, no requiere el plan de pago Blaze, y su fecha de retiro
// garantizada es "no antes de mayo de 2027" (verificado en
// https://firebase.google.com/docs/ai-logic/models el 2026-09-14).
// Si ya tienes tu firebase-config.js real con "gemini-flash-latest", cambia esa
// línea por esta antes de desplegar en serio. Antes de un despliegue futuro,
// vuelve a revisar esa página por si el modelo ya fue retirado.
export const MODELO_GEMINI = "gemini-3.5-flash";

export function crearModelo(config = {}) {
  return getGenerativeModel(ai, { model: MODELO_GEMINI, ...config });
}
