import { signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

/**
 * Bloquea el acceso a una pantalla protegida (dashboard admin/estudiante,
 * chats) si el usuario autenticado todavía no confirmó su correo.
 *
 * Sin esto, alguien podría saltarse el aviso de "confirma tu correo" del
 * login navegando directo a una URL protegida: Firebase ya lo tiene
 * autenticado (crear la cuenta o iniciar sesión ya abre sesión) aunque no
 * haya hecho clic en el enlace de verificación.
 *
 * Cierra la sesión antes de redirigir para que quede fuera de verdad, no
 * solo visualmente — si vuelve a entrar desde "index.html" con la misma
 * cuenta sin confirmar, el propio flujo de login le ofrece reenviar el
 * correo (ver auth.js).
 *
 * Devuelve `true` si bloqueó el acceso (el código que llama debe cortar ahí
 * con `return`) o `false` si el correo ya está confirmado y puede continuar.
 */
export async function exigirCorreoVerificado(auth, user, rutaIndex = "../index.html") {
  if (user.emailVerified) return false;
  try {
    await signOut(auth);
  } catch (_) {
    // seguimos con el redirect igual aunque falle el signOut
  }
  window.location.href = `${rutaIndex}?verificar=1`;
  return true;
}
