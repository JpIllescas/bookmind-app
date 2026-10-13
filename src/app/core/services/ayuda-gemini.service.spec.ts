import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AyudaGeminiService } from './ayuda-gemini.service';
import { NotificacionesService } from './notificaciones.service';

describe('AyudaGeminiService', () => {
  const url = `${environment.apiUrl}/users/ayuda-gemini`;
  let servicio: AyudaGeminiService;
  let http: HttpTestingController;
  let error: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    error = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificacionesService, useValue: { error } },
      ],
    });
    servicio = TestBed.inject(AyudaGeminiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el estado una sola vez', () => {
    servicio.cargar();
    servicio.cargar();
    http.expectOne(url).flush({ activada: true, disponible: true });

    expect(servicio.enUso()).toBe(true);
  });

  it('sin Gemini en el servidor no está en uso aunque esté activada', () => {
    servicio.cargar();
    http.expectOne(url).flush({ activada: true, disponible: false });

    expect(servicio.activada()).toBe(true);
    expect(servicio.enUso()).toBe(false);
  });

  it('al apagarla cambia al instante y guarda en el servidor', () => {
    servicio.cargar();
    http.expectOne(url).flush({ activada: true, disponible: true });

    servicio.cambiar(false);
    expect(servicio.enUso()).toBe(false);

    const guardado = http.expectOne({ url, method: 'PUT' });
    expect(guardado.request.body).toEqual({ activada: false });
    guardado.flush({ activada: false, disponible: true });
    expect(servicio.activada()).toBe(false);
  });

  it('si el servidor no lo guarda, vuelve atrás y avisa al estudiante', () => {
    servicio.cargar();
    http.expectOne(url).flush({ activada: true, disponible: true });

    servicio.cambiar(false);
    http.expectOne({ url, method: 'PUT' }).flush('falló', { status: 500, statusText: 'Error' });

    expect(servicio.activada()).toBe(true);
    expect(error).toHaveBeenCalled();
  });

  it('no intenta cambiarla si el servidor no la ofrece', () => {
    servicio.cargar();
    http.expectOne(url).flush({ activada: true, disponible: false });

    servicio.cambiar(false);

    http.expectNone({ url, method: 'PUT' });
  });
});
