import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface FuenteBiblioteca {
  documentId: string;
  titulo: string;
  tinte: string;
  pagina: number;
  extracto: string;
  score: number;
}

export interface RespuestaBiblioteca {
  respuesta: string;
  fuentes: FuenteBiblioteca[];
}

export type EstadoAsistente =
  | 'operativo'
  | 'saturado'
  | 'sin_cuota'
  | 'con_fallos'
  | 'sin_datos'
  | 'simulado';

export interface LlamadaReciente {
  instante: string;
  ms: number;
  resultado: 'ok' | 'saturado' | 'cuota' | 'error';
}

export interface EstadoMotor {
  proveedor: string;
  modelo: string;
  simulado: boolean;
  estado: EstadoAsistente;
  ventanaMinutos: number;
  llamadas: number;
  exitosas: number;
  saturaciones: number;
  cuotaAgotada: number;
  errores: number;
  reintentos: number;
  latenciaMediaMs: number | null;
  latenciaMedianaMs: number | null;
  latenciaP95Ms: number | null;
  ultimaLlamada: string | null;
  ultimoFallo: { cuando: string; resultado: string; mensaje: string | null } | null;
  recientes: LlamadaReciente[];
}

@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private readonly http = inject(HttpClient);

  preguntar(pregunta: string): Observable<RespuestaBiblioteca> {
    return this.http.post<RespuestaBiblioteca>(
      `${environment.apiUrl}/assistant/preguntar`,
      { pregunta },
    );
  }

  estado(): Observable<EstadoMotor> {
    return this.http.get<EstadoMotor>(`${environment.apiUrl}/assistant/estado`);
  }

  probar(): Observable<{ ok: boolean; ms: number; mensaje: string | null }> {
    return this.http.post<{ ok: boolean; ms: number; mensaje: string | null }>(
      `${environment.apiUrl}/assistant/probar`,
      {},
    );
  }
}
