/** Qué falta llenar antes de enviar; null si el formulario está completo. */
export function mensajeDeCamposVacios(
  modo: 'entrar' | 'registrar',
  campos: { email: string; password: string; nombre: string },
): string | null {
  if (modo === 'registrar' && !campos.nombre.trim()) return 'Escribe tu nombre para crear la cuenta.';
  if (!campos.email.trim() && !campos.password) return 'Escribe tu correo y tu contraseña.';
  if (!campos.email.trim()) return 'Escribe tu correo.';
  if (!campos.password) return 'Escribe tu contraseña.';
  return null;
}
