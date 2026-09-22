import { describe, expect, it } from 'vitest';

import { motivoDe, paletaDe } from './paleta-portada';

describe('paleta de portada', () => {
  it('da siempre la misma paleta al mismo título, sin importar mayúsculas ni espacios', () => {
    expect(paletaDe('El Principito')).toEqual(paletaDe('  el principito '));
    expect(motivoDe('El Principito')).toEqual(motivoDe('EL PRINCIPITO'));
  });

  it('reparte títulos distintos entre varias paletas', () => {
    const titulos = ['Álgebra', 'Biología', 'Historia', 'Química', 'Literatura', 'Física', 'Geografía', 'Inglés'];
    const nombres = new Set(titulos.map((t) => paletaDe(t).nombre));
    expect(nombres.size).toBeGreaterThan(2);
  });

  it('devuelve colores válidos para el degradado y el relieve', () => {
    const paleta = paletaDe('Cualquier libro');
    for (const color of [paleta.base, paleta.claro, paleta.relieve]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
