import { describe, expect, it } from 'vitest';

import { columnasDelLector, esElUnicoAbierto } from './columnas-lector';

// Separa por los espacios de fuera de los paréntesis: "minmax(0, 1fr)" es una sola columna.
const cols = (libro: boolean, chat: boolean, studio: boolean) =>
  columnasDelLector({ libro, chat, studio }).split(/ (?![^(]*\))/);

describe('columnas del lector', () => {
  it('siempre son cuatro: ocultar un panel no corre a los demás de columna', () => {
    for (const libro of [true, false]) {
      for (const chat of [true, false]) {
        for (const studio of [true, false]) {
          expect(cols(libro, chat, studio)).toHaveLength(4);
        }
      }
    }
  });

  it('con los tres abiertos, el libro tiene su ancho ajustable y el chat el resto', () => {
    expect(cols(true, true, true)).toEqual(['var(--ancho-libro)', '6px', 'minmax(0, 1fr)', 'var(--ancho-studio)']);
  });

  it('sin chat, el PDF se ensancha y el Studio sigue a la derecha', () => {
    expect(cols(true, false, true)).toEqual(['minmax(0, 1fr)', '0px', '0px', 'var(--ancho-studio)']);
  });

  it('sin libro, el chat ocupa su lugar y el Studio no se estira (el caso de la captura)', () => {
    expect(cols(false, true, true)).toEqual(['0px', '0px', 'minmax(0, 1fr)', 'var(--ancho-studio)']);
  });

  it('el panel que queda solo ocupa todo', () => {
    expect(cols(true, false, false)).toEqual(['minmax(0, 1fr)', '0px', '0px', '0px']);
    expect(cols(false, true, false)).toEqual(['0px', '0px', 'minmax(0, 1fr)', '0px']);
    expect(cols(false, false, true)).toEqual(['0px', '0px', '0px', 'minmax(0, 1fr)']);
  });

  it('el último panel abierto no se puede cerrar', () => {
    expect(esElUnicoAbierto({ libro: false, chat: true, studio: false }, 'chat')).toBe(true);
    expect(esElUnicoAbierto({ libro: true, chat: true, studio: false }, 'chat')).toBe(false);
    expect(esElUnicoAbierto({ libro: false, chat: false, studio: true }, 'libro')).toBe(false);
  });
});
