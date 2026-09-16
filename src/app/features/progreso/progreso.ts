import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  Documento,
  ProgressSummary,
  StudyPlan,
  StudyTask,
} from '../../core/models/documento.model';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { StudyService } from '../../core/services/study.service';
import { Icono } from '../../shared/icono/icono';

@Component({
  selector: 'app-progreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  templateUrl: './progreso.html',
  styleUrl: './progreso.scss',
})
export class Progreso {
  private readonly api = inject(StudyService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly resumen = signal<ProgressSummary | null>(null);
  readonly planes = signal<StudyPlan[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Id del documento cuyo plan se está generando; bloquea solo esa tarjeta. */
  readonly generando = signal<string | null>(null);
  readonly creando = signal(false);

  readonly nuevoTitulo = signal('');
  readonly nuevaFecha = signal('');

  readonly libros = computed(() => this.resumen()?.documents ?? []);
  readonly sinLibros = computed(() => !this.cargando() && this.libros().length === 0);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.api.progreso().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar tu progreso.');
        this.cargando.set(false);
      },
    });

    this.api.planes().subscribe({
      next: (planes) => this.planes.set(planes),
      error: () => this.error.set('No se pudieron cargar tus planes de estudio.'),
    });
  }

  /** Página aproximada por la que va el libro, según el avance guardado. */
  paginaActual(libro: Documento): number {
    return Math.max(Math.round((libro.progress / 100) * libro.pages), 0);
  }

  marcarTerminado(libro: Documento): void {
    this.guardarAvance(libro, libro.progress >= 100 ? 0 : 100);
  }

  crearPlan(): void {
    const title = this.nuevoTitulo().trim();
    if (!title || this.creando()) return;

    this.creando.set(true);

    this.api.crearPlan(title, this.nuevaFecha() || undefined, []).subscribe({
      next: (plan) => {
        this.planes.update((planes) => [plan, ...planes]);
        this.nuevoTitulo.set('');
        this.nuevaFecha.set('');
        this.creando.set(false);
      },
      error: () => {
        this.notificaciones.error('No se pudo crear el plan.');
        this.creando.set(false);
      },
    });
  }

  generarPlan(libro: Documento): void {
    if (this.generando()) return;
    this.generando.set(libro.id);

    this.api.generarPlan(libro.id).subscribe({
      next: (plan) => {
        this.planes.update((planes) => [plan, ...planes]);
        this.generando.set(null);
      },
      error: () => {
        this.notificaciones.error('No se pudo generar el plan con IA.');
        this.generando.set(null);
      },
    });
  }

  completar(plan: StudyPlan, indice: number): void {
    this.api.completarTarea(plan.id, indice).subscribe({
      next: (actualizado) =>
        this.planes.update((planes) =>
          planes.map((actual) => (actual.id === actualizado.id ? actualizado : actual)),
        ),
      error: () => this.notificaciones.error('No se pudo marcar la tarea.'),
    });
  }

  tareasHechas(plan: StudyPlan): number {
    return plan.tasks.filter((tarea) => tarea.completed).length;
  }

  etiquetaSesion(tarea: StudyTask, indice: number): string {
    return `Sesión ${tarea.session ?? indice + 1}`;
  }

  cambiarTitulo(evento: Event): void {
    this.nuevoTitulo.set((evento.target as HTMLInputElement).value);
  }

  cambiarFecha(evento: Event): void {
    this.nuevaFecha.set((evento.target as HTMLInputElement).value);
  }

  private guardarAvance(libro: Documento, progress: number): void {
    // Optimista: la barra se mueve al instante y se corrige si el backend falla.
    this.actualizarEnLista(libro.id, progress);

    this.api.actualizarProgreso(libro.id, progress).subscribe({
      error: () => {
        this.actualizarEnLista(libro.id, libro.progress);
        this.notificaciones.error('No se pudo guardar el avance.');
      },
    });
  }

  private actualizarEnLista(id: string, progress: number): void {
    this.resumen.update((resumen) => {
      if (!resumen) return resumen;

      const documents = resumen.documents.map((documento) =>
        documento.id === id ? { ...documento, progress } : documento,
      );

      const total = documents.length;

      return {
        ...resumen,
        documents,
        completed: documents.filter((d) => d.progress >= 100).length,
        started: documents.filter((d) => d.progress > 0 && d.progress < 100).length,
        average: total
          ? Math.round(documents.reduce((suma, d) => suma + d.progress, 0) / total)
          : 0,
      };
    });
  }
}
