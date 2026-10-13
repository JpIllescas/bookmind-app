import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AprendizajeService } from './aprendizaje.service';

describe('AprendizajeService', () => {
  let servicio: AprendizajeService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/aprendizaje`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AprendizajeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('manda el desfase horario del navegador: la racha se cuenta en el día del estudiante', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(360);

    servicio.resumen().subscribe();
    servicio.registrar('doc-1', 'cap-1', 4, 5).subscribe();

    expect(http.expectOne(`${base}/resumen?desfase=360`).request.method).toBe('GET');
    const registro = http.expectOne(`${base}/documentos/doc-1/unidades/cap-1/intentos?desfase=360`);
    expect(registro.request.method).toBe('POST');
    expect(registro.request.body).toEqual({ aciertos: 4, total: 5 });
  });

  it('pedir otra lección es un POST distinto de abrir la guardada', () => {
    servicio.leccion('doc-1', 'cap-1').subscribe();
    servicio.regenerarLeccion('doc-1', 'cap-1').subscribe();

    expect(http.expectOne(`${base}/documentos/doc-1/unidades/cap-1/leccion`).request.method).toBe('GET');
    expect(http.expectOne(`${base}/documentos/doc-1/unidades/cap-1/leccion/regenerar`).request.method).toBe(
      'POST',
    );
  });
});
