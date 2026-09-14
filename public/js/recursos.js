// "Carpeta" de recursos por agente. No es una carpeta real del sistema operativo (una
// app web no tiene acceso al disco del usuario) — es un área de subida por agente:
// el admin sube un archivo, se guarda en Cloudinary + un registro en Firestore
// (recursos/{id}, con el campo "agente": "profesor" | "ingeniero"), y la UI de chat
// le avisa al agente correspondiente que el recurso existe, dentro de la conversación.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, addDoc, collection, getDocs, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

async function obtenerConfigCloudinary() {
  const snap = await getDoc(doc(db, "configuracion", "cloudinary"));
  if (!snap.exists()) throw new Error("Cloudinary no está configurado (panel admin).");
  const { cloudName, uploadPreset } = snap.data();
  if (!cloudName || !uploadPreset) throw new Error("Falta cloudName o uploadPreset en la configuración.");
  return { cloudName, uploadPreset };
}

async function subirArchivo(file, { cloudName, uploadPreset }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData
  });
  if (!resp.ok) throw new Error("Cloudinary rechazó la subida. Revisa el upload preset (debe ser 'unsigned').");
  const data = await resp.json();
  return data.secure_url;
}

/** agente: "profesor" | "ingeniero" */
export async function subirRecurso(agente, file, descripcion) {
  const config = await obtenerConfigCloudinary();
  const url = await subirArchivo(file, config);
  const ref = await addDoc(collection(db, "recursos"), {
    agente,
    nombre: file.name,
    descripcion: descripcion || "",
    url,
    subidoEn: serverTimestamp()
  });
  return { id: ref.id, nombre: file.name, url, descripcion: descripcion || "" };
}

/** Lista los recursos de un agente, más recientes primero. */
export async function listarRecursos(agente) {
  const q = query(collection(db, "recursos"), where("agente", "==", agente));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.subidoEn?.toMillis?.() || 0) - (a.subidoEn?.toMillis?.() || 0));
}

/**
 * Texto corto para inyectar en el prompt/contexto del agente al abrir su chat,
 * así "sabe" qué recursos tiene disponibles sin que el admin tenga que repetírselo.
 * Devuelve null si no hay ninguno (para no ensuciar el prompt con una lista vacía).
 */
export async function resumenRecursosParaPrompt(agente) {
  const recursos = await listarRecursos(agente);
  if (recursos.length === 0) return null;
  return recursos
    .map((r) => `- "${r.nombre}"${r.descripcion ? ` (${r.descripcion})` : ""}: ${r.url}`)
    .join("\n");
}
