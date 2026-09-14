// Agente Ingeniero
// Responsabilidad única: recibir una SOLICITUD estructurada del Profesor y devolver
// una RESPUESTA con estado aceptado/alternativa/rechazado + el JSON de la herramienta.
// El Ingeniero NUNCA genera código de la app (HTML/JS/CSS), solo contenido/datos.
// Ver docs/contrato-agentes.md para el contrato completo.

import { crearModelo } from "./firebase-config.js";
import { Schema } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-ai.js";
import { resumenRecursosParaPrompt } from "./recursos.js";

export const TIPOS_PERMITIDOS = [
  "clase",
  "quiz",
  "reto_codigo_autoevaluado",
  "rubrica",
  "caso_practico"
];

// Esquema de salida para un quiz de selección múltiple.
const esquemaQuiz = Schema.object({
  properties: {
    preguntas: Schema.array({
      items: Schema.object({
        properties: {
          enunciado: Schema.string(),
          opciones: Schema.array({ items: Schema.string() }),
          respuestaCorrectaIndex: Schema.number()
        }
      })
    })
  }
});

const esquemaClase = Schema.object({
  properties: {
    titulo: Schema.string(),
    contenido: Schema.string() // markdown simple, sin HTML embebido
  }
});

function esquemaPara(tipo) {
  if (tipo === "quiz") return esquemaQuiz;
  if (tipo === "clase") return esquemaClase;
  return null; // reto_codigo_autoevaluado, rubrica, caso_practico: texto libre estructurado por prompt
}

/**
 * Procesa una solicitud del Profesor. Devuelve:
 * { estado: "aceptado" | "alternativa" | "rechazado", detalle: string, resultado?: object }
 */
export async function procesarSolicitud(solicitud) {
  if (!TIPOS_PERMITIDOS.includes(solicitud.tipo)) {
    return {
      estado: "rechazado",
      detalle: `Tipo "${solicitud.tipo}" fuera del alcance permitido. Tipos válidos: ${TIPOS_PERMITIDOS.join(", ")}.`
    };
  }

  const esquema = esquemaPara(solicitud.tipo);
  const modelConfig = esquema
    ? { generationConfig: { responseMimeType: "application/json", responseSchema: esquema } }
    : {};
  const modelo = crearModelo(modelConfig);

  const recursos = await resumenRecursosParaPrompt("ingeniero");
  const prompt = construirPrompt(solicitud, recursos);

  try {
    const respuesta = await modelo.generateContent(prompt);
    const texto = respuesta.response.text();
    const resultado = esquema ? JSON.parse(texto) : { contenido: texto };
    return { estado: "aceptado", detalle: "Generado según lo solicitado.", resultado };
  } catch (err) {
    return {
      estado: "rechazado",
      detalle: `No se pudo generar la herramienta: ${err.message || "error del modelo"}.`
    };
  }
}

function construirPrompt(solicitud, recursos) {
  const base = `Eres el agente Ingeniero de una academia de desarrollo web full stack.
Tu única función es generar contenido pedagógico en el formato solicitado, en español,
para el módulo "${solicitud.moduloId}". Propósito pedagógico: ${solicitud.propositoPedagogico}.
Formato esperado: ${solicitud.formatoEsperado}.${recursos ? `

Tienes estos recursos de referencia subidos por el administrador — úsalos como base o
inspiración si son relevantes para esta solicitud:
${recursos}` : ""}`;

  switch (solicitud.tipo) {
    case "clase":
      return `${base}
Genera el contenido de una clase completa sobre el tema indicado: explicación clara,
ejemplos de código cuando aplique, y un cierre con los puntos clave. Formato: markdown
simple (sin HTML embebido). Extensión moderada, apta para leer en una sesión de estudio.`;
    case "quiz":
      return `${base}
Genera entre 5 y 8 preguntas de selección múltiple (4 opciones cada una, una sola correcta)
sobre el tema indicado. No repitas preguntas. Nivel de dificultad progresivo.`;
    case "reto_codigo_autoevaluado":
      return `${base}
Genera un reto de código breve (enunciado + criterios de evaluación en texto, sin ejecutar
código) que el propio agente Profesor pueda calificar leyendo lo que el estudiante escriba.`;
    case "rubrica":
      return `${base}
Genera una rúbrica de evaluación en texto (criterios + niveles de desempeño) para calificar
entregas de este módulo.`;
    case "caso_practico":
      return `${base}
Genera un caso/escenario práctico breve que sirva de contexto para una evaluación de este módulo.`;
    default:
      return base;
  }
}
