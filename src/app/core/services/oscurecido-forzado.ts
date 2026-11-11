/** Un color `rgb(...)` más cerca del negro que del blanco; lo que no se entiende no cuenta. */
export function esColorOscuro(color: string): boolean {
  const partes = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  if (!partes) return false;
  return (Number(partes[1]) + Number(partes[2]) + Number(partes[3])) / 3 < 128;
}

/** Algunos navegadores (Samsung Internet, Chrome con tema oscuro automático) repintan en oscuro una página clara y le cambian los colores. */
export function navegadorOscureceLaPagina(documento: Document = document): boolean {
  try {
    // El lienzo de un elemento claro es blanco; si sale oscuro, el navegador está forzando el modo oscuro.
    const sonda = documento.createElement('div');
    sonda.style.cssText = 'display:none;color-scheme:light;background-color:Canvas';
    documento.documentElement.appendChild(sonda);
    const fondo = getComputedStyle(sonda).backgroundColor;
    sonda.remove();
    return esColorOscuro(fondo);
  } catch {
    return false;
  }
}
