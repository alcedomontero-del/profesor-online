import { auth, db } from "../js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { solicitarQuiz, solicitarClase, actualizarPerfilEnsenanza } from "../js/agente-profesor.js";
import { generarCertificado } from "../js/certificados.js";
import { adjuntarMediaAClase } from "../js/media.js";

let uidAdmin = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  if (!snap.exists() || snap.data().rol !== "admin") {
    window.location.href = "../index.html"; // no es admin, fuera
    return;
  }
  uidAdmin = user.uid;

  const config = await getDoc(doc(db, "configuracion", "donaciones"));
  if (config.exists()) {
    document.querySelector('input[name="paypalLink"]').value = config.data().paypalLink || "";
  }
  const cloudinaryConfig = await getDoc(doc(db, "configuracion", "cloudinary"));
  if (cloudinaryConfig.exists()) {
    document.querySelector('input[name="cloudName"]').value = cloudinaryConfig.data().cloudName || "";
    document.querySelector('input[name="uploadPreset"]').value = cloudinaryConfig.data().uploadPreset || "";
  }

  await cargarEstudiantes();
  await cargarSolicitudes();
});

document.getElementById("form-donacion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const link = new FormData(e.target).get("paypalLink");
  const msg = document.getElementById("msg-donacion");
  try {
    await setDoc(doc(db, "configuracion", "donaciones"), { paypalLink: link });
    msg.style.color = "var(--verde-terminal)";
    msg.textContent = "Guardado.";
  } catch (err) {
    msg.style.color = "#E8703D";
    msg.textContent = "No se pudo guardar. Verifica que tu usuario tenga rol admin en Firestore.";
  }
});

document.getElementById("form-cloudinary").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-cloudinary");
  try {
    await setDoc(doc(db, "configuracion", "cloudinary"), {
      cloudName: datos.get("cloudName"),
      uploadPreset: datos.get("uploadPreset")
    });
    msg.style.color = "var(--verde-terminal)";
    msg.textContent = "Guardado.";
  } catch (err) {
    msg.style.color = "#E8703D";
    msg.textContent = "No se pudo guardar.";
  }
});

document.getElementById("form-generar-quiz").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-quiz");
  msg.style.color = "var(--texto-tenue)";
  msg.textContent = "Negociando con el agente Ingeniero…";
  try {
    const resultado = await solicitarQuiz(datos.get("moduloId"), datos.get("proposito"));
    if (resultado.ok) {
      msg.style.color = "var(--verde-terminal)";
      msg.textContent = `Quiz generado y guardado (evaluación ${resultado.evaluacionId}).`;
    } else {
      msg.style.color = "#E8703D";
      msg.textContent = `No se logró acuerdo con el Ingeniero: ${resultado.motivo}. Revisado en solicitudes_agente.`;
    }
  } catch (err) {
    msg.style.color = "#E8703D";
    msg.textContent = "Error generando el quiz. Revisa la consola y la configuración de Firebase AI Logic.";
    console.error(err);
  }
});

document.getElementById("form-generar-clase").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-clase");
  msg.style.color = "var(--texto-tenue)";
  msg.textContent = "Negociando con el agente Ingeniero…";
  try {
    const resultado = await solicitarClase(datos.get("moduloId"), datos.get("tema"));
    if (resultado.ok) {
      msg.style.color = "var(--verde-terminal)";
      msg.textContent = `Clase generada y guardada en el módulo (id ${resultado.claseId}).`;
    } else {
      msg.style.color = "#E8703D";
      msg.textContent = `No se logró acuerdo con el Ingeniero: ${resultado.motivo}. Revisado en solicitudes_agente.`;
    }
    await cargarSolicitudes();
  } catch (err) {
    msg.style.color = "#E8703D";
    msg.textContent = "Error generando la clase. Revisa la consola y la configuración de Firebase AI Logic.";
    console.error(err);
  }
});

document.getElementById("form-adjuntar-media").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const msg = document.getElementById("msg-media");
  const archivo = datos.get("archivo");
  msg.style.color = "var(--texto-tenue)";
  msg.textContent = "Subiendo…";
  try {
    await adjuntarMediaAClase(datos.get("moduloId"), datos.get("claseId"), archivo);
    msg.style.color = "var(--verde-terminal)";
    msg.textContent = "Adjuntado. Los estudiantes ya lo verán al leer la clase.";
    e.target.reset();
  } catch (err) {
    msg.style.color = "#E8703D";
    msg.textContent = err.message || "No se pudo adjuntar el archivo.";
    console.error(err);
  }
});

async function cargarSolicitudes() {
  const contenedor = document.getElementById("lista-solicitudes");
  const snap = await getDocs(collection(db, "solicitudes_agente"));
  if (snap.empty) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue);">Sin negociaciones registradas todavía.</p>`;
    return;
  }

  const entradas = [];
  snap.forEach((d) => entradas.push({ id: d.id, ...d.data() }));
  entradas.sort((a, b) => (b.resueltoEn?.seconds || 0) - (a.resueltoEn?.seconds || 0));

  contenedor.innerHTML = entradas.slice(0, 20).map((s) => {
    const color = s.escaladoAdmin ? "#E8703D" : "var(--verde-terminal)";
    const estadoTexto = s.escaladoAdmin ? "escalado a admin" : "resuelto";
    return `
      <div style="border:1px solid var(--borde); border-radius:6px; padding:0.6rem 0.9rem;">
        <div><strong>${s.solicitud?.tipo}</strong> — ${s.solicitud?.moduloId}
          <span style="color:${color};"> · ${estadoTexto}</span>
          <span style="color:var(--texto-tenue);"> · ronda ${s.ronda}</span>
        </div>
        <div style="color:var(--texto-tenue); font-size:0.8rem;">
          ${s.respuestaIngeniero?.detalle || ""}
        </div>
      </div>
    `;
  }).join("");
}

