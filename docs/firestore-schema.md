# Esquema de Firestore

## `usuarios/{uid}`
```
nombre: string                   // filtrado al registrarse: sin nombres reservados del
                                  // sistema (admin, profesor, soporte...) ni palabras
                                  // ofensivas comunes (validado en auth.js Y en
                                  // firestore.rules — función nombrePermitido())
email: string                    // debe terminar en @gmail.com o @outlook.com (validado
                                  // en auth.js Y en firestore.rules al crear el documento)
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
    notas: string                // se renderiza en admin/dashboard.js con escapeAtributo()
    actualizadoEn: timestamp
  }
}
creadoEn: timestamp
```
El estudiante solo puede modificar su propio documento (incluido `progreso`) si su
correo está confirmado — `request.auth.token.email_verified == true` en
`firestore.rules` — además de no poder tocar `suscripcion` ni `rol`. La confirmación de
correo (`sendEmailVerification` / `emailVerified`) la maneja Firebase Authentication
directamente y no se guarda como campo aparte en este documento.

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
tema: string                     // texto original, tal cual lo escribió el Profesor/admin
temaNormalizado: string          // normalizado (sin acentos/mayúsculas) — es el campo por
                                  // el que se consulta con `where` en buscarPlantilla();
                                  // requiere coincidencia EXACTA, ya no por substring
moduloOrigenId: string           // en qué módulo se generó por primera vez
resultado: object                // el mismo JSON que devuelve el Ingeniero (clase o quiz)
usos: number                     // cuántas veces se ha reutilizado (prioriza la más probada)
creadaEn: timestamp
```
Solo el admin puede leer estas dos colecciones (`plantillas_evaluacion` guarda la
respuesta correcta de cada pregunta, igual que `evaluaciones`).
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
