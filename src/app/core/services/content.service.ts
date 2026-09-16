import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export type GeneratedType = 'summary' | 'flashcards' | 'quiz';
export interface GeneratedContent { id: string; type: GeneratedType; content: unknown; createdAt: string; }
export interface PreguntaFallada { pregunta: string; elegida: string; correcta: string; }
export interface IntentoQuiz { aciertos: number; total: number; falladas: PreguntaFallada[]; }
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  listar(id: string): Observable<GeneratedContent[]> { return this.http.get<GeneratedContent[]>(`${environment.apiUrl}/documents/${id}/content`); }
  generar(id: string, type: GeneratedType): Observable<GeneratedContent> { return this.http.post<GeneratedContent>(`${environment.apiUrl}/documents/${id}/content`, { type }); }
  registrarIntento(documentId: string, id: string, intento: IntentoQuiz): Observable<unknown> {
    return this.http.post(`${environment.apiUrl}/documents/${documentId}/content/${id}/intentos`, intento);
  }
  eliminar(documentId: string, id: string): Observable<void> { return this.http.delete<void>(`${environment.apiUrl}/documents/${documentId}/content/${id}`); }
}
