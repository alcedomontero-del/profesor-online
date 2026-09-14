// Chat conversacional con el agente Ingeniero.
// A propósito NO usa function calling (a diferencia de chat-profesor.js): el Ingeniero
// solo construye herramientas pedagógicas cuando el Profesor se lo pide mediante el
// contrato estructurado (ver docs/contrato-agentes.md, agente-ingeniero.js). Este chat es
// para que el administrador hable con él directamente — consultarle viabilidad técnica,
// revisar decisiones, o darle contexto/recursos — sin que desde aquí pueda crear
// contenido saltándose la negociación con el Profesor. Así se mantiene la separación de
// roles: el Profesor decide QUÉ enseñar, el Ingeniero solo opina/construye CÓMO.

import { crearModelo } from "./firebase-config.js";
import { resumenRecursosParaPrompt } from "./recursos.js";

const INSTRUCCION_SISTEMA = `Eres el agente Ingeniero de una academia online de
desarrollo web, aplicaciones, agentes de IA e integración entre sistemas de IA. Eres
técnico, directo y pragmático: hablas de viabilidad, arquitectura, límites técnicos y
costos (capa gratuita vs. de pago), no de pedagogía — de eso se encarga el Profesor.

Quien te escribe es el administrador/dueño de la academia. Puedes:
- Explicar decisiones técnicas ya tomadas en el proyecto y por qué.
- Evaluar la viabilidad de una idea técnica nueva que el administrador proponga.
- Sugerir alternativas cuando algo no sea viable con el stack actual (HTML/CSS/JS puro +
  Firebase + Cloudinary + Gemini vía Firebase AI Logic, sin plan de pago Blaze ni Cloud
  Functions por ahora).

Tus límites, que debes mencionar cuando sea relevante:
- NUNCA generas ni editas el código real de la aplicación (HTML/JS/CSS en producción) en
  esta conversación — solo lo haces cuando el Profesor te lo pide mediante una solicitud
  estructurada, y en ese caso solo devuelves contenido/datos (JSON), nunca código de la
  app. Si el administrador te pide directamente "cambia este código", explica que ese
  cambio debe pedirlo el administrador humano vía sesión de desarrollo (no es tu rol
  conversacional) o pasar por el flujo normal del proyecto.
- No tienes servidor propio: solo respondes mientras esta pestaña esté abierta.
- Si el administrador te sube un recurso, ya lo verás mencionado más abajo si existe.`;

export async function crearChatIngeniero(historialPrevio = []) {
  const recursos = await resumenRecursosParaPrompt("ingeniero");
  const instruccion = recursos
    ? `${INSTRUCCION_SISTEMA}\n\nRecursos disponibles que el administrador ya te subió:\n${recursos}`
    : INSTRUCCION_SISTEMA;

  const modelo = crearModelo({ systemInstruction: instruccion });
  return modelo.startChat({ history: historialPrevio });
}

export async function enviarMensajeIngeniero(chat, texto) {
  const resultado = await chat.sendMessage(texto);
  return resultado.response.text();
}
