import { describe, expect, it } from 'vitest';

import type { Diagrama } from './diagrama';
import { limpiarDiagrama } from './limpiar-diagrama';

describe('limpiarDiagrama', () => {
  // Forma real del mapa de planetas que devolvió el chat para El principito.
  const delChat: Diagrama = {
    type: 'mind_map',
    title: 'Planetas visitados por el Principito',
    nodes: [
      { id: 'n1', label: 'Viaje del Principito', type: 'root' },
      { id: 'n2', label: '1. El Rey (pág. 16)' },
      { id: 'n3', label: '4. El Hombre de Negocios (págs. 21-22)' },
      { id: 'n4', label: 'El Farolero (p. 24)', pagina: 25 },
    ],
    edges: [{ source: 'n1', target: 'n2', label: 'primero' }, { source: 'n1', target: 'n3' }],
  };

  it('saca la numeración y pasa la página a su campo', () => {
    const [, rey, negocios] = limpiarDiagrama(delChat).nodes;
    expect(rey).toMatchObject({ label: 'El Rey', pagina: 16 });
    expect(negocios).toMatchObject({ label: 'El Hombre de Negocios', pagina: 21 });
  });

  it('respeta la página que ya traía el nodo', () => {
    expect(limpiarDiagrama(delChat).nodes[3]).toMatchObject({ label: 'El Farolero', pagina: 25 });
  });

  it('quita los rótulos del mapa mental y deja los del conceptual', () => {
    expect(limpiarDiagrama(delChat).edges[0].label).toBeUndefined();
    expect(limpiarDiagrama({ ...delChat, type: 'concept_map' }).edges[0].label).toBe('primero');
  });

  it('no toca etiquetas que solo tienen números con sentido', () => {
    const conAnio: Diagrama = { ...delChat, nodes: [{ id: 'a', label: '1920: el astrónomo turco', type: 'root' }], edges: [] };
    expect(limpiarDiagrama(conAnio).nodes[0].label).toBe('1920: el astrónomo turco');
  });
});
