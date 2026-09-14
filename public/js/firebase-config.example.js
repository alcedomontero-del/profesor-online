// Copia este archivo como firebase-config.js y pega tus credenciales reales
// (Firebase Console > Configuración del proyecto > Tus apps > SDK config).
// Las claves de Firebase Web son públicas por diseño; la seguridad real la dan
// las Reglas de Seguridad de Firestore (docs/firestore.rules), no esta clave.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-ai.js";

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

// --- Firebase AI Logic (Gemini Developer API, capa gratuita) ---
// Requiere que en Firebase Console > AI Services > AI Logic hayas elegido
// "Gemini Developer API" y configurado Firebase App Check (ver CONTINUACION.md).
export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Nombre del modelo: verifica el vigente en la documentación de Firebase AI Logic
// antes de desplegar — varios modelos Gemini se han retirado durante 2026.
export const MODELO_GEMINI = "gemini-flash-latest";

export function crearModelo(config = {}) {
  return getGenerativeModel(ai, { model: MODELO_GEMINI, ...config });
}
