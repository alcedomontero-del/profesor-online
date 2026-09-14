# Contrato de negociación Profesor ↔ Ingeniero

## Tipos de herramienta que el Profesor puede solicitar (alcance permitido)
- `clase`: contenido completo de una clase (explicación, ejemplos, puntos clave).
- `quiz`: banco de preguntas de selección múltiple para un módulo.
- `reto_codigo_autoevaluado`: reto con enunciado y rúbrica evaluada por el propio LLM
  (sin ejecución real de código en v1).
- `rubrica`: criterios de evaluación para un tipo de entrega.
- `caso_practico`: escenario/historia para contextualizar una evaluación.

Cualquier solicitud fuera de esta lista (ej. "crea un sistema de pagos") se rechaza
automáticamente antes de llegar al Ingeniero, con motivo "fuera de alcance permitido".

## Formato de solicitud (Profesor → Ingeniero)
```json
{
  "tipo": "clase | quiz | reto_codigo_autoevaluado | rubrica | caso_practico",
  "moduloId": "string",
  "propositoPedagogico": "qué se quiere lograr / evaluar",
  "formatoEsperado": "descripción del resultado esperado",
  "ronda": 1
}
```

## Formato de respuesta (Ingeniero → Profesor)
```json
{
  "estado": "aceptado | alternativa | rechazado",
  "detalle": "explicación técnica breve",
  "resultado": { /* JSON de la herramienta generada, si estado = aceptado o alternativa */ }
}
```

## Reglas de negociación
1. Máximo **3 rondas** por solicitud. Cada ronda incrementa `ronda`.
2. Si en la ronda 3 no hay `estado: "aceptado"`, se marca `escaladoAdmin: true` en
   `solicitudes_agente/{id}` y el administrador humano decide manualmente.
3. Todo intercambio se guarda en `solicitudes_agente/{id}` para auditoría (quién pidió
   qué, qué se generó, por qué se rechazó algo).
4. El Ingeniero nunca genera código de la aplicación (HTML/JS/CSS) como respuesta — solo
   JSON de contenido/configuración que la app ya sabe interpretar.

## Reutilización de plantillas (desde v10)

Antes de iniciar una negociación, el Profesor busca si ya existe una **plantilla**
(`plantillas_clase` / `plantillas_evaluacion`, ver `docs/firestore-schema.md`) para el
mismo tema. Si existe y el perfil de enseñanza del estudiante (`estiloEnsenanza`) no pide
nada distinto al contenido estándar, la reutiliza directamente — sin llamar al Ingeniero
ni a Gemini otra vez — y solo registra en `solicitudes_agente` que fue "reutilizada" (sin
consumir una ronda real de negociación). Si el perfil del estudiante sí pide algo distinto
(ritmo o notas particulares), la plantilla existente se pasa al Ingeniero como base a
adaptar, en vez de partir de cero. Esto es lo que hace que cada sesión sea más rápida a
medida que se acumulan temas ya trabajados, en vez de repetir siempre el mismo costo.
