import { describe, expect, it } from 'vitest';

import { avisoOcr } from './aviso-ocr';

describe('avisoOcr', () => {
  it('no avisa por la portada y la última página (El principito: 2 de 47)', () => {
    expect(avisoOcr(2, 47, 0)).toBeNull();
  });

  it('avisa cuando el OCR pesa en el libro y dice cuántas páginas', () => {
    expect(avisoOcr(38, 120, 0)).toEqual({ paginas: 38, total: 120, dudosas: 0 });
  });

  it('en un libro largo, 3 páginas no alcanzan el 10 %', () => {
    expect(avisoOcr(3, 258, 0)).toBeNull();
  });

  it('una sola página dudosa basta para avisar', () => {
    expect(avisoOcr(1, 47, 1)).toEqual({ paginas: 1, total: 47, dudosas: 1 });
  });

  it('sin OCR no hay aviso', () => {
    expect(avisoOcr(0, 47, 0)).toBeNull();
  });
});
