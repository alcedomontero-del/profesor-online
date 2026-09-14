import * as bd from "./db-local.js";
import { solicitarClase, solicitarQuiz } from "./agente-profesor-local.js";

// Chat de PRUEBA: no usa Gemini. Reconoce intención con reglas simples (regex) para
// que puedas ver el mismo comportamiento (el Profesor decide y llama a crear
// clase/quiz por su cuenta) sin haber conectado Firebase AI Logic todavía.

function slug(texto) {
  return texto.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "modulo";
}

export async function generarRespuestaLocal(mensajeUsuario, contexto, onEvento) {
  const texto = mensajeUsuario.toLowerCase();

  const matchClase = texto.match(/clase (?:sobre|de) (.+)/i);
  const matchQuiz = texto.match(/quiz (?:sobre|de) (.+)/i);
  const matchAdelante = /^(adelante|s[ií]|dale|hazlo|procede)/i.test(texto.trim());

  if (matchClase) {
    const tema = matchClase[1].trim();
    const moduloId = slug(tema);
    onEvento({ tipo: "accion", texto: `📘 Creando clase — módulo "${moduloId}": ${tema}` });
    const r = await solicitarClase(moduloId, tema);
    onEvento({ tipo: "resultado", texto: r.ok ? "✅ Listo, guardado." : `⚠️ No se logró: ${r.motivo}` });
    onEvento({ tipo: "texto", texto: `Ya generé la clase de "${tema}". ¿Quiero que le arme un quiz también, o seguimos con otro tema?` });
    return;
  }

  if (matchQuiz) {
    const tema = matchQuiz[1].trim();
    const moduloId = slug(tema);
    onEvento({ tipo: "accion", texto: `📝 Creando quiz — módulo "${moduloId}": ${tema}` });
    const r = await solicitarQuiz(moduloId, tema);
    onEvento({ tipo: "resultado", texto: r.ok ? "✅ Listo, guardado." : `⚠️ No se logró: ${r.motivo}` });
    onEvento({ tipo: "texto", texto: `Quiz de "${tema}" listo.` });
    return;
  }

  if (matchAdelante && contexto.esperandoConfirmacionPrograma) {
    const programa = [
      { modulo: "fundamentos-web", tema: "HTML, CSS y el modelo de caja" },
      { modulo: "javascript-basico", tema: "Fundamentos de JavaScript y el DOM" }
    ];
    onEvento({ tipo: "texto", texto: `Perfecto, voy a diseñar ${programa.length} módulos de ejemplo. Mantén esta pestaña abierta mientras trabajo, esto toma unos segundos por paso.` });
    for (const paso of programa) {
      onEvento({ tipo: "accion", texto: `📘 Creando clase — módulo "${paso.modulo}": ${paso.tema}` });
      const rc = await solicitarClase(paso.modulo, paso.tema);
      onEvento({ tipo: "resultado", texto: rc.ok ? "✅ Clase guardada." : `⚠️ ${rc.motivo}` });

      onEvento({ tipo: "accion", texto: `📝 Creando quiz — módulo "${paso.modulo}"` });
      const rq = await solicitarQuiz(paso.modulo, paso.tema);
      onEvento({ tipo: "resultado", texto: rq.ok ? "✅ Quiz guardado." : `⚠️ ${rq.motivo}` });
    }
    onEvento({ tipo: "texto", texto: "Listo, ya puedes revisar el resultado en el dashboard del estudiante. Cuando quieras seguimos con más módulos." });
    return;
  }

  onEvento({
    tipo: "texto",
    texto:
      "Soy el Profesor (modo prueba, sin IA real todavía). Puedes decirme cosas como " +
      '"crea una clase sobre closures en JavaScript" o "crea un quiz sobre flexbox", ' +
      "y yo mismo lo genero y lo guardo — igual que haría el Profesor real."
  });
}
