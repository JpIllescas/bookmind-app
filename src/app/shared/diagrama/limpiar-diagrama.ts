import type { Diagrama, NodoDiagrama } from './diagrama';

const PAGINA_EN_ETIQUETA = /\s*\((?:p[áa]g(?:ina)?s?\.?|p\.)\s*(\d+)[^)]*\)\s*/i;
const NUMERACION = /^\s*\d{1,2}\s*[.)-]\s+/;

/**
 * Los diagramas del chat llegan con "1. El Rey (pág. 16)": la numeración sobra
 * en un mapa y la página va en su propio campo, debajo de la etiqueta.
 */
export function limpiarDiagrama(diagrama: Diagrama): Diagrama {
  const nodes = diagrama.nodes.map((nodo): NodoDiagrama => {
    const pagina = nodo.label.match(PAGINA_EN_ETIQUETA);
    const label = nodo.label.replace(PAGINA_EN_ETIQUETA, ' ').replace(NUMERACION, '').replace(/\s+/g, ' ').trim();
    return {
      ...nodo,
      label: label || nodo.label,
      pagina: nodo.pagina ?? (pagina ? Number(pagina[1]) : undefined),
    };
  });

  // En un mapa mental la relación es siempre "parte de": el rótulo solo estorba.
  const edges = diagrama.type === 'mind_map'
    ? diagrama.edges.map(({ source, target }) => ({ source, target }))
    : diagrama.edges;

  return { ...diagrama, nodes, edges };
}
