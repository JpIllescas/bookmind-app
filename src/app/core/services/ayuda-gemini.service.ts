import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { NotificacionesService } from './notificaciones.service';

/** `disponible` lo decide el servidor (LLM_PROVIDER); `activada`, el estudiante. */
export interface EstadoAyudaGemini {
  activada: boolean;
  disponible: boolean;
}

/** Interruptor "Ayuda de Gemini": uno solo para el Studio y el chat. */
@Injectable({ providedIn: 'root' })
export class AyudaGeminiService {
  private readonly http = inject(HttpClient);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly url = `${environment.apiUrl}/users/ayuda-gemini`;

  private readonly estado = signal<EstadoAyudaGemini | null>(null);
  private pidiendo = false;

  readonly cargado = computed(() => this.estado() !== null);
  readonly activada = computed(() => this.estado()?.activada ?? true);
  readonly disponible = computed(() => this.estado()?.disponible ?? false);
  /** Lo que de verdad pasa: Gemini solo redacta si las dos cosas se cumplen. */
  readonly enUso = computed(() => this.activada() && this.disponible());

  cargar(): void {
    if (this.estado() || this.pidiendo) return;
    this.pidiendo = true;
    this.http.get<EstadoAyudaGemini>(this.url).subscribe({
      next: (estado) => this.estado.set(estado),
      // Sin respuesta el interruptor queda deshabilitado; el backend decide igual.
      error: () => (this.pidiendo = false),
    });
  }

  cambiar(activada: boolean): void {
    const previo = this.estado();
    if (!previo || !previo.disponible || previo.activada === activada) return;

    // Se ve al instante; si el servidor no lo guarda, vuelve atrás.
    this.estado.set({ ...previo, activada });
    this.http.put<EstadoAyudaGemini>(this.url, { activada }).subscribe({
      next: (estado) => this.estado.set(estado),
      error: () => {
        this.estado.set(previo);
        this.notificaciones.error('No pudimos guardar el cambio de la ayuda de Gemini. Intenta de nuevo.');
      },
    });
  }
}
