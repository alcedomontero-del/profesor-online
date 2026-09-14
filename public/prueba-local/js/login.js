import { iniciarSesionComo, reiniciarDatosDePrueba } from "./db-local.js";

document.getElementById("btn-estudiante").addEventListener("click", () => {
  iniciarSesionComo("estudiante-prueba");
  window.location.href = "estudiante.html";
});

document.getElementById("btn-admin").addEventListener("click", () => {
  iniciarSesionComo("admin-prueba");
  window.location.href = "admin.html";
});

document.getElementById("btn-reiniciar").addEventListener("click", () => {
  reiniciarDatosDePrueba();
  alert("Datos de prueba reiniciados.");
});
