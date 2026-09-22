import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface DiaDeActividad {
  fecha: string;
  inicial: string;
  xp: number;
  cumplida: boolean;
  esHoy: boolean;
}

export interface ResumenGamificacion {
  xpTotal: number;
  xpHoy: number;
  metaDiaria: number;
  nivel: number;
  xpEnNivel: number;
  racha: number;
  mejorRacha: number;
  rachaEnRiesgo: boolean;
  leccionesTerminadas: number;
  ultimosDias: DiaDeActividad[];
}

export type EstadoUnidad = 'bloqueada' | 'disponible' | 'en_curso' | 'aprobada' | 'dominada';

export interface UnidadRuta {
  chapterId: string;
  orden: number;
  titulo: string;
  paginaInicio: number;
  paginaFin: number;
  coronas: number;
  lecciones: number;
  mejor: number | null;
  estado: EstadoUnidad;
}

export interface RutaLibro {
  documento: { id: string; title: string; tintColor: string; etiqueta: string };
  unidades: UnidadRuta[];
  actual: number;
  coronas: number;
  coronasPosibles: number;
}

export type TipoEjercicio = 'opcion' | 'hueco' | 'verdadero_falso';

export interface Ejercicio {
  tipo: TipoEjercicio;
  enunciado: string;
  opciones: string[];
  correcta: number;
  pagina: number | null;
  explicacion: string | null;
}

export interface Leccion {
  chapterId: string;
  titulo: string;
  paginaInicio: number;
  paginaFin: number;
  ejercicios: Ejercicio[];
}

export interface ResultadoLeccion {
  xp: number;
  coronas: number;
  corona: boolean;
  resumen: ResumenGamificacion;
}

/** El XP por nivel del backend, para pintar la barra. */
export const XP_POR_NIVEL = 100;

@Injectable({ providedIn: 'root' })
export class AprendizajeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/aprendizaje`;

  /** El día del estudiante termina en su zona horaria, no en UTC. */
  private get desfase(): HttpParams {
    return new HttpParams().set('desfase', String(new Date().getTimezoneOffset()));
  }

  resumen(): Observable<ResumenGamificacion> {
    return this.http.get<ResumenGamificacion>(`${this.base}/resumen`, { params: this.desfase });
  }

  ruta(documentId: string): Observable<RutaLibro> {
    return this.http.get<RutaLibro>(`${this.base}/documentos/${documentId}/ruta`);
  }

  leccion(documentId: string, chapterId: string): Observable<Leccion> {
    return this.http.get<Leccion>(
      `${this.base}/documentos/${documentId}/unidades/${chapterId}/leccion`,
    );
  }

  regenerarLeccion(documentId: string, chapterId: string): Observable<Leccion> {
    return this.http.post<Leccion>(
      `${this.base}/documentos/${documentId}/unidades/${chapterId}/leccion/regenerar`,
      {},
    );
  }

  registrar(
    documentId: string,
    chapterId: string,
    aciertos: number,
    total: number,
  ): Observable<ResultadoLeccion> {
    return this.http.post<ResultadoLeccion>(
      `${this.base}/documentos/${documentId}/unidades/${chapterId}/intentos`,
      { aciertos, total },
      { params: this.desfase },
    );
  }
}
