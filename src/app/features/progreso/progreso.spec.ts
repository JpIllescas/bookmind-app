import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressSummary } from '../../core/models/documento.model';
import { AprendizajeService } from '../../core/services/aprendizaje.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { StudyService } from '../../core/services/study.service';
import { Progreso } from './progreso';

describe('Progreso · libro recordado de la ruta', () => {
  let progreso: Subject<ProgressSummary>;
  let ruta: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    progreso = new Subject<ProgressSummary>();
    ruta = vi.fn(() => of({ documento: { id: 'vigente' }, unidades: [], actual: 0 }));
    // Quedó de un libro ya borrado, o de otra cuenta que usó este navegador.
    localStorage.setItem('bookmind.ruta-libro', 'borrado');

    TestBed.configureTestingModule({
      providers: [
        { provide: StudyService, useValue: { progreso: () => progreso, planes: () => of([]) } },
        { provide: AprendizajeService, useValue: { ruta } },
        { provide: AuthService, useValue: { usuario: signal(null) } },
        { provide: GamificacionService, useValue: { resumen: signal(null), cargar: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NotificacionesService, useValue: { error: vi.fn(), exito: vi.fn() } },
      ],
    });
  });

  afterEach(() => localStorage.removeItem('bookmind.ruta-libro'));

  const crear = () => TestBed.runInInjectionContext(() => new Progreso());

  it('no pide la ruta de un id que no está en la lista de libros', () => {
    crear();
    TestBed.tick();

    expect(ruta).not.toHaveBeenCalled();
  });

  it('cuando llega la lista, abre la ruta del primer libro válido', () => {
    crear();
    progreso.next({
      documents: [{ id: 'vigente', processingStatus: 'ready', textLayer: 'ok' }],
    } as unknown as ProgressSummary);
    TestBed.tick();

    expect(ruta).toHaveBeenCalledTimes(1);
    expect(ruta).toHaveBeenCalledWith('vigente');
    expect(localStorage.getItem('bookmind.ruta-libro')).toBe('vigente');
  });
});
