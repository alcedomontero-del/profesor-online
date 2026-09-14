import * as bd from "./db-local.js";
import { procesarSolicitud } from "./agente-ingeniero-local.js";

const MAX_RONDAS = 3;
export const UMBRAL_CAPACITADO = 0.8;

export function prepararPreguntasParaEstudiante(preguntas) {
  return preguntas.map(({ id, enunciado, opciones }) => ({ id, enunciado, opciones }));
}

export async function solicitarQuiz(moduloId, propositoPedagogico) {
  const solicitud = {
    tipo: "quiz",
    moduloId,
    propositoPedagogico,
    formatoEsperado: "5 a 8 preguntas de selección múltiple con una respuesta correcta cada una",
    ronda: 1
  };
  return negociarYGuardarQuiz(solicitud);
}

async function negociarYGuardarQuiz(solicitud) {
  let respuesta, ronda = 1;
  do {
    solicitud.ronda = ronda;
    respuesta = await procesarSolicitud(solicitud);
    ronda++;
  } while (respuesta.estado === "rechazado" && ronda <= MAX_RONDAS);

  const escalado = respuesta.estado !== "aceptado";
  await bd.addDoc("solicitudes_agente", {
    solicitud, respuestaIngeniero: respuesta, ronda: ronda - 1,
    resueltoEn: bd.marcaDeTiempo(), escaladoAdmin: escalado
  });

  if (escalado) return { ok: false, motivo: respuesta.detalle };

  const preguntas = respuesta.resultado.preguntas.map((p, i) => ({ id: String(i), ...p }));
  const evaluacionId = await bd.addDoc("evaluaciones", {
    moduloId: solicitud.moduloId,
    tipo: "quiz",
    preguntas,
    generadaPor: "profesor-agente-local",
    creadaEn: bd.marcaDeTiempo()
  });

  return { ok: true, evaluacionId };
}

export async function solicitarClase(moduloId, tema) {
  const solicitud = {
    tipo: "clase",
    moduloId,
    propositoPedagogico: tema,
    formatoEsperado: "clase completa en markdown: explicación, ejemplos, puntos clave",
    ronda: 1
  };

  let respuesta, ronda = 1;
  do {
    solicitud.ronda = ronda;
    respuesta = await procesarSolicitud(solicitud);
    ronda++;
  } while (respuesta.estado === "rechazado" && ronda <= MAX_RONDAS);

  const escalado = respuesta.estado !== "aceptado";
  await bd.addDoc("solicitudes_agente", {
    solicitud, respuestaIngeniero: respuesta, ronda: ronda - 1,
    resueltoEn: bd.marcaDeTiempo(), escaladoAdmin: escalado
  });

  if (escalado) return { ok: false, motivo: respuesta.detalle };

  const claseId = `${Date.now()}`;
  const nuevaClase = { id: claseId, ...respuesta.resultado, orden: Date.now() };

  const moduloDoc = await bd.getDoc("modulos", moduloId);
  const clasesActuales = moduloDoc.exists() ? moduloDoc.data().clases : [];
  await bd.setDoc("modulos", moduloId, {
    titulo: moduloDoc.exists() ? moduloDoc.data().titulo : moduloId,
    orden: moduloDoc.exists() ? moduloDoc.data().orden : Date.now(),
    descripcion: "",
    clases: bd.arrayUnionLocal(clasesActuales, nuevaClase)
  });

  return { ok: true, claseId };
}

export async function calificarIntento(uid, evaluacionId, preguntas, respuestasEstudiante) {
  const correctas = preguntas.filter(
    (p, i) => Number(respuestasEstudiante[i]) === Number(p.respuestaCorrectaIndex)
  ).length;
  const puntaje = correctas / preguntas.length;

  await bd.addDoc("resultados", {
    uid, evaluacionId, respuestasEstudiante, puntaje, fecha: bd.marcaDeTiempo()
  });

  await actualizarProgreso(uid);
  return puntaje;
}

async function actualizarProgreso(uid) {
  const resultados = await bd.getDocs("resultados", (d) => d.uid === uid);
  if (resultados.length === 0) return;

  const puntajes = resultados.map((r) => r.data().puntaje);
  const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
  const capacitado = promedio >= UMBRAL_CAPACITADO;

  await bd.updateDoc("usuarios", uid, {
    "progreso.puntajePromedio": promedio,
    "progreso.capacitado": capacitado
  });
}
