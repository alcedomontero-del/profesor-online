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
 * Busca una plantilla ya existente para este tipo + tema. Coincidencia por texto
 * normalizado exacto o por contención (para no exigir el mismo texto letra por letra).
 * Devuelve la plantilla más usada si hay varias parecidas, o null si no hay ninguna.
 */
export async function buscarPlantilla(tipo, tema) {
  const nombreColeccion = COLECCION[tipo];
  if (!nombreColeccion) return null;

  const snap = await getDocs(collection(db, nombreColeccion));
  if (snap.empty) return null;

  const temaNorm = normalizar(tema);
  const candidatas = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => {
      const pNorm = normalizar(p.tema || "");
      return pNorm === temaNorm || pNorm.includes(temaNorm) || temaNorm.includes(pNorm);
    });

  if (candidatas.length === 0) return null;
  candidatas.sort((a, b) => (b.usos || 0) - (a.usos || 0));
  return candidatas[0];
}

/** Guarda el resultado aceptado por el Ingeniero como plantilla reutilizable. */
export async function guardarPlantilla(tipo, tema, moduloOrigenId, resultado) {
  const nombreColeccion = COLECCION[tipo];
  if (!nombreColeccion) return null;

  const ref = await addDoc(collection(db, nombreColeccion), {
    tema,
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
