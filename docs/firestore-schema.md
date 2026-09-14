# Esquema de Firestore

## `usuarios/{uid}`
```
nombre: string
email: string
rol: "estudiante" | "admin"
suscripcion: {
  estado: "activa" | "inactiva" | "pausada"
  fechaInicio: timestamp
}
progreso: {
  moduloActual: string           // referencia a modulos/{id}
  puntajePromedio: number
  capacitado: boolean            // lo decide el Profesor según reglas
  estiloEnsenanza: {              // cómo decidió el Profesor enseñarle A ESTE estudiante
    ritmo: "estandar" | "lento" | "acelerado"
    notas: string
    actualizadoEn: timestamp
  }
}
creadoEn: timestamp
```

## `modulos/{moduloId}`
```
titulo: string
orden: number
descripcion: string
clases: [                        // subcolección modulos/{id}/clases o array embebido
  { id, titulo, contenido, mediaUrl (Cloudinary), orden }
]
```

## `evaluaciones/{evaluacionId}`
```
moduloId: string
tipo: "quiz" | "reto_codigo"
preguntas: [
  {
    id, enunciado,
    opciones: [string],
    respuestaCorrectaIndex: number   // NUNCA legible por el cliente estudiante, ver reglas
  }
]
generadaPor: "profesor-agente"
creadaEn: timestamp
```

## `resultados/{resultadoId}`
```
uid: string                      // estudiante
evaluacionId: string
respuestasEstudiante: [number]
puntaje: number
fecha: timestamp
```
Solo el estudiante dueño y el admin pueden leer. Solo la lógica del agente
(vía Cloud Function o regla validada) puede escribir el puntaje.

## `solicitudes_agente/{solicitudId}`
Log de negociación Profesor ↔ Ingeniero, para auditoría.
```
solicitud: {
  tipo: string,                  // ej. "reto_codigo", "quiz_extra"
  propositoPedagogico: string,
  formatoEsperado: string
}
respuestaIngeniero: {
  estado: "aceptado" | "alternativa" | "rechazado",
  detalle: string
}
ronda: number                    // máx 3
resueltoEn: timestamp | null
escaladoAdmin: boolean
```

## `certificados/{certificadoId}`
```
uid: string
fechaEmision: timestamp
pdfUrl: string                   // Cloudinary
emitidoPor: string                // uid del admin
```

## `configuracion/donaciones`
```
paypalLink: string               // editable solo por admin
```

## `plantillas_clase/{id}` y `plantillas_evaluacion/{id}`
Contenido ya generado y aceptado por el Ingeniero, guardado para REUTILIZAR en vez de
regenerar desde cero cada vez que el mismo tema se repite (otro módulo, otro estudiante).
Ver `public/js/plantillas.js`.
```
tema: string                     // texto libre, se compara normalizado (sin acentos/mayúsculas)
moduloOrigenId: string           // en qué módulo se generó por primera vez
resultado: object                // el mismo JSON que devuelve el Ingeniero (clase o quiz)
usos: number                     // cuántas veces se ha reutilizado (prioriza la más probada)
creadaEn: timestamp
```
El Profesor busca por tema antes de negociar con el Ingeniero (`buscarPlantilla`); si
encuentra una y el perfil del estudiante no pide algo distinto (`estiloEnsenanza`), la
reutiliza directamente. Si el perfil sí pide algo distinto, se le pasa al Ingeniero como
base a adaptar (no se descarta, se ahorra igual el diseño desde cero).

## `recursos/{id}`
Archivos que el administrador sube para un agente específico (no es una carpeta del
sistema operativo — ver `public/js/recursos.js`). El agente correspondiente ve un resumen
de estos recursos en su instrucción de sistema al abrir su chat.
```
agente: "profesor" | "ingeniero"
nombre: string
descripcion: string
url: string                      // Cloudinary
subidoEn: timestamp
```
