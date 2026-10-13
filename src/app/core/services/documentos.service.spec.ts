import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import type { DocumentoDetalle } from '../models/documento.model';
import { DocumentosService, EventoSubida } from './documentos.service';

describe('DocumentosService', () => {
  let servicio: DocumentosService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/documents`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(DocumentosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('la subida informa el avance real de la transferencia y termina con el libro creado', () => {
    const eventos: EventoSubida[] = [];
    servicio.subir(new File(['%PDF'], 'libro.pdf')).subscribe((e) => eventos.push(e));

    const peticion = http.expectOne(url);
    expect(peticion.request.body.get('file')).toBeInstanceOf(File);
    peticion.event({ type: HttpEventType.UploadProgress, loaded: 30, total: 120 });
    // Sin Content-Length no hay total: mejor 0 que un porcentaje inventado.
    peticion.event({ type: HttpEventType.UploadProgress, loaded: 30 });
    peticion.flush({ id: 'doc-1', title: 'libro' });

    expect(eventos.map((e) => [e.tipo, e.porcentaje])).toEqual([
      // El evento `Sent` de HttpClient: la barra arranca en 0 apenas sale la petición.
      ['progreso', 0],
      ['progreso', 25],
      ['progreso', 0],
      ['listo', 100],
    ]);
    expect(eventos.at(-1)!.documento).toMatchObject({ id: 'doc-1' });
  });

  it('sigue el procesamiento, avisa cada avance del OCR una sola vez y se detiene al quedar listo', () => {
    vi.useFakeTimers();
    const estados: string[] = [];
    servicio
      .seguirProcesamiento('doc-1')
      .subscribe((d) => estados.push(`${d.processingStatus}:${d.progresoOcr?.procesadas ?? '-'}`));
    const responder = (cuerpo: Partial<DocumentoDetalle>) => {
      vi.advanceTimersByTime(1500);
      http.expectOne(`${url}/doc-1`).flush(cuerpo);
    };

    vi.advanceTimersByTime(0);
    http.expectOne(`${url}/doc-1`).flush({ processingStatus: 'ocr', progresoOcr: { procesadas: 1, total: 4 } });
    responder({ processingStatus: 'ocr', progresoOcr: { procesadas: 1, total: 4 } });
    responder({ processingStatus: 'ocr', progresoOcr: { procesadas: 3, total: 4 } });
    responder({ processingStatus: 'ready', progresoOcr: null });

    expect(estados).toEqual(['ocr:1', 'ocr:3', 'ready:-']);
    vi.advanceTimersByTime(5000);
    http.expectNone(`${url}/doc-1`);
  });

  it('esperarProcesamiento solo entrega el estado final, también si falló', () => {
    vi.useFakeTimers();
    const finales: string[] = [];
    servicio.esperarProcesamiento('doc-1').subscribe((d) => finales.push(d.processingStatus));

    vi.advanceTimersByTime(0);
    http.expectOne(`${url}/doc-1`).flush({ processingStatus: 'processing' });
    vi.advanceTimersByTime(1500);
    http.expectOne(`${url}/doc-1`).flush({ processingStatus: 'failed', processingError: 'Sin texto legible.' });

    expect(finales).toEqual(['failed']);
  });
});
