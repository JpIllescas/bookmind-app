import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Documento, ProgressSummary, StudyPlan, StudyTask } from '../models/documento.model';

@Injectable({ providedIn: 'root' })
export class StudyService {
  private readonly http = inject(HttpClient);

  progreso(): Observable<ProgressSummary> {
    return this.http.get<ProgressSummary>(`${environment.apiUrl}/progress`);
  }

  actualizarProgreso(id: string, progress: number): Observable<Documento> {
    return this.http.put<Documento>(
      `${environment.apiUrl}/progress/documents/${id}`,
      { progress },
    );
  }

  planes(): Observable<StudyPlan[]> {
    return this.http.get<StudyPlan[]>(`${environment.apiUrl}/study-plans`);
  }

  crearPlan(
    title: string,
    targetDate: string | undefined,
    tasks: StudyTask[],
  ): Observable<StudyPlan> {
    return this.http.post<StudyPlan>(`${environment.apiUrl}/study-plans`, {
      title,
      targetDate,
      tasks,
    });
  }

  generarPlan(documentId: string): Observable<StudyPlan> {
    return this.http.post<StudyPlan>(`${environment.apiUrl}/study-plans/generate`, {
      documentId,
    });
  }

  completarTarea(planId: string, index: number): Observable<StudyPlan> {
    return this.http.patch<StudyPlan>(
      `${environment.apiUrl}/study-plans/${planId}/tasks/${index}`,
      {},
    );
  }
}
