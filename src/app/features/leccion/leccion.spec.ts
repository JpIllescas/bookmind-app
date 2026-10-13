import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AprendizajeService, Leccion as LeccionArmada, ResultadoLeccion } from '../../core/services/aprendizaje.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { Leccion } from './leccion';

const LECCION: LeccionArmada = {
  chapterId: 'cap-1',
  titulo: 'Los seres vivos',
  paginaInicio: 4,
  paginaFin: 12,
  ejercicios: [
    {
      tipo: 'opcion',
      enunciado: '¿Qué es la célula?',
      opciones: ['Un órgano', 'La unidad básica de los seres vivos', 'Un tejido'],
      correcta: 1,
      pagina: 5,
      explicacion: 'La célula es la unidad básica de los seres vivos.',
    },
    {
      tipo: 'hueco',
      enunciado: 'Las plantas fabrican su alimento por _____.',
      opciones: ['fotosíntesis', 'digestión'],
      correcta: 0,
      pagina: 9,
      explicacion: null,
    },
  ],
};

const RESULTADO: ResultadoLeccion = {
  xp: 14,
  coronas: 0,
  corona: false,
  resumen: { racha: 2, xpHoy: 14, metaDiaria: 30 } as ResultadoLeccion['resumen'],
};

describe('Pantalla de lección', () => {
  let fixture: ComponentFixture<Leccion>;
  let registrar: ReturnType<typeof vi.fn>;
  let actualizar: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    registrar = vi.fn(() => of(RESULTADO));
    actualizar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AprendizajeService, useValue: { leccion: () => of(LECCION), registrar } },
        { provide: GamificacionService, useValue: { actualizar } },
      ],
    });
    fixture = TestBed.createComponent(Leccion);
    fixture.componentRef.setInput('documentId', 'doc-1');
    fixture.componentRef.setInput('chapterId', 'cap-1');
    await fixture.whenStable();
  });

  const pantalla = () => fixture.nativeElement as HTMLElement;
  const texto = () => pantalla().textContent!.replace(/\s+/g, ' ');
  const boton = (etiqueta: string) =>
    [...pantalla().querySelectorAll('button')].find((b) => b.textContent!.includes(etiqueta))!;
  const opcion = (textoOpcion: string) =>
    [...pantalla().querySelectorAll<HTMLButtonElement>('button.opcion')].find((b) =>
      b.textContent!.includes(textoOpcion),
    )!;
  const pulsar = async (elemento: HTMLElement) => {
    elemento.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('no deja comprobar sin elegir una respuesta', () => {
    expect(texto()).toContain('¿Qué es la célula?');
    expect(texto()).toContain('1 / 2');
    expect(boton('Comprobar').disabled).toBe(true);
  });

  it('al fallar muestra lo que decía el libro y la página para revisarlo', async () => {
    await pulsar(opcion('Un órgano'));
    await pulsar(boton('Comprobar'));

    expect(texto()).toContain('Incorrecto');
    expect(texto()).toContain('La célula es la unidad básica de los seres vivos.');
    expect(texto()).toContain('pág. 5');
    expect(opcion('La unidad básica').classList).toContain('opcion--correcta');
    expect(opcion('Un órgano').classList).toContain('opcion--fallo');
  });

  it('una vez comprobado, cambiar de opción no altera el resultado', async () => {
    await pulsar(opcion('Un órgano'));
    await pulsar(boton('Comprobar'));
    await pulsar(opcion('La unidad básica'));

    expect(texto()).toContain('Incorrecto');
    expect(fixture.componentInstance.aciertos()).toBe(0);
  });

  it('el teclado alcanza para resolverla: número para elegir, Enter para comprobar y seguir', async () => {
    const tecla = async (key: string) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
      await fixture.whenStable();
    };

    await tecla('2');
    await tecla('Enter');
    expect(texto()).toContain('¡Correcto!');
    await tecla('Enter');

    expect(texto()).toContain('2 / 2');
    expect(texto()).toContain('Las plantas fabrican su alimento por');
  });

  it('al terminar guarda los aciertos reales y muestra el XP, la racha y la meta del día', async () => {
    await pulsar(opcion('La unidad básica'));
    await pulsar(boton('Comprobar'));
    await pulsar(boton('Continuar'));
    await pulsar(opcion('digestión'));
    await pulsar(boton('Comprobar'));
    await pulsar(boton('Terminar'));

    expect(registrar).toHaveBeenCalledWith('doc-1', 'cap-1', 1, 2);
    expect(actualizar).toHaveBeenCalledWith(RESULTADO.resumen);
    expect(texto()).toContain('+14');
    expect(texto()).toContain('1 / 2');
    expect(texto()).toContain('Racha de 2 días');
    expect(texto()).toContain('14 / 30 XP hoy');
  });

  it('si no se pudo guardar, igual muestra el final y lo dice sin culpar al estudiante', async () => {
    registrar.mockReturnValue(throwError(() => new Error('500')));
    for (const [elegida, siguiente] of [
      ['La unidad básica', 'Continuar'],
      ['fotosíntesis', 'Terminar'],
    ]) {
      await pulsar(opcion(elegida));
      await pulsar(boton('Comprobar'));
      await pulsar(boton(siguiente));
    }

    expect(texto()).toContain('Los seres vivos');
    expect(texto()).toContain('No se pudo guardar el resultado, pero la lección cuenta para ti.');
  });
});
