import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { esColorOscuro, navegadorOscureceLaPagina } from './oscurecido-forzado';
import { TemaService } from './tema.service';

function lienzoDe(color: string): void {
  // El entorno de pruebas no trae matchMedia y el servicio lo consulta al crearse.
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => undefined }));
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ backgroundColor: color } as CSSStyleDeclaration);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('esColorOscuro', () => {
  it('distingue un lienzo oscuro de uno claro', () => {
    expect(esColorOscuro('rgb(18, 18, 18)')).toBe(true);
    expect(esColorOscuro('rgba(0, 0, 0, 1)')).toBe(true);
    expect(esColorOscuro('rgb(255, 255, 255)')).toBe(false);
  });

  it('lo que no es un color legible no cuenta como oscuro', () => {
    expect(esColorOscuro('')).toBe(false);
    expect(esColorOscuro('canvas')).toBe(false);
  });
});

describe('navegadorOscureceLaPagina', () => {
  it('lo detecta cuando el lienzo de un elemento claro sale oscuro, y no deja la sonda en la página', () => {
    lienzoDe('rgb(18, 18, 18)');
    const antes = document.documentElement.childElementCount;

    expect(navegadorOscureceLaPagina()).toBe(true);
    expect(document.documentElement.childElementCount).toBe(antes);
  });

  it('con el lienzo blanco no hay nada forzado', () => {
    lienzoDe('rgb(255, 255, 255)');
    expect(navegadorOscureceLaPagina()).toBe(false);
  });
});

describe('TemaService con el modo oscuro forzado por el navegador', () => {
  it('usa el tema oscuro propio aunque el guardado sea claro, sin cambiar la preferencia', () => {
    localStorage.setItem('bookmind.tema', 'claro');
    lienzoDe('rgb(18, 18, 18)');

    const tema = TestBed.inject(TemaService);
    TestBed.tick();

    expect(tema.esOscuro()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(tema.tema()).toBe('claro');
  });

  it('el botón de tema sigue mandando: al cambiarlo a mano se pasa a claro', () => {
    lienzoDe('rgb(18, 18, 18)');
    const tema = TestBed.inject(TemaService);
    TestBed.tick();

    tema.alternar();
    TestBed.tick();

    expect(tema.esOscuro()).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sin oscurecido forzado respeta el tema guardado', () => {
    localStorage.setItem('bookmind.tema', 'claro');
    lienzoDe('rgb(255, 255, 255)');

    TestBed.inject(TemaService);
    TestBed.tick();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
