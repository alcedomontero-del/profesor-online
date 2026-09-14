// Genera el PDF del certificado en el navegador (jsPDF, cargado por <script> en
// admin/dashboard.html) y lo sube a Cloudinary vía "unsigned upload" (no necesita
// exponer ninguna clave secreta desde el cliente — solo cloud name + upload preset,
// que el admin edita en public/js/cloudinaryConfig.js).

import { db } from "./firebase-config.js";
import {
  doc, getDoc, addDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_CONFIGURED } from "./cloudinaryConfig.js";

function obtenerConfigCloudinary() {
  if (!CLOUDINARY_CONFIGURED) {
    throw new Error("Cloudinary no está configurado. Edita public/js/cloudinaryConfig.js con tu cloud name y upload preset.");
  }
  return { cloudName: CLOUDINARY_CLOUD_NAME, uploadPreset: CLOUDINARY_UPLOAD_PRESET };
}

function construirPdf(nombreEstudiante, promedio) {
  // jsPDF se carga globalmente como window.jspdf.jsPDF
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdf.setFontSize(28);
  pdf.text("Certificado de capacitación", 148, 60, { align: "center" });
  pdf.setFontSize(16);
  pdf.text("Desarrollo Web Full Stack", 148, 75, { align: "center" });
  pdf.setFontSize(14);
  pdf.text(`Otorgado a: ${nombreEstudiante}`, 148, 100, { align: "center" });
  pdf.text(`Promedio general: ${Math.round(promedio * 100)}%`, 148, 112, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(`Emitido el ${new Date().toLocaleDateString("es-DO")}`, 148, 130, { align: "center" });

  return pdf.output("blob");
}

async function subirACloudinary(blob, { cloudName, uploadPreset }) {
  const formData = new FormData();
  formData.append("file", blob);
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
 * Genera el PDF, lo sube a Cloudinary y registra el certificado en Firestore.
 * Debe llamarse solo cuando el admin confirma que el estudiante está capacitado.
 */
export async function generarCertificado(uid, nombreEstudiante, promedio, emitidoPorUid) {
  const config = await obtenerConfigCloudinary();
  const blob = construirPdf(nombreEstudiante, promedio);
  const pdfUrl = await subirACloudinary(blob, config);

  const ref = await addDoc(collection(db, "certificados"), {
    uid,
    fechaEmision: serverTimestamp(),
    pdfUrl,
    emitidoPor: emitidoPorUid
  });

  return { certificadoId: ref.id, pdfUrl };
}
