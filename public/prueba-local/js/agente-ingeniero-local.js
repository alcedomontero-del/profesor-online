// Versión de PRUEBA LOCAL del agente Ingeniero. Tiene el MISMO contrato que
// public/js/agente-ingeniero.js (mismos tipos permitidos, misma forma de respuesta),
// pero en vez de llamar a Gemini genera contenido de ejemplo con plantillas, para que
// puedas ver el flujo completo de negociación y de la app sin haber conectado Firebase
// AI Logic todavía. Cuando conectes credenciales reales, usa la versión real, no esta.

export const TIPOS_PERMITIDOS = [
  "clase",
  "quiz",
  "reto_codigo_autoevaluado",
  "rubrica",
  "caso_practico"
];

function generarQuizDeEjemplo(tema) {
  const preguntas = [];
  for (let i = 1; i <= 5; i++) {
    preguntas.push({
      enunciado: `[Pregunta de ejemplo ${i}] Sobre "${tema}", ¿cuál opción es correcta?`,
      opciones: [
        `Opción A (correcta) relacionada con ${tema}`,
        `Opción B — distractor plausible`,
        `Opción C — distractor plausible`,
        `Opción D — distractor plausible`
      ],
      respuestaCorrectaIndex: 0
    });
  }
  return { preguntas };
}

function generarClaseDeEjemplo(tema) {
  return {
    titulo: `Introducción a: ${tema}`,
    contenido:
      `[Contenido de ejemplo generado en modo prueba, sin Gemini real]\n\n` +
      `Esta clase cubriría "${tema}" con una explicación paso a paso, un ejemplo de ` +
      `código ilustrativo, y un resumen de los puntos clave al final.\n\n` +
      `Ejemplo:\n// código de ejemplo sobre ${tema}\n\n` +
      `Puntos clave:\n- Concepto 1 de ${tema}\n- Concepto 2 de ${tema}\n- Buenas prácticas comunes`
  };
}

function generarTextoLibreDeEjemplo(tipo, tema) {
  const encabezados = {
    reto_codigo_autoevaluado: "Reto de código (ejemplo)",
    rubrica: "Rúbrica de evaluación (ejemplo)",
    caso_practico: "Caso práctico (ejemplo)"
  };
  return {
    contenido:
      `[${encabezados[tipo] || tipo} — contenido de ejemplo, modo prueba]\n\n` +
      `Generado para el propósito: "${tema}". Esto es un placeholder para validar el ` +
      `flujo de negociación Profesor↔Ingeniero; el contenido real vendrá de Gemini ` +
      `una vez conectes Firebase AI Logic.`
  };
}

/**
 * Misma firma que la versión real: recibe la solicitud, devuelve
 * { estado, detalle, resultado? }. Nunca falla por red porque no llama a ningún API.
 */
export async function procesarSolicitud(solicitud) {
  if (!TIPOS_PERMITIDOS.includes(solicitud.tipo)) {
    return {
      estado: "rechazado",
      detalle: `Tipo "${solicitud.tipo}" fuera del alcance permitido. Tipos válidos: ${TIPOS_PERMITIDOS.join(", ")}.`
    };
  }

  // pequeña espera simulada para que se note visualmente la "negociación"
  await new Promise((r) => setTimeout(r, 400));

  let resultado;
  if (solicitud.tipo === "quiz") resultado = generarQuizDeEjemplo(solicitud.propositoPedagogico);
  else if (solicitud.tipo === "clase") resultado = generarClaseDeEjemplo(solicitud.propositoPedagogico);
  else resultado = generarTextoLibreDeEjemplo(solicitud.tipo, solicitud.propositoPedagogico);

  return { estado: "aceptado", detalle: "Generado (modo prueba, contenido de ejemplo).", resultado };
}
