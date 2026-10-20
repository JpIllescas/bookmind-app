import { describe, expect, it } from 'vitest';

import {
  RITMOS,
  aperturaOjos,
  avanzarResorte,
  crearResorte,
  duracionParpadeo,
  inclinacion,
  miradaFija,
  miradaHacia,
  respiracion,
  siguienteParpadeo,
} from './movimiento-lumo';

const CABEZA = { rigidez: 120, amortiguacion: 18 };

function simular(objetivo: number, segundos: number, elasticidad = CABEZA) {
  const resorte = crearResorte();
  for (let t = 0; t < segundos; t += 1 / 60) avanzarResorte(resorte, objetivo, elasticidad, 1 / 60);
  return resorte;
}

describe('avanzarResorte', () => {
  it('llega a su objetivo y se queda quieto', () => {
    const resorte = simular(5, 2);
    expect(resorte.valor).toBeCloseTo(5, 2);
    expect(Math.abs(resorte.velocidad)).toBeLessThan(0.01);
  });

  it('poco amortiguado se pasa del objetivo antes de asentarse: el rebote de la cola', () => {
    const resorte = crearResorte();
    let maximo = 0;
    for (let t = 0; t < 1; t += 1 / 60) {
      avanzarResorte(resorte, 10, { rigidez: 90, amortiguacion: 4 }, 1 / 60);
      maximo = Math.max(maximo, resorte.valor);
    }
    expect(maximo).toBeGreaterThan(10);
  });

  it('un cuadro de varios segundos (pestaña que vuelve) no lo dispara', () => {
    const resorte = crearResorte();
    avanzarResorte(resorte, 5, CABEZA, 4);
    expect(Math.abs(resorte.valor)).toBeLessThan(5);
  });
});

describe('parpadeo', () => {
  it('espera entre 2,2 y 6,5 s y a veces es doble', () => {
    expect(siguienteParpadeo(() => 0)).toEqual({ espera: 2200, doble: true });
    expect(siguienteParpadeo(() => 0.99).espera).toBeCloseTo(6457, 0);
    expect(siguienteParpadeo(() => 0.99).doble).toBe(false);
  });

  it('cierra rápido, se queda un instante cerrado y abre más despacio', () => {
    expect(aperturaOjos(0, false)).toBe(1);
    expect(aperturaOjos(80, false)).toBeCloseTo(0.1);
    // En 35 ms se cierra más de lo que se abre en los primeros 35 ms de apertura.
    expect(1 - aperturaOjos(35, false)).toBeGreaterThan(aperturaOjos(135, false) - 0.1);
    expect(aperturaOjos(duracionParpadeo(false), false)).toBe(1);
  });

  it('el doble vuelve a cerrar después de abrir', () => {
    const entreAmbos = duracionParpadeo(false) + 50;
    const segundoCerrado = duracionParpadeo(false) + 110 + 80;
    expect(aperturaOjos(entreAmbos, true)).toBe(1);
    expect(aperturaOjos(segundoCerrado, true)).toBeCloseTo(0.1);
    expect(aperturaOjos(segundoCerrado, false)).toBe(1);
  });
});

describe('ritmo por estado', () => {
  it('dormido respira más lento y más hondo que despierto', () => {
    expect(RITMOS.duerme.respiracion).toBeGreaterThan(RITMOS.neutro.respiracion);
    expect(RITMOS.duerme.amplitud).toBeGreaterThan(RITMOS.neutro.amplitud);
  });

  it('la respiración oscila alrededor de 1', () => {
    const cuarto = RITMOS.neutro.respiracion / 4;
    expect(respiracion(cuarto, RITMOS.neutro)).toBeCloseTo(1 + RITMOS.neutro.amplitud);
    expect(respiracion(3 * cuarto, RITMOS.neutro)).toBeCloseTo(1 - RITMOS.neutro.amplitud);
  });

  it('inclina la cabeza según el estado y el guiño manda', () => {
    expect(inclinacion('neutro', false)).toBe(0);
    expect(inclinacion('piensa', false)).toBe(3);
    expect(inclinacion('piensa', true)).toBe(-6);
  });
});

describe('miradaHacia', () => {
  it('mira hacia el lado del punto y gira la cabeza hacia allí', () => {
    const mirada = miradaHacia(200, 0);
    expect(mirada.x).toBeCloseTo(2.8);
    expect(mirada.y).toBe(0);
    expect(mirada.giro).toBeCloseTo(5);
  });

  it('de muy lejos o justo encima vuelve al centro', () => {
    expect(miradaHacia(0, 0)).toEqual({ x: 0, y: 0, giro: 0 });
    expect(miradaHacia(900, 0)).toEqual({ x: 0, y: 0, giro: 0 });
  });

  it('se apaga gradualmente al alejarse, sin salto en el borde', () => {
    expect(miradaHacia(460, 0).x).toBeCloseTo(1.4);
    expect(miradaHacia(555, 0).x).toBeLessThan(0.1);
  });
});

describe('miradaFija', () => {
  it('leyendo o apenado baja la vista aunque la pantalla pida otra cosa', () => {
    expect(miradaFija('piensa', 'arriba')?.y).toBeGreaterThan(2);
    expect(miradaFija('apenado', 'arriba')?.y).toBeGreaterThan(2);
  });

  it('mira hacia donde pide la pantalla y, sin pedido, deja al puntero', () => {
    expect(miradaFija('neutro', 'abajo-izquierda')).toEqual({ x: -2.2, y: 2.2, giro: -3 });
    expect(miradaFija('neutro', null)).toBeNull();
  });
});
