// Base de datos simulada para el MODO DE PRUEBA LOCAL. No es Firebase — vive en
// localStorage del navegador, solo para poder correr el proyecto con VSCode (Live
// Server o similar) y ver el comportamiento de los agentes ANTES de conectar
// credenciales reales. No usar esto en producción; los archivos de producción
// (public/js/*, sin "-local") no dependen de este archivo en absoluto.

const CLAVE = "academia_prueba_db_v1";

function leerTodo() {
  const crudo = localStorage.getItem(CLAVE);
  if (crudo) return JSON.parse(crudo);
  return semilla();
}

function guardarTodo(db) {
  localStorage.setItem(CLAVE, JSON.stringify(db));
}

function semilla() {
  const db = {
    usuarios: {
      "admin-prueba": {
        nombre: "Admin de prueba",
        email: "admin@prueba.local",
        rol: "admin",
        suscripcion: { estado: "activa", fechaInicio: Date.now() },
        progreso: { moduloActual: null, puntajePromedio: 0, capacitado: false }
      },
      "estudiante-prueba": {
        nombre: "Estudiante de prueba",
        email: "estudiante@prueba.local",
        rol: "estudiante",
        suscripcion: { estado: "activa", fechaInicio: Date.now() },
        progreso: { moduloActual: null, puntajePromedio: 0, capacitado: false }
      }
    },
    modulos: {},
    evaluaciones: {},
    resultados: {},
    solicitudes_agente: {},
    certificados: {},
    configuracion: {}
  };
  guardarTodo(db);
  return db;
}

export function reiniciarDatosDePrueba() {
  localStorage.removeItem(CLAVE);
  semilla();
}

// --- Sesión (reemplaza Firebase Auth en el modo de prueba) ---
export function iniciarSesionComo(uid) {
  localStorage.setItem("academia_prueba_sesion", uid);
}
export function cerrarSesion() {
  localStorage.removeItem("academia_prueba_sesion");
}
export function uidSesionActual() {
  return localStorage.getItem("academia_prueba_sesion");
}

// --- API estilo Firestore, reducida a lo que usan los agentes/páginas ---
function idAleatorio() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getDoc(coleccion, id) {
  const db = leerTodo();
  const data = db[coleccion]?.[id];
  return { exists: () => !!data, data: () => data, id };
}

export async function setDoc(coleccion, id, data, opts = {}) {
  const db = leerTodo();
  if (!db[coleccion]) db[coleccion] = {};
  db[coleccion][id] = opts.merge ? { ...(db[coleccion][id] || {}), ...data } : data;
  guardarTodo(db);
}

export async function updateDoc(coleccion, id, cambios) {
  const db = leerTodo();
  if (!db[coleccion]?.[id]) throw new Error(`No existe ${coleccion}/${id}`);
  // soporta claves con punto, ej. "progreso.puntajePromedio"
  for (const [clave, valor] of Object.entries(cambios)) {
    if (clave.includes(".")) {
      const [raiz, sub] = clave.split(".");
      db[coleccion][id][raiz] = db[coleccion][id][raiz] || {};
      db[coleccion][id][raiz][sub] = valor;
    } else {
      db[coleccion][id][clave] = valor;
    }
  }
  guardarTodo(db);
}

export async function addDoc(coleccion, data) {
  const db = leerTodo();
  if (!db[coleccion]) db[coleccion] = {};
  const id = idAleatorio();
  db[coleccion][id] = data;
  guardarTodo(db);
  return id;
}

export async function getDocs(coleccion, filtro = null) {
  const db = leerTodo();
  const entradas = Object.entries(db[coleccion] || {});
  const filtradas = filtro ? entradas.filter(([, d]) => filtro(d)) : entradas;
  return filtradas.map(([id, data]) => ({ id, data: () => data }));
}

export function arrayUnionLocal(arr, item) {
  return [...(arr || []), item];
}

export function marcaDeTiempo() {
  return { seconds: Math.floor(Date.now() / 1000) };
}
