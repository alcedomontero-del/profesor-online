import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("activa"));
    tab.classList.add("activa");
    const destino = tab.dataset.tab;
    document.getElementById("form-entrar").classList.toggle("oculto", destino !== "entrar");
    document.getElementById("form-registro").classList.toggle("oculto", destino !== "registro");
  });
});

// --- Entrar ---
document.getElementById("form-entrar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const errorEl = document.getElementById("error-entrar");
  errorEl.textContent = "";
  try {
    const cred = await signInWithEmailAndPassword(auth, datos.get("email"), datos.get("password"));
    await redirigirSegunRol(cred.user.uid);
  } catch (err) {
    errorEl.textContent = "No pudimos iniciar sesión. Revisa tu correo y contraseña.";
  }
});

// --- Registro ---
document.getElementById("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const errorEl = document.getElementById("error-registro");
  errorEl.textContent = "";
  try {
    const cred = await createUserWithEmailAndPassword(auth, datos.get("email"), datos.get("password"));
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nombre: datos.get("nombre"),
      email: datos.get("email"),
      rol: "estudiante",
      suscripcion: { estado: "activa", fechaInicio: serverTimestamp() },
      progreso: { moduloActual: null, puntajePromedio: 0, capacitado: false },
      creadoEn: serverTimestamp()
    });
    window.location.href = "estudiante/dashboard.html";
  } catch (err) {
    errorEl.textContent = "No pudimos crear la cuenta. Verifica los datos.";
  }
});

async function redirigirSegunRol(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  const rol = snap.exists() ? snap.data().rol : "estudiante";
  window.location.href = rol === "admin" ? "admin/dashboard.html" : "estudiante/dashboard.html";
}

// --- Enlace de donación (leído desde configuración) ---
(async () => {
  try {
    const snap = await getDoc(doc(db, "configuracion", "donaciones"));
    if (snap.exists() && snap.data().paypalLink) {
      document.getElementById("link-donar").href = snap.data().paypalLink;
    }
  } catch (_) { /* silencioso: si no hay config aún, se deja el enlace por defecto */ }
})();
