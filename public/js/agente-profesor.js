// Agente Profesor
// Responsabilidad única: decidir QUÉ se enseña/evalúa y pedírselo al Ingeniero mediante
// una solicitud estructurada (ver docs/contrato-agentes.md). Nunca genera ni edita
// contenido directamente sin pasar por esa negociación, y nunca decide "capacitado"
// de forma arbitraria — solo según el umbral definido en UMBRAL_CAPACITADO.

import { db } from "./firebase-config.js";
import { procesarSolicitud } from "./agente-ingeniero.js";
import { buscarPlantilla, guardarPlantilla, incrementarUso } from "./plantillas.js";
import {
  collection, addDoc, doc, setDoc, updateDoc, getDoc, getDocs, query, where,
  arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const MAX_RONDAS = 3;
export const UMBRAL_CAPACITADO = 0.8; // 80% de promedio para considerar "capacitado"

/**
 * Quita la respuesta correcta antes de mandar las preguntas al estudiante.
 * SIEMPRE usar esto en la UI de quiz — nunca renderizar `preguntas` tal cual
 * viene de Firestore, porque trae respuestaCorrectaIndex.
 */
export function prepararPreguntasParaEstudiante(preguntas) {
  return preguntas.map(({ id, enunciado, opciones }) => ({ id, enunciado, opciones }));
}

/**
 * Pide al Ingeniero el contenido de una clase para un módulo, con la misma
 * negociación (máx. MAX_RONDAS) y auditoría que solicitarQuiz. Si se acepta, la
 * agrega al array `clases` del módulo (lo crea si no existe).
 */
// perfilEstudiante es opcional: solo se usa para decidir si el contenido reutilizado
// de una plantilla necesita adaptarse (ver requiereAdaptacion). Si no se pasa, el
// comportamiento es el mismo de siempre (contenido genérico para todo el módulo).
export async function solicitarClase(moduloId, tema, perfilEstudiante = null) {
  const plantilla = await buscarPlantilla("clase", tema);

  if (plantilla && !requiereAdaptacion(perfilEstudiante)) {
    // Reutilización rápida: no se negocia con el Ingeniero ni se llama a Gemini otra vez.
    await incrementarUso("clase", plantilla.id);
    await registrarSolicitud("clase", moduloId, tema, {
      estado: "aceptado", detalle: `Reutilizada de plantilla existente (${plantilla.id}).`
    }, 0, false, plantilla.id);
    return guardarClaseEnModulo(moduloId, plantilla.resultado);
  }

  const solicitud = {
    tipo: "clase",
    moduloId,
    propositoPedagogico: plantilla
      ? `${tema}. Adaptar esta base ya probada al perfil del estudiante: ${JSON.stringify(plantilla.resultado)}. Ajustes pedidos: ${JSON.stringify(perfilEstudiante)}.`
      : tema,
    formatoEsperado: "clase completa en markdown: explicación, ejemplos, puntos clave",
    ronda: 1
  };

  let respuesta;
  let ronda = 1;
  do {
    solicitud.ronda = ronda;
    respuesta = await procesarSolicitud(solicitud);
    ronda++;
  } while (respuesta.estado === "rechazado" && ronda <= MAX_RONDAS);

  const escalado = respuesta.estado !== "aceptado";

  await addDoc(collection(db, "solicitudes_agente"), {
    solicitud,
    respuestaIngeniero: respuesta,
    ronda: ronda - 1,
    resueltoEn: serverTimestamp(),
    escaladoAdmin: escalado
  });

  if (escalado) {
    return { ok: false, motivo: respuesta.detalle };
  }

  if (!plantilla) await guardarPlantilla("clase", tema, moduloId, respuesta.resultado);

  return guardarClaseEnModulo(moduloId, respuesta.resultado);
}

/** true si el perfil del estudiante pide algo distinto al contenido estándar guardado. */
function requiereAdaptacion(perfilEstudiante) {
  if (!perfilEstudiante) return false;
  const ritmo = perfilEstudiante.ritmo || "estandar";
  return ritmo !== "estandar" || Boolean(perfilEstudiante.notas);
}

async function registrarSolicitud(tipo, moduloId, tema, respuesta, ronda, escalado, plantillaId) {
  await addDoc(collection(db, "solicitudes_agente"), {
    solicitud: { tipo, moduloId, propositoPedagogico: tema, ronda: ronda || 1, fuentePlantilla: plantillaId || null },
    respuestaIngeniero: respuesta,
    ronda,
    resueltoEn: serverTimestamp(),
    escaladoAdmin: escalado
  });
}

async function guardarClaseEnModulo(moduloId, resultado) {
  const claseId = `${Date.now()}`;
  const nuevaClase = { id: claseId, ...resultado, orden: Date.now() };

  const moduloRef = doc(db, "modulos", moduloId);
  const moduloSnap = await getDoc(moduloRef);
  if (moduloSnap.exists()) {
    await updateDoc(moduloRef, { clases: arrayUnion(nuevaClase) });
  } else {
    await setDoc(moduloRef, {
      titulo: moduloId,
      orden: Date.now(),
      descripcion: "",
      clases: [nuevaClase]
    });
  }

  return { ok: true, claseId };
}

/**
 * Pide al Ingeniero un quiz para un módulo, negociando hasta MAX_RONDAS veces.
 * Si se acepta, lo guarda en `evaluaciones` y registra la negociación en
 * `solicitudes_agente`. Si no hay acuerdo tras MAX_RONDAS, marca escaladoAdmin.
 */
export async function solicitarQuiz(moduloId, propositoPedagogico, perfilEstudiante = null) {
  const plantilla = await buscarPlantilla("quiz", propositoPedagogico);

  if (plantilla && !requiereAdaptacion(perfilEstudiante)) {
    await incrementarUso("quiz", plantilla.id);
    await registrarSolicitud("quiz", moduloId, propositoPedagogico, {
      estado: "aceptado", detalle: `Reutilizada de plantilla existente (${plantilla.id}).`
    }, 0, false, plantilla.id);
    return guardarQuizComoEvaluacion(moduloId, plantilla.resultado);
  }

  const solicitud = {
    tipo: "quiz",
    moduloId,
    propositoPedagogico: plantilla
      ? `${propositoPedagogico}. Adaptar este banco de preguntas ya probado al perfil del estudiante: ${JSON.stringify(plantilla.resultado)}. Ajustes pedidos: ${JSON.stringify(perfilEstudiante)}.`
      : propositoPedagogico,
    formatoEsperado: "5 a 8 preguntas de selección múltiple con una respuesta correcta cada una",
    ronda: 1
  };

  let respuesta;
  let ronda = 1;
  do {
    solicitud.ronda = ronda;
    respuesta = await procesarSolicitud(solicitud);
    ronda++;
  } while (respuesta.estado === "rechazado" && ronda <= MAX_RONDAS);

  const escalado = respuesta.estado !== "aceptado";

  await addDoc(collection(db, "solicitudes_agente"), {
    solicitud,
    respuestaIngeniero: respuesta,
    ronda: ronda - 1,
    resueltoEn: serverTimestamp(),
    escaladoAdmin: escalado
  });

  if (escalado) {
    return { ok: false, motivo: respuesta.detalle };
  }

  if (!plantilla) await guardarPlantilla("quiz", propositoPedagogico, moduloId, respuesta.resultado);

  return guardarQuizComoEvaluacion(moduloId, respuesta.resultado);
}

async function guardarQuizComoEvaluacion(moduloId, resultado) {
  const evaluacionRef = await addDoc(collection(db, "evaluaciones"), {
    moduloId,
    tipo: "quiz",
    preguntas: resultado.preguntas.map((p, i) => ({ id: String(i), ...p })),
    generadaPor: "profesor-agente",
    creadaEn: serverTimestamp()
  });

  return { ok: true, evaluacionId: evaluacionRef.id };
}

/**
 * Perfil de enseñanza por estudiante — cómo decidió el Profesor enseñarle
 * específicamente a este estudiante (ritmo, refuerzo, notas). Vive dentro de
 * usuarios/{uid}.progreso.estiloEnsenanza, junto al resto del progreso.
 */
export async function obtenerPerfilEnsenanza(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return snap.data()?.progreso?.estiloEnsenanza || null;
}

export async function actualizarPerfilEnsenanza(uid, { ritmo, notas } = {}) {
  await updateDoc(doc(db, "usuarios", uid), {
    "progreso.estiloEnsenanza": {
      ritmo: ritmo || "estandar",
      notas: notas || "",
      actualizadoEn: serverTimestamp()
    }
  });
}

/**
 * Guarda el intento del estudiante, calcula el puntaje SIN exponer nunca las
 * respuestas correctas al cliente antes de tiempo (se comparan aquí, del lado
 * de la lógica del agente, tras recibir las respuestas del estudiante).
 */
export async function calificarIntento(uid, evaluacionId, preguntas, respuestasEstudiante) {
  const correctas = preguntas.filter(
    (p, i) => Number(respuestasEstudiante[i]) === Number(p.respuestaCorrectaIndex)
  ).length;
  const puntaje = correctas / preguntas.length;

  await addDoc(collection(db, "resultados"), {
    uid,
    evaluacionId,
    respuestasEstudiante,
    puntaje,
    fecha: serverTimestamp()
  });

  await actualizarProgreso(uid);
  return puntaje;
}

/**
 * Recalcula el promedio del estudiante a partir de TODOS sus resultados y decide,
 * según UMBRAL_CAPACITADO, si queda marcado como "capacitado". Esta es la única
 * regla que determina "capacitado" — auditable y no arbitraria por sesión.
 */
async function actualizarProgreso(uid) {
  const q = query(collection(db, "resultados"), where("uid", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const puntajes = snap.docs.map(d => d.data().puntaje);
  const promedio = puntajes.reduce((a, b) => a + b, 0) / puntajes.length;
  const capacitado = promedio >= UMBRAL_CAPACITADO;

  await updateDoc(doc(db, "usuarios", uid), {
    "progreso.puntajePromedio": promedio,
    "progreso.capacitado": capacitado
  });
}
