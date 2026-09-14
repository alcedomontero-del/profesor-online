import * as bd from "./db-local.js";
import { generarRespuestaLocal } from "./chat-local.js";

const uid = bd.uidSesionActual();
if (!uid) window.location.href = "index.html";

const historialEl = document.getElementById("chat-historial");
const contexto = { esperandoConfirmacionPrograma: false };

function agregarBurbuja(tipo, texto) {
  const clase = tipo === "admin" ? "burbuja-admin" : tipo === "accion" || tipo === "resultado" ? "burbuja-accion" : "burbuja-profesor";
  const div = document.createElement("div");
  div.className = `burbuja ${clase}`;
  div.textContent = texto;
  historialEl.appendChild(div);
  historialEl.scrollTop = historialEl.scrollHeight;
}

async function init() {
  const usuarioDoc = await bd.getDoc("usuarios", uid);
  if (!usuarioDoc.exists() || usuarioDoc.data().rol !== "admin") {
    window.location.href = "index.html";
    return;
  }

  const modulos = await bd.getDocs("modulos");
  if (modulos.length === 0) {
    agregarBurbuja(
      "profesor",
      "Hola, soy el Profesor (modo prueba). Todavía no hay ningún módulo creado. " +
      "Puedo diseñar un programa de ejemplo con un par de módulos ahora mismo — " +
      'responde "adelante" si quieres que empiece (necesito que mantengas esta ' +
      "pestaña abierta mientras trabajo). O si prefieres, pídeme directamente " +
      '"crea una clase sobre <tema>".'
    );
    contexto.esperandoConfirmacionPrograma = true;
  }
}

document.getElementById("form-chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.elements.mensaje;
  const texto = input.value.trim();
  if (!texto) return;
  input.value = "";
  agregarBurbuja("admin", texto);

  await generarRespuestaLocal(texto, contexto, (evento) => {
    agregarBurbuja(evento.tipo, evento.texto);
  });
  contexto.esperandoConfirmacionPrograma = false;
});

init();
