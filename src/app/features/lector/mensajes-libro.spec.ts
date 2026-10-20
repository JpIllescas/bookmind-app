import { describe, expect, it } from 'vitest';

import { mensajeAlAbrirPdf, mensajeAlCargarLibro, mensajeLibroFallido } from './mensajes-libro';

describe('mensajeAlCargarLibro', () => {
  it('sin conexión lo dice, en vez de pedir que se suba otra vez', () => {
    expect(mensajeAlCargarLibro({ status: 0 })).toContain('No pudimos conectar con el servidor');
  });

  it('un 404 es un libro borrado o ajeno', () => {
    expect(mensajeAlCargarLibro({ status: 404, error: { message: 'Documento no encontrado.' } })).toContain('puede que se haya borrado');
  });

  it('usa el mensaje del servidor cuando viene', () => {
    const mensaje = 'El almacenamiento de libros no está disponible en este momento. Intenta de nuevo en unos minutos; si sigue pasando, avisa al administrador.';
    expect(mensajeAlCargarLibro({ status: 503, error: { message: mensaje } })).toBe(mensaje);
  });

  it('un 503 sin cuerpo cae al mensaje del almacenamiento y lo demás al genérico', () => {
    expect(mensajeAlCargarLibro({ status: 503 })).toContain('almacenamiento');
    expect(mensajeAlCargarLibro({ status: 500 })).toBe('No pudimos abrir el libro. Intenta de nuevo en un momento.');
  });
});

describe('mensajeAlAbrirPdf', () => {
  it('distingue archivo perdido, almacenamiento caído, sin conexión y PDF dañado', () => {
    expect(mensajeAlAbrirPdf({ name: 'ResponseException', status: 404 })).toContain('No encontramos el archivo');
    expect(mensajeAlAbrirPdf({ name: 'MissingPDFException' })).toContain('No encontramos el archivo');
    expect(mensajeAlAbrirPdf({ name: 'ResponseException', status: 503 })).toContain('almacenamiento');
    expect(mensajeAlAbrirPdf({ name: 'ResponseException', status: 0 })).toContain('conectar');
    expect(mensajeAlAbrirPdf({ name: 'InvalidPDFException' })).toContain('dañado');
    expect(mensajeAlAbrirPdf(new Error('algo raro'))).toBe('No pudimos abrir el libro. Intenta de nuevo en un momento.');
  });
});

describe('mensajeLibroFallido', () => {
  it('muestra el motivo si es una oración para el estudiante', () => {
    const motivo = 'El procesamiento se interrumpió y el archivo original no se conservó. Vuelve a subir el documento.';
    expect(mensajeLibroFallido(motivo)).toBe(motivo);
  });

  it('esconde un error técnico crudo o vacío', () => {
    expect(mensajeLibroFallido('connect ECONNREFUSED 127.0.0.1:8000')).toBe(
      'No pudimos procesar este libro. Bórralo de tu biblioteca y vuelve a subirlo.',
    );
    expect(mensajeLibroFallido(null)).toContain('No pudimos procesar');
  });
});
