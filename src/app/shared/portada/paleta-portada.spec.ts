import { describe, expect, it } from 'vitest';

import { motivoDe, motivoDeLibro, paletaDe, paletaDeLibro } from './paleta-portada';

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

  it('el color de un libro clasificado sale de su materia, no del título', () => {
    const cuento = { id: 'a', title: 'El principito', materia: 'comunicacion_lenguaje' as const };
    const lectura = { id: 'b', title: 'Lectura 3', materia: 'comunicacion_lenguaje' as const };
    const numeros = { id: 'c', title: 'Matemáticas 6G', materia: 'matematicas' as const };

    expect(paletaDeLibro(cuento)).toEqual(paletaDeLibro(lectura));
    expect(paletaDeLibro(cuento)).not.toEqual(paletaDeLibro(numeros));
  });

  it('sin materia todavía, el color sale del título como antes', () => {
    expect(paletaDeLibro({ id: 'a', title: 'El principito', materia: null })).toEqual(paletaDe('El principito'));
  });

  it('renombrar no cambia el motivo, y libros de una misma materia no repiten todos el mismo', () => {
    expect(motivoDeLibro({ id: 'x1', title: 'antes' })).toBe(motivoDeLibro({ id: 'x1', title: 'después' }));
    const motivos = new Set(['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'].map((id) => motivoDeLibro({ id, title: '' })));
    expect(motivos.size).toBeGreaterThan(2);
  });

  it('devuelve colores válidos para el degradado y el relieve', () => {
    const paleta = paletaDe('Cualquier libro');
    for (const color of [paleta.base, paleta.claro, paleta.relieve]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
