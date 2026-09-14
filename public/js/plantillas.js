// Plantillas reutilizables
// Responsabilidad única: guardar y recuperar el contenido ya generado por el Ingeniero
// (clases y quizzes) para que el Profesor NO tenga que negociar/generar desde cero cada
// vez que un tema se repite entre módulos o estudiantes. Esto hace que cada sesión sea
// más rápida a medida que se acumulan plantillas, en vez de repetir siempre el mismo
// trabajo. Ver docs/CONTINUACION.md, sección "Reutilización de plantillas".

import { db } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, doc, getDocs, query, where, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const COLECCION = {
  clase: "plantillas_clase",
  quiz: "plantillas_evaluacion"
};

/** Normaliza un texto para comparar temas sin importar mayúsculas/acentos/espacios. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca una plantilla ya existente para este tipo + tema EXACTO (normalizado).
 * Antes esto comparaba por "contención" (pNorm.includes(temaNorm) o viceversa) y
 * traía la colección completa con getDocs() sin filtro — dos problemas reales:
 * 1) un tema nuevo como "CSS Grid" podía reutilizar por error la plantilla de "CSS"
 *    a secas (o viceversa), porque uno contiene al otro como substring;
 * 2) el costo en lecturas de Firestore crecía sin límite con cada plantilla nueva
 *    acumulada, justo lo opuesto a la meta de ahorrar con el tiempo.
 * Ahora se exige coincidencia exacta del texto normalizado y se consulta con
 * `where` (Firestore solo lee los documentos que calzan, no la colección entera).
 * Costo: menos reutilización automática para frases parecidas pero no idénticas
 * (ej. "css" y "css grid" ya NO comparten plantilla) — es el trade-off correcto:
 * mejor generar de más una vez que enseñar contenido equivocado por una coincidencia
 * de texto casual.
 */
export async function buscarPlantilla(tipo, tema) {
  const nombreColeccion = COLECCION[tipo];
  if (!nombreColeccion) return null;

  const temaNorm = normalizar(tema);
  const q = query(collection(db, nombreColeccion), where("temaNormalizado", "==", temaNorm));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const candidatas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  candidatas.sort((a, b) => (b.usos || 0) - (a.usos || 0));
  return candidatas[0];
}

/** Guarda el resultado aceptado por el Ingeniero como plantilla reutilizable. */
export async function guardarPlantilla(tipo, tema, moduloOrigenId, resultado) {
  const nombreColeccion = COLECCION[tipo];
  if (!nombreColeccion) return null;

  const ref = await addDoc(collection(db, nombreColeccion), {
    tema,
    temaNormalizado: normalizar(tema), // usado por buscarPlantilla() para la consulta exacta
    moduloOrigenId,
    resultado,
    usos: 1,
    creadaEn: serverTimestamp()
  });
  return ref.id;
}

/** Marca que una plantilla se volvió a reutilizar (para priorizar las más probadas). */
export async function incrementarUso(tipo, plantillaId) {
  const nombreColeccion = COLECCION[tipo];
  if (!nombreColeccion || !plantillaId) return;
  await updateDoc(doc(db, nombreColeccion, plantillaId), { usos: increment(1) });
}
