import * as bd from "./db-local.js";
import { solicitarClase, solicitarQuiz } from "./agente-profesor-local.js";

const uidAdmin = bd.uidSesionActual();
if (!uidAdmin) window.location.href = "index.html";

async function init() {
  const usuarioDoc = await bd.getDoc("usuarios", uidAdmin);
  if (!usuarioDoc.exists() || usuarioDoc.data().rol !== "admin") {
    window.location.href = "index.html";
    return;
  }
  await cargarEstudiantes();
  await cargarSolicitudes();
}

document.getElementById("form-generar-clase").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-clase");
  msg.style.color = "var(--texto-tenue)";
  msg.textContent = "Negociando con el agente Ingeniero (simulado)…";
  const resultado = await solicitarClase(datos.get("moduloId"), datos.get("tema"));
  if (resultado.ok) {
    msg.style.color = "var(--verde-terminal)";
    msg.textContent = `Clase generada (id ${resultado.claseId}).`;
  } else {
    msg.style.color = "#E8703D";
    msg.textContent = `No se logró acuerdo: ${resultado.motivo}`;
  }
  await cargarSolicitudes();
});

document.getElementById("form-generar-quiz").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-quiz");
  msg.style.color = "var(--texto-tenue)";
  msg.textContent = "Negociando con el agente Ingeniero (simulado)…";
  const resultado = await solicitarQuiz(datos.get("moduloId"), datos.get("proposito"));
  if (resultado.ok) {
    msg.style.color = "var(--verde-terminal)";
    msg.textContent = `Quiz generado (evaluación ${resultado.evaluacionId}).`;
  } else {
    msg.style.color = "#E8703D";
    msg.textContent = `No se logró acuerdo: ${resultado.motivo}`;
  }
  await cargarSolicitudes();
});

async function cargarSolicitudes() {
  const contenedor = document.getElementById("lista-solicitudes");
  const solicitudes = await bd.getDocs("solicitudes_agente");
  if (solicitudes.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue);">Sin negociaciones todavía.</p>`;
    return;
  }
  solicitudes.sort((a, b) => (b.data().resueltoEn?.seconds || 0) - (a.data().resueltoEn?.seconds || 0));
  contenedor.innerHTML = solicitudes.map((s) => {
    const d = s.data();
    const color = d.escaladoAdmin ? "#E8703D" : "var(--verde-terminal)";
    const estadoTexto = d.escaladoAdmin ? "escalado a admin" : "resuelto";
    return `
      <div style="border:1px solid var(--borde); border-radius:6px; padding:0.6rem 0.9rem;">
        <div><strong>${d.solicitud?.tipo}</strong> — ${d.solicitud?.moduloId}
          <span style="color:${color};"> · ${estadoTexto}</span>
          <span style="color:var(--texto-tenue);"> · ronda ${d.ronda}</span>
        </div>
        <div style="color:var(--texto-tenue); font-size:0.8rem;">${d.respuestaIngeniero?.detalle || ""}</div>
      </div>
    `;
  }).join("");
}

async function cargarEstudiantes() {
  const contenedor = document.getElementById("lista-estudiantes");
  const usuarios = await bd.getDocs("usuarios", (d) => d.rol === "estudiante");
  if (usuarios.length === 0) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue);">No hay estudiantes.</p>`;
    return;
  }
  contenedor.innerHTML = "";
  usuarios.forEach((docEst) => {
    const uid = docEst.id;
    const d = docEst.data();
    const promedio = d.progreso.puntajePromedio || 0;
    const capacitado = !!d.progreso.capacitado;

    const fila = document.createElement("div");
    fila.style.cssText = "display:flex; justify-content:space-between; align-items:center; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem; gap:1rem;";
    fila.innerHTML = `
      <span>
        ${d.nombre}
        <span style="color:var(--texto-tenue); font-size:0.8rem;">
          — ${Math.round(promedio * 100)}% · ${d.suscripcion.estado}${capacitado ? " · capacitado" : ""}
        </span>
      </span>
      <button class="btn-primario" style="padding:0.4rem 0.9rem;" ${capacitado ? "" : "disabled"}>
        Generar certificado
      </button>
    `;
    const boton = fila.querySelector("button");
    boton.addEventListener("click", () => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.setFontSize(28);
      pdf.text("Certificado de capacitación (prueba)", 148, 60, { align: "center" });
      pdf.setFontSize(16);
      pdf.text("Desarrollo Web Full Stack", 148, 75, { align: "center" });
      pdf.setFontSize(14);
      pdf.text(`Otorgado a: ${d.nombre}`, 148, 100, { align: "center" });
      pdf.text(`Promedio: ${Math.round(promedio * 100)}%`, 148, 112, { align: "center" });
      pdf.save(`certificado-prueba-${d.nombre}.pdf`);
    });
    contenedor.appendChild(fila);
  });
}

init();
