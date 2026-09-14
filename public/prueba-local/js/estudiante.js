import * as bd from "./db-local.js";
import { calificarIntento, prepararPreguntasParaEstudiante } from "./agente-profesor-local.js";

const uid = bd.uidSesionActual();
if (!uid) window.location.href = "index.html";

async function init() {
  const usuarioDoc = await bd.getDoc("usuarios", uid);
  if (!usuarioDoc.exists()) { window.location.href = "index.html"; return; }
  const datos = usuarioDoc.data();

  document.getElementById("saludo").textContent = `hola, ${datos.nombre}`;
  document.getElementById("estado-suscripcion").textContent =
    `Inscripción: ${datos.suscripcion.estado}. Promedio: ${Math.round((datos.progreso.puntajePromedio || 0) * 100)}%` +
    (datos.progreso.capacitado ? " — ¡ya estás capacitado!" : ".");

  await cargarModulos();
  await cargarEvaluaciones();
}

async function cargarModulos() {
  const contenedor = document.getElementById("lista-modulos");
  const modulos = await bd.getDocs("modulos");
  if (modulos.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue); font-size:0.85rem;">
      Todavía no hay clases. Pídele al administrador de prueba que genere una.</p>`;
    return;
  }
  contenedor.innerHTML = "";
  modulos.forEach((m) => {
    (m.data().clases || []).forEach((clase) => {
      const fila = document.createElement("div");
      fila.style.cssText = "display:flex; justify-content:space-between; align-items:center; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem;";
      fila.innerHTML = `
        <span>${clase.titulo} <span style="color:var(--texto-tenue); font-size:0.8rem;">(${m.id})</span></span>
        <button class="btn-primario" style="padding:0.4rem 0.9rem;">Leer</button>
      `;
      fila.querySelector("button").addEventListener("click", () => {
        document.getElementById("clase-titulo").textContent = clase.titulo;
        document.getElementById("clase-contenido").textContent = clase.contenido;
        const panel = document.getElementById("panel-clase");
        panel.classList.remove("oculto");
        panel.scrollIntoView({ behavior: "smooth" });
      });
      contenedor.appendChild(fila);
    });
  });
}

async function cargarEvaluaciones() {
  const contenedor = document.getElementById("lista-evaluaciones");
  const evaluaciones = await bd.getDocs("evaluaciones");
  if (evaluaciones.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue); font-size:0.85rem;">
      Todavía no hay evaluaciones. Pídele al administrador de prueba que genere una.</p>`;
    return;
  }
  contenedor.innerHTML = "";
  evaluaciones.forEach((docEval) => {
    const data = docEval.data();
    const fila = document.createElement("div");
    fila.style.cssText = "display:flex; justify-content:space-between; align-items:center; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem;";
    fila.innerHTML = `
      <span>${data.moduloId} <span style="color:var(--texto-tenue); font-size:0.8rem;">(${data.tipo})</span></span>
      <button class="btn-primario" style="padding:0.4rem 0.9rem;">Resolver</button>
    `;
    fila.querySelector("button").addEventListener("click", () => mostrarQuiz(docEval.id, data));
    contenedor.appendChild(fila);
  });
}

function mostrarQuiz(evaluacionId, data) {
  const panel = document.getElementById("panel-quiz");
  const form = document.getElementById("form-quiz");
  const resultadoEl = document.getElementById("quiz-resultado");
  resultadoEl.textContent = "";
  document.getElementById("quiz-titulo").textContent = `quiz — ${data.moduloId}`;

  const preguntasVisibles = prepararPreguntasParaEstudiante(data.preguntas);
  form.innerHTML = "";
  preguntasVisibles.forEach((p, i) => {
    const bloque = document.createElement("label");
    bloque.innerHTML = `
      <span>${i + 1}. ${p.enunciado}</span>
      ${p.opciones.map((op, j) => `
        <label style="display:flex; gap:0.5rem; font-weight:normal; color:var(--papel);">
          <input type="radio" name="pregunta-${i}" value="${j}" required> ${op}
        </label>
      `).join("")}
    `;
    form.appendChild(bloque);
  });

  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "btn-primario";
  btn.textContent = "Enviar respuestas";
  form.appendChild(btn);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const respuestas = data.preguntas.map((_, i) => {
      const marcado = form.querySelector(`input[name="pregunta-${i}"]:checked`);
      return marcado ? Number(marcado.value) : -1;
    });
    const puntaje = await calificarIntento(uid, evaluacionId, data.preguntas, respuestas);
    resultadoEl.style.color = "var(--verde-terminal)";
    resultadoEl.textContent = `Puntaje: ${Math.round(puntaje * 100)}%. Recarga la página para ver tu promedio actualizado arriba.`;
  };

  panel.classList.remove("oculto");
  panel.scrollIntoView({ behavior: "smooth" });
}

init();
