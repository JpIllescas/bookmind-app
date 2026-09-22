import { Injectable, computed, inject, signal } from '@angular/core';

import { AprendizajeService, ResumenGamificacion, XP_POR_NIVEL } from './aprendizaje.service';

/** Racha, XP y meta del día compartidos: la barra lateral y varias pantallas los muestran. */
@Injectable({ providedIn: 'root' })
export class GamificacionService {
  private readonly aprendizaje = inject(AprendizajeService);

  readonly resumen = signal<ResumenGamificacion | null>(null);
  readonly cargando = signal(false);

  readonly progresoMeta = computed(() => {
    const g = this.resumen();
    if (!g || g.metaDiaria === 0) return 0;
    return Math.min(100, Math.round((g.xpHoy / g.metaDiaria) * 100));
  });

  readonly progresoNivel = computed(() => {
    const g = this.resumen();
    return g ? Math.round((g.xpEnNivel / XP_POR_NIVEL) * 100) : 0;
  });

  readonly metaCumplida = computed(() => {
    const g = this.resumen();
    return !!g && g.xpHoy >= g.metaDiaria;
  });

  cargar(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.aprendizaje.resumen().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      // Sin racha no se rompe nada: los widgets simplemente no aparecen.
      error: () => this.cargando.set(false),
    });
  }

  /** El backend devuelve el resumen actualizado al terminar una lección. */
  actualizar(resumen: ResumenGamificacion): void {
    this.resumen.set(resumen);
  }

  limpiar(): void {
    this.resumen.set(null);
  }
}
