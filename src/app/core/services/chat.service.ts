import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface Cita {
  claim: string;
  page: number;
  score: number;
}

export interface MensajeChat {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockType: 'text' | 'summary' | 'flashcards' | 'quiz';
  /** null cuando la respuesta no tiene afirmaciones verificables. */
  groundingScore: number | null;
  citations: Cita[] | null;
  flaggedClaims: string[] | null;
  createdAt: string;
}

export interface RespuestaChat {
  id: string;
  response: string;
  blockType: MensajeChat['blockType'];
  groundingScore: number | null;
  citations: Cita[];
  flaggedClaims: string[];
  /** True si el libro no cupo entero y se usaron pasajes recuperados. */
  contextoParcial: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  historial(documentId: string): Observable<MensajeChat[]> {
    return this.http.get<MensajeChat[]>(`${environment.apiUrl}/chat/${documentId}`);
  }

  acciones(documentId: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${environment.apiUrl}/chat/${documentId}/acciones`,
    );
  }

  enviar(documentId: string, message: string): Observable<RespuestaChat> {
    return this.http.post<RespuestaChat>(`${environment.apiUrl}/chat`, {
      documentId,
      message,
    });
  }
}
