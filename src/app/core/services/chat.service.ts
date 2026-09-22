import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Cita {
  claim: string;
  page: number;
  score: number;
}

export type TipoBloque = 'text' | 'summary' | 'flashcards' | 'quiz' | 'glossary' | 'timeline';

export interface MensajeChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockType: TipoBloque;
  /** null cuando la respuesta no tiene afirmaciones verificables. */
  groundingScore: number | null;
  citations: Cita[] | null;
  flaggedClaims: string[] | null;
  createdAt: string;
}

export interface Conversacion {
  id: string;
  titulo: string;
  mensajes: number;
  ultimoMensaje: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Eventos del stream, tal como los emite el backend. */
export type EventoChat =
  | { tipo: 'inicio'; conversationId: string; mensajeUsuarioId: string }
  | { tipo: 'token'; texto: string }
  | { tipo: 'material'; blockType: Exclude<TipoBloque, 'text'> }
  | { tipo: 'anclaje'; groundingScore: number | null; citations: Cita[]; flaggedClaims: string[] }
  | { tipo: 'fin'; id: string; contextoParcial: boolean; titulo: string }
  | { tipo: 'error'; mensaje: string };

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly base = `${environment.apiUrl}/chat`;

  conversaciones(documentId: string): Observable<Conversacion[]> {
    return this.http.get<Conversacion[]>(`${this.base}/${documentId}/conversaciones`);
  }

  crearConversacion(documentId: string): Observable<Conversacion> {
    return this.http.post<Conversacion>(`${this.base}/${documentId}/conversaciones`, {});
  }

  renombrar(documentId: string, id: string, titulo: string): Observable<Conversacion> {
    return this.http.patch<Conversacion>(`${this.base}/${documentId}/conversaciones/${id}`, {
      titulo,
    });
  }

  eliminarConversacion(documentId: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${documentId}/conversaciones/${id}`);
  }

  mensajes(documentId: string, conversationId: string): Observable<MensajeChat[]> {
    return this.http.get<MensajeChat[]>(
      `${this.base}/${documentId}/conversaciones/${conversationId}/mensajes`,
    );
  }

  acciones(documentId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/${documentId}/acciones`);
  }

  sugerencias(documentId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/${documentId}/sugerencias`);
  }

  /**
   * Respuesta en streaming. Va por fetch y no por HttpClient porque este
   * entrega el cuerpo entero al final; EventSource no sirve porque no manda el JWT.
   */
  enviarEnStream(
    documentId: string,
    conversationId: string | null,
    message: string,
    senal: AbortSignal,
  ): Observable<EventoChat> {
    return new Observable<EventoChat>((observador) => {
      const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = this.auth.token;
      if (token) cabeceras['Authorization'] = `Bearer ${token}`;

      fetch(`${this.base}/stream`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ documentId, conversationId: conversationId ?? undefined, message }),
        signal: senal,
      })
        .then(async (respuesta) => {
          if (!respuesta.ok || !respuesta.body) {
            const cuerpo = await respuesta.json().catch(() => null);
            const mensaje =
              (cuerpo as { message?: string | string[] } | null)?.message ??
              'El asistente no pudo responder. Inténtalo otra vez.';
            observador.next({
              tipo: 'error',
              mensaje: Array.isArray(mensaje) ? mensaje.join(' ') : mensaje,
            });
            observador.complete();
            return;
          }

          const lector = respuesta.body.getReader();
          const decodificador = new TextDecoder();
          let pendiente = '';

          for (;;) {
            const { value, done } = await lector.read();
            if (done) break;

            pendiente += decodificador.decode(value, { stream: true });

            // Cada evento SSE termina en línea en blanco; lo que sobra espera al siguiente trozo.
            const bloques = pendiente.split('\n\n');
            pendiente = bloques.pop() ?? '';

            for (const bloque of bloques) {
              const evento = this.parsearEvento(bloque);
              if (evento) observador.next(evento);
            }
          }

          observador.complete();
        })
        .catch((error: unknown) => {
          if (senal.aborted) {
            observador.complete();
            return;
          }
          observador.next({
            tipo: 'error',
            mensaje:
              error instanceof Error && error.message
                ? 'No se pudo conectar con el asistente. Revisa tu conexión.'
                : 'El asistente no pudo responder.',
          });
          observador.complete();
        });
    });
  }

  private parsearEvento(bloque: string): EventoChat | null {
    const datos = bloque
      .split('\n')
      .filter((linea) => linea.startsWith('data:'))
      .map((linea) => linea.slice(5).trim())
      .join('\n');

    if (!datos) return null;

    try {
      return JSON.parse(datos) as EventoChat;
    } catch {
      return null;
    }
  }
}
