import { auth, db } from "../js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { crearChatIngeniero, enviarMensajeIngeniero } from "../js/chat-ingeniero.js";
import { subirRecurso, listarRecursos } from "../js/recursos.js";

let chat = null;
const historialEl = document.getElementById("chat-historial");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists() || snap.data().rol !== "admin") {
    window.location.href = "../index.html";
    return;
  }

  chat = await crearChatIngeniero();
  await refrescarListaRecursos();
  agregarBurbuja("accion", "Conectado con el Ingeniero.");
});

document.getElementById("form-chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.elements.mensaje;
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";
  agregarBurbuja("admin", texto);
  try {
    const respuesta = await enviarMensajeIngeniero(chat, texto);
    agregarBurbuja("ingeniero", respuesta);
  } catch (err) {
    agregarBurbuja("accion", "Hubo un error hablando con el Ingeniero (revisa la consola).");
    console.error(err);
  }
});

document.getElementById("form-recurso-ingeniero").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const archivo = form.elements.archivo.files[0];
  const descripcion = form.elements.descripcion.value.trim();
  const msg = document.getElementById("msg-recurso-ingeniero");
  msg.textContent = "";
  try {
    const recurso = await subirRecurso("ingeniero", archivo, descripcion);
    form.reset();
    await refrescarListaRecursos();
    agregarBurbuja("accion", `📎 Recurso subido: "${recurso.nombre}"`);
    try {
      const respuesta = await enviarMensajeIngeniero(
        chat,
        `Te acabo de subir un recurso: "${recurso.nombre}"${descripcion ? ` (${descripcion})` : ""}. ` +
        `URL: ${recurso.url}. Dime brevemente si lo tendrás en cuenta.`
      );
      agregarBurbuja("ingeniero", respuesta);
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    msg.textContent = err.message || "No se pudo subir el recurso.";
    console.error(err);
  }
});

async function refrescarListaRecursos() {
  const recursos = await listarRecursos("ingeniero");
  const cont = document.getElementById("lista-recursos-ingeniero");
  cont.innerHTML = recursos.length === 0
    ? "Sin recursos subidos todavía."
    : recursos.map(r => `• <a href="${r.url}" target="_blank" style="color:var(--ambar);">${r.nombre}</a>${r.descripcion ? ` — ${r.descripcion}` : ""}`).join("<br>");
}

function agregarBurbuja(tipo, texto) {
  const clase = tipo === "admin" ? "burbuja-admin" : tipo === "accion" ? "burbuja-accion" : "burbuja-profesor";
  const div = document.createElement("div");
  div.className = `burbuja ${clase}`;
  div.textContent = texto;
  historialEl.appendChild(div);
  historialEl.scrollTop = historialEl.scrollHeight;
}
