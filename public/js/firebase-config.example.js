// Copia este archivo como firebase-config.js y pega tus credenciales reales
// (Firebase Console > Configuración del proyecto > Tus apps > SDK config).
// Las claves de Firebase Web son públicas por diseño; la seguridad real la dan
// las Reglas de Seguridad de Firestore (docs/firestore.rules), no esta clave.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app-check.js";

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

// --- Firebase App Check (OBLIGATORIO desde julio 2026) ---
// Sin esto, las llamadas a Gemini (Firebase AI Logic) y a Firestore fallan en
// producción — es la causa más común de que el sitio "no responda" tras desplegar.
// 1. Mientras programas en local: descomenta la línea de abajo para activar el modo
//    debug (te dará un token en la consola del navegador que debes pegar en
//    Firebase Console > App Check > tu app > "Manage debug tokens").
// self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
//
// 2. Antes de desplegar a producción: reemplaza "TU_RECAPTCHA_V3_SITE_KEY" con la
//    site key real que generas en Firebase Console > Compilación > App Check >
//    registra tu app web > reCAPTCHA v3 (ver docs/INSTALACION.md paso 6).
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("TU_RECAPTCHA_V3_SITE_KEY"),
  isTokenAutoRefreshEnabled: true
});

// --- Firebase AI Logic (Gemini Developer API, capa gratuita) ---
// Requiere que en Firebase Console > AI Services > AI Logic hayas elegido
// "Gemini Developer API" y configurado Firebase App Check (arriba).
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Nombre del modelo: verifica el vigente en la documentación de Firebase AI Logic
// antes de desplegar — varios modelos Gemini se han retirado durante 2026.
export const MODELO_GEMINI = "gemini-flash-latest";

export function crearModelo(config = {}) {
  return getGenerativeModel(ai, { model: MODELO_GEMINI, ...config });
}
