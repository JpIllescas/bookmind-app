import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export type GeneratedType = 'summary' | 'flashcards' | 'quiz';
export interface GeneratedContent { id: string; type: GeneratedType; content: unknown; createdAt: string; }
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  listar(id: string): Observable<GeneratedContent[]> { return this.http.get<GeneratedContent[]>(`${environment.apiUrl}/documents/${id}/content`); }
  generar(id: string, type: GeneratedType): Observable<GeneratedContent> { return this.http.post<GeneratedContent>(`${environment.apiUrl}/documents/${id}/content`, { type }); }
}
