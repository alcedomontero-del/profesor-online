// Chat conversacional con el agente Profesor. A diferencia de agente-profesor.js
// (que expone funciones que EL ADMIN dispara desde formularios), aquí es el propio
// modelo quien decide, dentro de la conversación, cuándo llamar a crear_clase o
// crear_quiz — usando "function calling" de Gemini. El Profesor decide la metodología;
// el admin solo conversa con él como lo haría con un profesor real.
//
// NOTA para quien retome esto: verifica en la documentación vigente de Firebase AI
// Logic que los nombres de métodos (startChat, sendMessage, functionCalls()) sigan
// igual — la API de function calling ha ido cambiando de forma across versiones.

import { crearModelo } from "./firebase-config.js";
import { solicitarClase, solicitarQuiz } from "./agente-profesor.js";
import { resumenRecursosParaPrompt } from "./recursos.js";

const declaracionesFunciones = [
  {
    name: "crear_clase",
    description:
      "Le pide al agente Ingeniero que genere el contenido completo de una clase " +
      "(explicación, ejemplos, puntos clave) para un módulo del curso, y la guarda. " +
      "Úsala cuando decidas que corresponde enseñar un tema nuevo — no describas la " +
      "clase en texto plano en el chat, créala con esta función.",
    parameters: {
      type: "OBJECT",
      properties: {
        moduloId: {
          type: "STRING",
          description: "Identificador corto y estable del módulo, minúsculas y guiones, ej. 'html-css-basico'."
        },
        tema: { type: "STRING", description: "Tema específico que debe cubrir la clase." }
      },
      required: ["moduloId", "tema"]
    }
  },
  {
    name: "crear_quiz",
    description:
      "Le pide al agente Ingeniero que genere un quiz de selección múltiple para " +
      "evaluar un módulo, y lo guarda.",
    parameters: {
      type: "OBJECT",
      properties: {
        moduloId: { type: "STRING", description: "Debe coincidir con el moduloId de la clase que evalúa." },
        proposito: { type: "STRING", description: "Qué debe evaluar el quiz específicamente." }
      },
      required: ["moduloId", "proposito"]
    }
  }
];

const INSTRUCCION_SISTEMA = `Eres el agente Profesor de una academia online de desarrollo
web, aplicaciones, agentes de IA e integración entre sistemas de IA. Eres un profesional
experimentado y hablas español de forma cercana pero profesional. Quien te escribe ahora
es el administrador/dueño de la academia — no un estudiante — así que puedes hablarle de
decisiones pedagógicas, planeación y avances, no solo de contenido de clase.

Tú decides la metodología: qué módulos enseñar, en qué orden, con qué profundidad, y
cuándo corresponde generar una clase o un quiz — ese criterio es tuyo como profesional,
nadie te va a dictar el formato exacto salvo que el administrador te pida algo puntual.

Cuando decidas que corresponde crear contenido, USA las funciones crear_clase y
crear_quiz — nunca describas el contenido de una clase directamente en el chat como si
ya existiera; si no llamaste a la función, no existe todavía.

Importante sobre tus límites técnicos: no tienes ningún servidor propio corriendo en
segundo plano. Solo puedes trabajar mientras esta pestaña del navegador esté abierta.
Si vas a generar varias clases seguidas (por ejemplo, diseñar un programa completo desde
cero), avísale primero al administrador cuántos pasos vas a hacer aproximadamente y
pídele explícitamente que mantenga esta pestaña abierta mientras trabajas — nunca asumas
que puedes seguir trabajando si él se desconecta.

Sobre recursos: el administrador puede subirte archivos de apoyo (guías, ejemplos,
material de referencia) desde el panel admin. Si más abajo ves una lista de "Recursos
disponibles", ya existen y puedes mencionarlos o basarte en ellos cuando sea relevante.
Si necesitas un recurso que no tienes, pídeselo explícitamente al administrador — nombra
qué tipo de archivo necesitas y para qué.`;

export async function crearChatProfesor(historialPrevio = []) {
  const recursos = await resumenRecursosParaPrompt("profesor");
  const instruccion = recursos
    ? `${INSTRUCCION_SISTEMA}\n\nRecursos disponibles que el administrador ya te subió:\n${recursos}`
    : INSTRUCCION_SISTEMA;

  const modelo = crearModelo({
    systemInstruction: instruccion,
    tools: [{ functionDeclarations: declaracionesFunciones }]
  });
  return modelo.startChat({ history: historialPrevio });
}

async function ejecutarFuncion(nombre, args) {
  if (nombre === "crear_clase") return solicitarClase(args.moduloId, args.tema);
  if (nombre === "crear_quiz") return solicitarQuiz(args.moduloId, args.proposito);
  return { ok: false, motivo: `Función desconocida: ${nombre}` };
}

const MAX_PASOS = 8; // límite de idas y vueltas función↔modelo por mensaje, para no gastar de más

/**
 * Envía un mensaje del admin al Profesor y resuelve automáticamente cualquier
 * llamada a función que el modelo pida (creando clases/quizzes reales de por medio),
 * devolviendo el control a la UI vía onEvento para cada paso: texto, acción, resultado.
 */
export async function enviarMensaje(chat, texto, onEvento) {
  let resultado = await chat.sendMessage(texto);
  let pasos = 0;

  while (pasos < MAX_PASOS) {
    const respuestaTexto = resultado.response.text();
    if (respuestaTexto) onEvento({ tipo: "texto", texto: respuestaTexto });

    const llamadas = resultado.response.functionCalls();
    if (!llamadas || llamadas.length === 0) break;

    const respuestasFuncion = [];
    for (const llamada of llamadas) {
      onEvento({ tipo: "accion", nombre: llamada.name, args: llamada.args });
      const r = await ejecutarFuncion(llamada.name, llamada.args);
      onEvento({ tipo: "resultado_accion", nombre: llamada.name, resultado: r });
      respuestasFuncion.push({ functionResponse: { name: llamada.name, response: r } });
    }

    resultado = await chat.sendMessage(respuestasFuncion);
    pasos++;
  }
}

/**
 * Investigación puntual con Grounding de Google Search (modelo aparte, SIN function
 * calling — combinar ambos tipos de tool no siempre es compatible). Se usa para que
 * el Profesor busque información actual antes de diseñar contenido.
 */
export async function investigarTema(tema) {
  const modeloInvestigador = crearModelo({ tools: [{ googleSearch: {} }] });
  const resultado = await modeloInvestigador.generateContent(
    `Investiga información vigente y relevante para diseñar, a nivel profesional, ` +
    `contenido educativo sobre: "${tema}". Resume en español, en 150-250 palabras, ` +
    `los puntos y buenas prácticas más importantes y actuales.`
  );
  return resultado.response.text();
}
