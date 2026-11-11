/** Página donde se retoma un libro: la última a la que llegó el avance guardado. */
export function paginaDeReanudacion(progreso: number, paginas: number): number {
  // Sin avance se empieza por el principio; un libro terminado se relee desde la primera.
  if (!(paginas > 0) || !(progreso > 0) || progreso >= 100) return 1;

  return Math.min(Math.max(Math.round((progreso / 100) * paginas), 1), paginas);
}
