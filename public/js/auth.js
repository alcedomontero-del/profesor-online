import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { nombrePermitido } from "./filtro-nombres.js";

const tabsEl = document.querySelector(".tabs");
const formEntrar = document.getElementById("form-entrar");
const formRegistro = document.getElementById("form-registro");
const panelVerificar = document.getElementById("panel-verificar");
const textoVerificar = document.getElementById("texto-verificar");
const avisoVerificar = document.getElementById("aviso-verificar");

// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("activa"));
    tab.classList.add("activa");
    const destino = tab.dataset.tab;
    formEntrar.classList.toggle("oculto", destino !== "entrar");
    formRegistro.classList.toggle("oculto", destino !== "registro");
    panelVerificar.classList.add("oculto");
  });
});

/**
 * Muestra el panel "confirma tu correo" en vez de las pestañas/formularios.
 * El botón de reenviar usa auth.currentUser, así que solo funciona mientras
 * la sesión (recién creada al registrarse, o recién iniciada al hacer login
 * con una cuenta sin confirmar) sigue activa en este mismo cliente.
 */
function mostrarPanelVerificar(mensaje) {
  tabsEl.classList.add("oculto");
  formEntrar.classList.add("oculto");
  formRegistro.classList.add("oculto");
  textoVerificar.textContent = mensaje;
  avisoVerificar.textContent = "";
  panelVerificar.classList.remove("oculto");
}

function ocultarPanelVerificarYVolverAEntrar() {
  tabsEl.classList.remove("oculto");
  panelVerificar.classList.add("oculto");
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("activa"));
  document.querySelector('.tab[data-tab="entrar"]').classList.add("activa");
  formEntrar.classList.remove("oculto");
  formRegistro.classList.add("oculto");
}

document.getElementById("btn-reenviar-correo").addEventListener("click", async () => {
  if (!auth.currentUser) {
    avisoVerificar.textContent = "Tu sesión expiró. Vuelve a iniciar sesión para reenviar el correo.";
    return;
  }
  try {
    await sendEmailVerification(auth.currentUser);
    avisoVerificar.textContent = "Correo reenviado. Revisa tu bandeja de entrada (y spam).";
  } catch (err) {
    avisoVerificar.textContent = "No pudimos reenviar el correo. Intenta de nuevo en un momento.";
  }
});

document.getElementById("btn-otra-cuenta").addEventListener("click", async () => {
  try { await signOut(auth); } catch (_) { /* seguimos igual */ }
  ocultarPanelVerificarYVolverAEntrar();
});

// --- Entrar ---
formEntrar.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const errorEl = document.getElementById("error-entrar");
  errorEl.textContent = "";
  try {
    const cred = await signInWithEmailAndPassword(auth, datos.get("email"), datos.get("password"));
    if (!cred.user.emailVerified) {
      // No lo dejamos entrar: se queda con la sesión abierta solo para poder
      // reenviar el correo, pero no avanza al dashboard hasta confirmar.
      mostrarPanelVerificar("Confirma tu correo antes de continuar. Te enviamos un enlace al crear la cuenta.");
      return;
    }
    await redirigirSegunRol(cred.user.uid);
  } catch (err) {
    errorEl.textContent = "No pudimos iniciar sesión. Revisa tu correo y contraseña.";
  }
});

// Dominios de correo permitidos para registrarse como estudiante. Se valida aquí
// (cliente) Y en docs/firestore.rules (creación del documento usuarios/{uid}) —
// la del cliente es solo para dar un mensaje de error claro; la de Firestore es la
// que de verdad protege, porque un cliente modificado podría saltarse esta.
const DOMINIOS_CORREO_PERMITIDOS = ["gmail.com", "outlook.com"];

function dominioPermitido(email) {
  const dominio = (email || "").split("@")[1]?.toLowerCase();
  return DOMINIOS_CORREO_PERMITIDOS.includes(dominio);
}

// --- Registro ---
formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const errorEl = document.getElementById("error-registro");
  errorEl.textContent = "";

  const nombre = (datos.get("nombre") || "").trim();
  // Igual que el dominio de correo: esta validación es solo para un mensaje
  // claro. La que de verdad protege corre en docs/firestore.rules, porque un
  // cliente modificado podría saltarse esta.
  if (!nombrePermitido(nombre)) {
    errorEl.textContent = "Ese nombre no está permitido. Usa tu nombre real, sin palabras ofensivas ni nombres reservados del sistema (admin, profesor, soporte...).";
    return;
  }

  const email = (datos.get("email") || "").trim().toLowerCase();
  if (!dominioPermitido(email)) {
    errorEl.textContent = "Solo se aceptan correos de Gmail (@gmail.com) u Outlook (@outlook.com).";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, datos.get("password"));
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      nombre,
      email,
      rol: "estudiante",
      suscripcion: { estado: "activa", fechaInicio: serverTimestamp() },
      progreso: { moduloActual: null, puntajePromedio: 0, capacitado: false },
      creadoEn: serverTimestamp()
    });
    await sendEmailVerification(cred.user);
    // No lo mandamos al dashboard todavía: se queda en index.html, con la
    // sesión abierta solo para poder reenviar el correo si hace falta, hasta
    // que confirme desde su bandeja de entrada.
    mostrarPanelVerificar("Creamos tu cuenta. Te enviamos un correo de confirmación — ábrelo para poder entrar.");
  } catch (err) {
    errorEl.textContent = "No pudimos crear la cuenta. Verifica los datos.";
  }
});

async function redirigirSegunRol(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  const rol = snap.exists() ? snap.data().rol : "estudiante";
  window.location.href = rol === "admin" ? "admin/dashboard.html" : "estudiante/dashboard.html";
}

// Si nos redirigieron aquí desde una pantalla protegida (ver
// js/verificacion-correo.js) por no tener el correo confirmado, la sesión ya
// se cerró antes del redirect, así que no hay un usuario activo para ofrecer
// "reenviar" de una vez — solo avisamos y lo mandamos a iniciar sesión de
// nuevo, que es donde sí puede reenviar el correo (ver el bloque "Entrar").
if (new URLSearchParams(window.location.search).get("verificar") === "1") {
  document.getElementById("error-entrar").textContent =
    "Debes confirmar tu correo antes de continuar. Inicia sesión de nuevo para reenviar el correo de confirmación.";
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
