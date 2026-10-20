/** Mensajes del lector según lo que falló, en vez de un "intenta subirlo" para todo. */

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
const SIN_ALMACENAMIENTO =
  'El almacenamiento de libros no está disponible en este momento. Intenta de nuevo en unos minutos.';
const ARCHIVO_PERDIDO = 'No encontramos el archivo de este libro. Bórralo de tu biblioteca y vuelve a subirlo.';
const LIBRO_INEXISTENTE = 'No encontramos este libro: puede que se haya borrado. Vuelve a tu biblioteca para elegir otro.';
const PDF_DANADO = 'No pudimos mostrar este PDF: el archivo parece dañado. Bórralo y vuelve a subirlo.';
const PROCESO_FALLIDO = 'No pudimos procesar este libro. Bórralo de tu biblioteca y vuelve a subirlo.';
const GENERICO = 'No pudimos abrir el libro. Intenta de nuevo en un momento.';

/** El backend ya manda oraciones para el estudiante; se usan tal cual cuando vienen. */
function mensajeDelServidor(error: unknown): string | null {
  const mensaje = (error as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof mensaje === 'string' && mensaje.trim() ? mensaje.trim() : null;
}

/** Al pedir los datos del libro (HttpErrorResponse de Angular). */
export function mensajeAlCargarLibro(error: unknown): string {
  const estado = (error as { status?: number } | null)?.status;
  if (estado === 0) return SIN_CONEXION;
  if (estado === 404) return LIBRO_INEXISTENTE;
  return mensajeDelServidor(error) ?? (estado === 503 ? SIN_ALMACENAMIENTO : GENERICO);
}

/** Al abrir el PDF con pdf.js, que no deja leer el cuerpo de la respuesta: solo el estado y el tipo de error. */
export function mensajeAlAbrirPdf(error: unknown): string {
  const { name = '', status } = (error ?? {}) as { name?: string; status?: number };
  if (name === 'InvalidPDFException') return PDF_DANADO;
  if (status === 404 || name === 'MissingPDFException') return ARCHIVO_PERDIDO;
  if (status === 503) return SIN_ALMACENAMIENTO;
  if (status === 0) return SIN_CONEXION;
  return GENERICO;
}

/**
 * Un libro que quedó en "failed". El motivo guardado puede ser el error crudo de
 * una librería: como en el filtro del backend, solo se muestra si es una oración.
 */
export function mensajeLibroFallido(motivo: string | null | undefined): string {
  const limpio = motivo?.trim() ?? '';
  return /[.!?]$/.test(limpio) ? limpio : PROCESO_FALLIDO;
}
