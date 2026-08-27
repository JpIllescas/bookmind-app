import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timer, switchMap, takeWhile, filter, distinctUntilChanged } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Documento, DocumentoDetalle } from '../models/documento.model';

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

  esperarProcesamiento(id: string): Observable<Documento> {
    return timer(0, 1500).pipe(switchMap(() => this.obtener(id)), distinctUntilChanged((a, b) => a.processingStatus === b.processingStatus), takeWhile((d) => d.processingStatus === 'pending' || d.processingStatus === 'processing', true), filter((d) => d.processingStatus === 'ready' || d.processingStatus === 'failed'));
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
