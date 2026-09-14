import { auth, db } from "../js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { crearChatProfesor, enviarMensaje, investigarTema } from "../js/chat-profesor.js";
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

  chat = await crearChatProfesor();
  await refrescarListaRecursos();

  const modulos = await getDocs(collection(db, "modulos"));
  if (modulos.empty) {
    // Auto-inicio: si aún no hay currícula, el Profesor "arranca" apenas se abre
    // esta pestaña — es el equivalente, sin servidor propio, a que empiece solo.
    agregarBurbuja("accion", "Iniciando conversación con el Profesor…");
    await manejarEnvio(
      "Este es el primer inicio del sistema, todavía no hay ningún módulo creado. " +
      "Preséntate brevemente y dime cómo planeas empezar a diseñar el programa de " +
      "estudios completo — qué necesitas de mí para hacerlo (por ejemplo, que " +
      "mantenga esta pestaña abierta) antes de que empieces a crear clases.",
      true
    );
  }
});

document.getElementById("form-chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.elements.mensaje;
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";
  agregarBurbuja("admin", texto);
  await manejarEnvio(texto, false);
});

document.getElementById("btn-investigar").addEventListener("click", async () => {
  const tema = prompt("¿Sobre qué tema quieres que el Profesor investigue?");
  if (!tema) return;
  agregarBurbuja("accion", `🔎 Investigando: ${tema}…`);
  try {
    const resumen = await investigarTema(tema);
    agregarBurbuja("profesor", `[Investigación sobre "${tema}"]\n\n${resumen}`);
  } catch (err) {
    agregarBurbuja("accion", "No se pudo completar la investigación (revisa la consola).");
    console.error(err);
  }
});

async function manejarEnvio(texto, esAutomatico) {
  try {
    await enviarMensaje(chat, texto, (evento) => {
      if (evento.tipo === "texto") {
        agregarBurbuja("profesor", evento.texto);
      } else if (evento.tipo === "accion") {
        const detalle = evento.nombre === "crear_clase"
          ? `📘 Creando clase — módulo "${evento.args.moduloId}": ${evento.args.tema}`
          : `📝 Creando quiz — módulo "${evento.args.moduloId}": ${evento.args.proposito}`;
        agregarBurbuja("accion", detalle);
      } else if (evento.tipo === "resultado_accion") {
        const r = evento.resultado;
        agregarBurbuja("accion", r.ok
          ? "✅ Listo, guardado."
          : `⚠️ No se logró acuerdo con el Ingeniero: ${r.motivo}`);
      }
    });
  } catch (err) {
    agregarBurbuja("accion", esAutomatico
      ? "No se pudo iniciar la conversación automática (revisa la consola y tu configuración de Firebase AI Logic)."
      : "Hubo un error hablando con el Profesor (revisa la consola).");
    console.error(err);
  }
}

document.getElementById("form-recurso-profesor").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const archivo = form.elements.archivo.files[0];
  const descripcion = form.elements.descripcion.value.trim();
  const msg = document.getElementById("msg-recurso-profesor");
  msg.textContent = "";
  try {
    const recurso = await subirRecurso("profesor", archivo, descripcion);
    form.reset();
    await refrescarListaRecursos();
    // Se le avisa al Profesor DENTRO de la conversación (no solo queda en Firestore),
    // para que sepa que el recurso existe sin que el admin tenga que describirlo.
    agregarBurbuja("accion", `📎 Recurso subido: "${recurso.nombre}"`);
    await manejarEnvio(
      `Te acabo de subir un recurso nuevo: "${recurso.nombre}"${descripcion ? ` (${descripcion})` : ""}. ` +
      `URL: ${recurso.url}. Tenlo en cuenta para lo que sigue; dime brevemente si lo vas a usar y cómo.`,
      false
    );
  } catch (err) {
    msg.textContent = err.message || "No se pudo subir el recurso.";
    console.error(err);
  }
});

async function refrescarListaRecursos() {
  const recursos = await listarRecursos("profesor");
  const cont = document.getElementById("lista-recursos-profesor");
  cont.innerHTML = recursos.length === 0
    ? "Sin recursos subidos todavía."
    : recursos.map(r => `• <a href="${r.url}" target="_blank" style="color:var(--verde-terminal);">${r.nombre}</a>${r.descripcion ? ` — ${r.descripcion}` : ""}`).join("<br>");
}

function agregarBurbuja(tipo, texto) {
  const clase = tipo === "admin" ? "burbuja-admin" : tipo === "accion" ? "burbuja-accion" : "burbuja-profesor";
  const div = document.createElement("div");
  div.className = `burbuja ${clase}`;
  div.textContent = texto;
  historialEl.appendChild(div);
  historialEl.scrollTop = historialEl.scrollHeight;
}
