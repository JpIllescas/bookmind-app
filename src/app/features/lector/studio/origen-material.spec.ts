import { describe, expect, it } from 'vitest';

import { etiquetaDeOrigen } from './origen-material';

describe('etiquetaDeOrigen', () => {
  it('el material del motor redactado por Gemini sigue diciendo "Motor propio"', () => {
    expect(etiquetaDeOrigen('quiz', 'motor')).toBe('Motor propio · sin IA externa');
    expect(etiquetaDeOrigen('quiz', 'gemini')).toBe('Motor propio · redactado con Gemini');
  });

  it('un mapa hecho por Gemini no se atribuye al motor', () => {
    expect(etiquetaDeOrigen('mind_map', 'gemini')).toBe('Hecho con Gemini');
    expect(etiquetaDeOrigen('concept_map', 'gemini')).not.toContain('Motor propio');
  });

  it('sin origen no hay etiqueta', () => {
    expect(etiquetaDeOrigen('summary', null)).toBeNull();
  });
});
