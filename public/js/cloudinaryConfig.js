// Datos de tu cuenta de Cloudinary, usados para subir fotos y videos de las clases
// (media.js), recursos de los agentes (recursos.js) y los PDF de certificados
// (certificados.js). Cloudinary es donde se guardan esos archivos — la app no los
// guarda en Firebase.
// Los obtienes gratis en https://cloudinary.com — ver docs/INSTALACION.md, sección 5,
// para el paso a paso completo (crear cuenta, crear el "upload preset" sin firmar y
// copiar aquí el cloud name).

export const CLOUDINARY_CLOUD_NAME = "kv4gbmx0";
export const CLOUDINARY_UPLOAD_PRESET = "profesor-online";

export const CLOUDINARY_CONFIGURED =
  CLOUDINARY_CLOUD_NAME !== "kv4gbmx0" &&
  CLOUDINARY_UPLOAD_PRESET !== "profesor-online";