async function cargarEstudiantes() {
  const contenedor = document.getElementById("lista-estudiantes");
  const q = query(collection(db, "usuarios"), where("rol", "==", "estudiante"));
  const snap = await getDocs(q);

  if (snap.empty) {
    contenedor.innerHTML = `<p style="color:var(--texto-tenue); font-size:0.85rem;">Aún no hay estudiantes registrados.</p>`;
    return;
  }

  contenedor.innerHTML = "";
  snap.forEach((docEst) => {
    const uid = docEst.id;
    const d = docEst.data();
    const promedio = d.progreso?.puntajePromedio || 0;
    const capacitado = !!d.progreso?.capacitado;
    const estilo = d.progreso?.estiloEnsenanza || { ritmo: "estandar", notas: "" };

    const fila = document.createElement("div");
    fila.style.cssText = "display:flex; flex-direction:column; gap:0.5rem; border:1px solid var(--borde); border-radius:6px; padding:0.7rem 1rem;";
    fila.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
        <span>
          ${d.nombre || "(sin nombre)"}
          <span style="color:var(--texto-tenue); font-size:0.8rem;">
            — ${Math.round(promedio * 100)}% · ${d.suscripcion?.estado || "sin estado"}
            ${capacitado ? " · capacitado" : ""}
          </span>
        </span>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-secundario btn-perfil" style="padding:0.4rem 0.8rem;">🎯 Perfil de enseñanza</button>
          <button class="btn-primario btn-certificado" style="padding:0.4rem 0.9rem;" ${capacitado ? "" : "disabled"}>
            Generar certificado
          </button>
        </div>
      </div>
      <div class="panel-perfil" style="display:none; border-top:1px solid var(--borde); padding-top:0.6rem; gap:0.5rem; flex-direction:column;">
        <span style="font-size:0.8rem; color:var(--texto-tenue);">
          Cómo decide el Profesor enseñarle a este estudiante en particular. Si lo dejas
          en "estándar" y sin notas, se le enseña con el contenido genérico reutilizado
          para todo el módulo (más rápido). Si le pones un ritmo distinto o notas, el
          Profesor adapta el contenido para él.
        </span>
        <label style="font-size:0.85rem;">Ritmo
          <select class="select-ritmo" style="width:100%; margin-top:0.2rem;">
            <option value="estandar" ${estilo.ritmo === "estandar" ? "selected" : ""}>Estándar</option>
            <option value="lento" ${estilo.ritmo === "lento" ? "selected" : ""}>Lento (más ejemplos/refuerzo)</option>
            <option value="acelerado" ${estilo.ritmo === "acelerado" ? "selected" : ""}>Acelerado</option>
          </select>
        </label>
        <label style="font-size:0.85rem;">Notas para el Profesor
          <input type="text" class="input-notas" value="${(estilo.notas || "").replace(/"/g, "&quot;")}"
            placeholder="ej. le cuesta CSS, reforzar con más ejemplos visuales" style="width:100%; margin-top:0.2rem;">
        </label>
        <button class="btn-primario btn-guardar-perfil" style="align-self:flex-start; padding:0.4rem 0.9rem;">Guardar</button>
        <p class="msg-perfil" style="font-size:0.8rem; margin:0;"></p>
      </div>
    `;

    fila.querySelector(".btn-perfil").addEventListener("click", () => {
      const panel = fila.querySelector(".panel-perfil");
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });

    fila.querySelector(".btn-guardar-perfil").addEventListener("click", async (ev) => {
      const boton = ev.target;
      const msg = fila.querySelector(".msg-perfil");
      const ritmo = fila.querySelector(".select-ritmo").value;
      const notas = fila.querySelector(".input-notas").value.trim();
      boton.disabled = true;
      try {
        await actualizarPerfilEnsenanza(uid, { ritmo, notas });
        msg.style.color = "var(--verde-terminal)";
        msg.textContent = "Guardado. Se usará en la próxima clase/quiz que se le genere.";
      } catch (err) {
        msg.style.color = "#E8703D";
        msg.textContent = "No se pudo guardar.";
        console.error(err);
      } finally {
        boton.disabled = false;
      }
    });

    const boton = fila.querySelector(".btn-certificado");
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Generando…";
      try {
        const { pdfUrl } = await generarCertificado(uid, d.nombre || "Estudiante", promedio, uidAdmin);
        boton.textContent = "Certificado emitido";
        const enlace = document.createElement("a");
        enlace.href = pdfUrl;
        enlace.target = "_blank";
        enlace.rel = "noopener";
        enlace.textContent = " Ver PDF";
        enlace.style.marginLeft = "0.5rem";
        enlace.style.color = "var(--ambar)";
        boton.after(enlace);
      } catch (err) {
        boton.disabled = false;
        boton.textContent = "Generar certificado";
        alert(`No se pudo generar el certificado: ${err.message}`);
        console.error(err);
      }
    });
    contenedor.appendChild(fila);
  });
}
