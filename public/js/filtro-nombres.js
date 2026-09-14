/**
 * Filtro de nombres para el registro de estudiantes. Dos objetivos:
 * 1) Evitar que alguien se registre con un nombre que suplante un rol del
 *    sistema (admin, profesor, soporte, etc.), lo que podría confundir a
 *    otros estudiantes o al propio admin al leer el panel.
 * 2) Bloquear una lista base de palabras ofensivas comunes en español.
 *    No es exhaustiva ni incluye insultos graves o discriminatorios — es un
 *    filtro básico de primera línea, no un sistema de moderación completo.
 *
 * Se aplica aquí (cliente, para dar un mensaje de error claro) Y en
 * docs/firestore.rules (la que de verdad protege — un cliente modificado
 * podría saltarse esta función por completo).
 */

const PALABRAS_RESERVADAS = [
  "admin", "administrador", "administradora", "moderador", "moderadora",
  "moderator", "soporte", "support", "profesor", "profesora", "teacher",
  "ingeniero", "ingeniera", "sistema", "root", "superuser", "academia", "staff"
];

const PALABRAS_OFENSIVAS = [
  "puta", "puto", "putos", "putas", "mierda", "cabron", "cabrona",
  "pendejo", "pendeja", "gilipollas", "joder", "cono", "marica", "maricon",
  "hijueputa", "hijodeputa", "verga", "gonorrea", "malparido", "malparida"
];

const PALABRAS_BLOQUEADAS = [...PALABRAS_RESERVADAS, ...PALABRAS_OFENSIVAS];

function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos para no dejar pasar "Admín", "Cabrón", etc.
}

export function nombrePermitido(nombre) {
  const n = normalizar(nombre).trim();
  if (!n) return false;
  return !PALABRAS_BLOQUEADAS.some((palabra) => n.includes(palabra));
}
