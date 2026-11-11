import { paginaDeReanudacion } from './pagina-de-reanudacion';

describe('paginaDeReanudacion', () => {
  it('retoma en la página que corresponde al avance guardado', () => {
    expect(paginaDeReanudacion(66, 47)).toBe(31);
    expect(paginaDeReanudacion(99, 274)).toBe(271);
  });

  it('sin avance abre la primera página', () => {
    expect(paginaDeReanudacion(0, 47)).toBe(1);
  });

  it('un libro terminado se abre desde el principio', () => {
    expect(paginaDeReanudacion(100, 47)).toBe(1);
  });

  it('nunca sale del libro', () => {
    expect(paginaDeReanudacion(1, 20)).toBe(1);
    expect(paginaDeReanudacion(50, 0)).toBe(1);
  });
});
