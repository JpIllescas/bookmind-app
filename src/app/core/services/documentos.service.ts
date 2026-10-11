import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timer, switchMap, takeWhile, filter, distinctUntilChanged } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Capitulo, Documento, DocumentoDetalle, estaEnProceso } from '../models/documento.model';

/** Progreso de una subida. */
export interface EventoSubida {
  tipo: 'progreso' | 'listo';
  porcentaje: number;
  documento?: Documento;
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);

  listar(): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${environment.apiUrl}/documents`);
  }

  obtener(id: string): Observable<DocumentoDetalle> {
    return this.http.get<DocumentoDetalle>(`${environment.apiUrl}/documents/${id}`);
  }

  capitulos(id: string): Observable<Capitulo[]> {
    return this.http.get<Capitulo[]>(`${environment.apiUrl}/documents/${id}/chapters`);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/documents/${id}`);
  }

  /** El visor pide este archivo por trozos; no pasa por HttpClient. */
  urlArchivo(id: string): string {
    return `${environment.apiUrl}/documents/${id}/file`;
  }

  /** Sube un libro reportando el progreso real de la transferencia. */
  subir(archivo: File): Observable<EventoSubida> {
    const cuerpo = new FormData();
    cuerpo.append('file', archivo);

    return this.http
      .post<Documento>(`${environment.apiUrl}/documents`, cuerpo, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(map((evento) => this.aEventoSubida(evento)));
  }

  /** Cada cambio de etapa o de avance del OCR, hasta que el libro queda listo o falla. */
  seguirProcesamiento(id: string): Observable<DocumentoDetalle> {
    return timer(0, 1500).pipe(
      switchMap(() => this.obtener(id)),
      distinctUntilChanged(
        (a, b) =>
          a.processingStatus === b.processingStatus &&
          a.progresoOcr?.procesadas === b.progresoOcr?.procesadas,
      ),
      takeWhile((documento) => estaEnProceso(documento), true),
    );
  }

  esperarProcesamiento(id: string): Observable<DocumentoDetalle> {
    return this.seguirProcesamiento(id).pipe(filter((documento) => !estaEnProceso(documento)));
  }

  private aEventoSubida(evento: HttpEvent<Documento>): EventoSubida {
    if (evento.type === HttpEventType.UploadProgress) {
      // `total` puede faltar si no hay Content-Length.
      const porcentaje = evento.total
        ? Math.round((evento.loaded / evento.total) * 100)
        : 0;
      return { tipo: 'progreso', porcentaje };
    }

    if (evento.type === HttpEventType.Response && evento.body) {
      return { tipo: 'listo', porcentaje: 100, documento: evento.body };
    }

    return { tipo: 'progreso', porcentaje: 0 };
  }
}
