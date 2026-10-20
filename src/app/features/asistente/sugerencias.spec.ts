import { describe, expect, it } from 'vitest';

import type { Documento } from '../../core/models/documento.model';
import { sugerenciasDe } from './sugerencias';

const libro = (title: string) => ({ title } as Documento);

describe('sugerenciasDe', () => {
  it('sin libros listos no inventa preguntas', () => {
    expect(sugerenciasDe([])).toEqual([]);
  });

  it('con un libro, todas las preguntas son sobre ese libro', () => {
    const sugerencias = sugerenciasDe([libro('El principito')]);
    expect(sugerencias).toHaveLength(3);
    expect(sugerencias.every((s) => s.includes('«El principito»'))).toBe(true);
  });

  it('con varios, compara los dos primeros y recorta títulos largos', () => {
    const [, comparar] = sugerenciasDe([libro('medio social y natural 2do compressed (1) edición escolar'), libro('El principito')]);
    expect(comparar).toContain('«El principito»');
    expect(comparar).toContain('…»');
  });

  it('no queda ninguna pregunta de temas fijos como la fotosíntesis', () => {
    expect(sugerenciasDe([libro('Matemáticas 6')]).join(' ')).not.toMatch(/fotosíntesis/i);
  });
});
