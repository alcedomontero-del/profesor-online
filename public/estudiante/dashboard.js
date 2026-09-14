import { auth, db } from "../js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { calificarIntento, prepararPreguntasParaEstudiante } from "../js/agente-profesor.js";
import { exigirCorreoVerificado } from "../js/verificacion-correo.js";

let uidActual = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }
  if (await exigirCorreoVerificado(auth, user)) return;
  uidActual = user.uid;

  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists()) return;
  const datos = snap.data();

  document.getElementById("saludo").textContent = `hola, ${datos.nombre || "estudiante"}`;
  const estado = datos.suscripcion?.estado || "inactiva";
  document.getElementById("estado-suscripcion").textContent =
    estado === "activa"
      ? `Tu inscripción está activa. Promedio actual: ${Math.round((datos.progreso?.puntajePromedio || 0) * 100)}%` +
        (datos.progreso?.capacitado ? " — ¡ya estás capacitado!" : ".")
      : "Tu inscripción no está activa. Contacta al administrador para reactivarla.";

  await cargarModulos();
  await cargarEvaluaciones();
});

async function cargarModulos() {
  const contenedor = document.getElementById("lista-modulos");
  const snap = await getDocs(collection(db, "modulos"));
  if (snap.empty) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue); font-size:0.85rem;">
      Todavía no hay clases generadas. Vuelve más tarde.</p>`;
    return;
  }

  contenedor.innerHTML = "";
  snap.forEach((docMod) => {
    const data = docMod.data();
    (data.clases || []).forEach((clase) => {
      const fila = document.createElement("div");
      fila.style.cssText = "display:flex; justify-content:space-between; align-items:center; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem;";
      fila.innerHTML = `
        <span>${clase.titulo || docMod.id} <span style="color:var(--texto-tenue); font-size:0.8rem;">(${docMod.id})</span></span>
        <button class="btn-primario" style="padding:0.4rem 0.9rem;">Leer</button>
      `;
      fila.querySelector("button").addEventListener("click", () => mostrarClase(clase));
      contenedor.appendChild(fila);
    });
  });
}

function mostrarClase(clase) {
  const panel = document.getElementById("panel-clase");
  document.getElementById("clase-titulo").textContent = clase.titulo || "clase";
  document.getElementById("clase-contenido").textContent = clase.contenido || "";

  const mediaEl = document.getElementById("clase-media");
  mediaEl.innerHTML = "";
  if (clase.mediaUrl) {
    const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(clase.mediaUrl);
    const el = document.createElement(esVideo ? "video" : "img");
    el.src = clase.mediaUrl;
    el.style.cssText = "max-width:100%; border-radius:8px; margin-bottom:1rem;";
    if (esVideo) el.controls = true;
    mediaEl.appendChild(el);
  }

  panel.classList.remove("oculto");
  panel.scrollIntoView({ behavior: "smooth" });
}

async function cargarEvaluaciones() {
  const contenedor = document.getElementById("lista-evaluaciones");
  const snap = await getDocs(collection(db, "evaluaciones"));
  if (snap.empty) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue); font-size:0.85rem;">
      Todavía no hay evaluaciones generadas. Vuelve más tarde.</p>`;
    return;
  }

  contenedor.innerHTML = "";
  snap.forEach((docEval) => {
    const data = docEval.data();
    const fila = document.createElement("div");
    fila.style.cssText = "display:flex; justify-content:space-between; align-items:center; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem;";
    fila.innerHTML = `
      <span>${data.moduloId} <span style="color:var(--texto-tenue); font-size:0.8rem;">(${data.tipo})</span></span>
      <button class="btn-primario" style="padding:0.4rem 0.9rem;" data-id="${docEval.id}">Resolver</button>
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
    resultadoEl.style.color = "var(--texto-tenue)";
    resultadoEl.textContent = "Calificando…";
    try {
      const puntaje = await calificarIntento(uidActual, evaluacionId, data.preguntas, respuestas);
      resultadoEl.style.color = "var(--verde-terminal)";
      resultadoEl.textContent = `Puntaje: ${Math.round(puntaje * 100)}%`;
    } catch (err) {
      resultadoEl.style.color = "#E8703D";
      resultadoEl.textContent = "No se pudo guardar tu intento. Intenta de nuevo.";
      console.error(err);
    }
  };

  panel.classList.remove("oculto");
  panel.scrollIntoView({ behavior: "smooth" });
}
