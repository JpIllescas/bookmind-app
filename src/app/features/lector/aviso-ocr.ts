export interface AvisoOcr {
  paginas: number;
  total: number;
  dudosas: number;
}

/** Con menos páginas que esto, el OCR fue solo la portada o una hoja suelta: no vale la pena avisar. */
const PAGINAS_MINIMAS = 3;
const FRACCION_MINIMA = 0.1;

/** Avisa solo si el OCR pesa en el libro o si alguna página quedó con baja calidad. */
export function avisoOcr(paginasOcr: number, total: number, dudosas: number): AvisoOcr | null {
  if (paginasOcr <= 0) return null;
  const pesa = paginasOcr >= PAGINAS_MINIMAS && paginasOcr >= Math.ceil(total * FRACCION_MINIMA);
  return pesa || dudosas > 0 ? { paginas: paginasOcr, total, dudosas } : null;
}
