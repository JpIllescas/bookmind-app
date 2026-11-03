import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { NotificacionesService } from './notificaciones.service';
import { SubidaEnCursoService } from './subida-en-curso.service';

describe('SubidaEnCursoService', () => {
  let subida: SubidaEnCursoService;
  let http: HttpTestingController;
  let rutaActual: string;
  const notificaciones = { exito: vi.fn(), error: vi.fn() };
  const url = `${environment.apiUrl}/documents`;
  const pdf = () => new File(['%PDF-1.7'], 'libro.pdf');

  beforeEach(() => {
    rutaActual = '/subir';
    notificaciones.exito.mockReset();
    notificaciones.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificacionesService, useValue: notificaciones },
        { provide: Router, useValue: { get url() { return rutaActual; } } },
      ],
    });
    subida = TestBed.inject(SubidaEnCursoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('sigue el envío, la preparación con OCR y termina listo, con el avance que muestra la barra lateral', () => {
    vi.useFakeTimers();
    expect(subida.iniciar(pdf())).toBeNull();

    const envio = http.expectOne(url);
    envio.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    expect([subida.etapa(), subida.avance()]).toEqual(['enviando', 40]);

    envio.flush({ id: 'doc-1', title: 'Libro', processingStatus: 'pending' });
    expect(subida.etapa()).toBe('preparando');
    expect(subida.documento()?.id).toBe('doc-1');
    // Sin OCR el servidor no informa cuánto falta: el anillo gira sin número.
    expect(subida.avance()).toBeNull();

    vi.advanceTimersByTime(0);
    http.expectOne(`${url}/doc-1`).flush({ id: 'doc-1', processingStatus: 'ocr', progresoOcr: { procesadas: 3, total: 4 } });
    expect([subida.avance(), subida.huboOcr()]).toEqual([75, true]);

    vi.advanceTimersByTime(1500);
    http.expectOne(`${url}/doc-1`).flush({ id: 'doc-1', title: 'Libro', processingStatus: 'ready', progresoOcr: null });
    expect([subida.etapa(), subida.activa(), subida.avance()]).toEqual(['listo', false, null]);
  });

  it('fuera de /subir avisa con una notificación al terminar; en /subir no hace falta', () => {
    rutaActual = '/biblioteca';
    subida.iniciar(pdf());
    http.expectOne(url).flush({ id: 'doc-1', title: 'Cuentos que cuidan', processingStatus: 'ready' });

    expect(subida.etapa()).toBe('listo');
    expect(notificaciones.exito).toHaveBeenCalledWith('«Cuentos que cuidan» está listo para estudiar.');

    subida.limpiar();
    rutaActual = '/subir';
    subida.iniciar(pdf());
    http.expectOne(url).flush({ id: 'doc-2', title: 'Otro', processingStatus: 'ready' });
    expect(notificaciones.exito).toHaveBeenCalledTimes(1);
  });

  it('no deja empezar otra subida mientras una sigue en curso', () => {
    subida.iniciar(pdf());
    const envio = http.expectOne(url);

    expect(subida.iniciar(pdf())).toMatch(/Ya hay un libro subiéndose/);
    http.expectNone(url);
    expect(subida.etapa()).toBe('enviando');
    envio.flush({ id: 'doc-1', title: 'Libro', processingStatus: 'ready' });
  });

  it('rechaza un archivo que no es PDF ni EPUB sin enviarlo', () => {
    expect(subida.iniciar(new File(['x'], 'notas.docx'))).toBe('BookMind solo acepta archivos PDF y EPUB.');
    http.expectNone(url);
    expect([subida.etapa(), subida.archivo()?.name]).toEqual(['error', 'notas.docx']);
  });

  it('sin conexión explica qué hacer y, fuera de /subir, lo notifica', () => {
    rutaActual = '/progreso';
    subida.iniciar(pdf());
    http.expectOne(url).error(new ProgressEvent('error'), { status: 0 });

    expect(subida.etapa()).toBe('error');
    expect(subida.error()).toBe('No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.');
    expect(notificaciones.error).toHaveBeenCalledWith(subida.error());
  });

  it('limpiar (al cerrar sesión) corta la transferencia y vuelve a reposo', () => {
    subida.iniciar(pdf());
    const envio = http.expectOne(url);

    subida.limpiar();
    expect(envio.cancelled).toBe(true);
    expect([subida.etapa(), subida.archivo(), subida.documento()]).toEqual(['reposo', null, null]);
  });

  it('pide confirmar antes de cerrar la pestaña solo mientras el archivo se está enviando', () => {
    const cerrar = () => {
      const evento = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evento);
      return evento.defaultPrevented;
    };

    expect(cerrar()).toBe(false);
    subida.iniciar(pdf());
    const envio = http.expectOne(url);
    expect(cerrar()).toBe(true);

    // Una vez en el servidor, el libro se prepara solo: cerrar ya no pierde nada.
    envio.flush({ id: 'doc-1', title: 'Libro', processingStatus: 'ready' });
    expect(cerrar()).toBe(false);
  });
});
