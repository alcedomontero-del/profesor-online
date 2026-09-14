// Sube un archivo (imagen o video) de una clase a Cloudinary y lo adjunta a la clase
// correspondiente dentro de modulos/{moduloId}.clases. Reutiliza la misma config
// de Cloudinary que certificados.js (configuracion/cloudinary, unsigned upload).

import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

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

/**
 * Sube el archivo y actualiza la clase indicada dentro del módulo con su mediaUrl.
 * Reescribe el array `clases` completo (Firestore no permite actualizar un elemento
 * de un array por índice/condición directamente).
 */
export async function adjuntarMediaAClase(moduloId, claseId, file) {
  const config = await obtenerConfigCloudinary();
  const mediaUrl = await subirArchivo(file, config);

  const moduloRef = doc(db, "modulos", moduloId);
  const moduloSnap = await getDoc(moduloRef);
  if (!moduloSnap.exists()) throw new Error(`El módulo "${moduloId}" no existe.`);

  const data = moduloSnap.data();
  const clases = (data.clases || []).map((c) =>
    c.id === claseId ? { ...c, mediaUrl } : c
  );
  if (!clases.some((c) => c.id === claseId)) {
    throw new Error(`No se encontró la clase "${claseId}" en el módulo "${moduloId}".`);
  }

  await setDoc(moduloRef, { ...data, clases }, { merge: true });
  return mediaUrl;
}
