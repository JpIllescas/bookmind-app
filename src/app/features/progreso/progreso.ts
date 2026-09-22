import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  Documento,
  ProgressSummary,
  StudyPlan,
  StudyTask,
} from '../../core/models/documento.model';
import {
  AprendizajeService,
  RutaLibro,
  UnidadRuta,
  XP_POR_NIVEL,
} from '../../core/services/aprendizaje.service';
import { AuthService } from '../../core/services/auth.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { StudyService } from '../../core/services/study.service';
import { Icono } from '../../shared/icono/icono';
import { EstadoLumo, Lumo } from '../../shared/lumo/lumo';
import { paletaDe } from '../../shared/portada/paleta-portada';
import { Portada } from '../../shared/portada/portada';

/** Desvío horizontal de cada nodo: el camino serpentea como en Duolingo. */
const SERPENTEO = [0, 56, 88, 56, 0, -56, -88, -56];

const CLAVE_LIBRO = 'bookmind.ruta-libro';

type Pestana = 'ruta' | 'lecturas';

@Component({
  selector: 'app-progreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, Lumo, Portada],
  templateUrl: './progreso.html',
  styleUrl: './progreso.scss',
})
export class Progreso {
  private readonly api = inject(StudyService);
  private readonly aprendizaje = inject(AprendizajeService);
  private readonly auth = inject(AuthService);
  private readonly gamificacionStore = inject(GamificacionService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  readonly xpPorNivel = XP_POR_NIVEL;
  readonly paletaDe = paletaDe;

  readonly pestana = signal<Pestana>('ruta');
  readonly gamificacion = this.gamificacionStore.resumen;
  readonly ruta = signal<RutaLibro | null>(null);
  readonly cargandoRuta = signal(false);
  readonly errorRuta = signal<string | null>(null);
  /** Libro cuya ruta se muestra; se recuerda entre visitas. */
  readonly libroActivo = signal<string | null>(this.leerLibroGuardado());
  /** Nodo con el globo de "Empezar" abierto. */
  readonly nodoAbierto = signal<string | null>(null);

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

  /** Solo los libros ya indexados tienen capítulos y, por tanto, ruta. */
  readonly librosConRuta = computed(() =>
    this.libros().filter((l) => l.processingStatus === 'ready' && l.textLayer === 'ok'),
  );

  readonly primerNombre = computed(() => this.auth.usuario()?.name?.split(/\s+/)[0] ?? '');

  readonly progresoMeta = computed(() => {
    const g = this.gamificacion();
    if (!g || g.metaDiaria === 0) return 0;
    return Math.min(100, Math.round((g.xpHoy / g.metaDiaria) * 100));
  });

  readonly estadoLumo = computed<EstadoLumo>(() => {
    const g = this.gamificacion();
    if (!g) return 'neutro';
    if (g.rachaEnRiesgo) return 'duerme';
    if (g.xpHoy >= g.metaDiaria) return 'celebra';
    return 'saluda';
  });

  readonly mensajeLumo = computed(() => {
    const g = this.gamificacion();
    const nombre = this.primerNombre();
    if (!g) return `Hola${nombre ? ', ' + nombre : ''}. Cargando tu avance…`;
    if (g.rachaEnRiesgo) {
      return `Tu racha de ${g.racha} ${g.racha === 1 ? 'día' : 'días'} se apaga hoy. Una lección y la salvamos.`;
    }
    if (g.xpHoy >= g.metaDiaria) return `Meta del día cumplida, ${nombre}. Lo que hagas ahora suma como extra.`;
    if (g.xpHoy > 0) return `Vas por ${g.xpHoy} de ${g.metaDiaria} XP. Te faltan ${g.metaDiaria - g.xpHoy}.`;
    return `Hola, ${nombre}. Hoy todavía no has estudiado. ¿Una lección corta?`;
  });

  constructor() {
    this.cargar();
    this.cargarGamificacion();

    // La ruta se recarga al cambiar de libro o al volver de una lección.
    effect(() => {
      const id = this.libroActivo();
      if (id) this.cargarRuta(id);
    });
  }

  // --- Ruta de aprendizaje ---

  elegirLibro(id: string): void {
    this.libroActivo.set(id);
    this.nodoAbierto.set(null);
    try {
      localStorage.setItem(CLAVE_LIBRO, id);
    } catch {
      // Sin almacenamiento la elección dura la sesión.
    }
  }

  mostrar(pestana: Pestana): void {
    this.pestana.set(pestana);
  }

  desvioDe(indice: number): number {
    return SERPENTEO[indice % SERPENTEO.length];
  }

  alternarNodo(unidad: UnidadRuta): void {
    if (unidad.estado === 'bloqueada') {
      this.notificaciones.error('Termina la unidad anterior con al menos una corona para desbloquear esta.');
      return;
    }
    this.nodoAbierto.update((actual) => (actual === unidad.chapterId ? null : unidad.chapterId));
  }

  empezar(unidad: UnidadRuta): void {
    const ruta = this.ruta();
    if (!ruta) return;
    void this.router.navigate(['/leccion', ruta.documento.id, unidad.chapterId]);
  }

  textoNodo(unidad: UnidadRuta): string {
    switch (unidad.estado) {
      case 'dominada':
        return 'Dominada · 5 coronas';
      case 'aprobada':
        return `${unidad.coronas} ${unidad.coronas === 1 ? 'corona' : 'coronas'} · mejor ${unidad.mejor}%`;
      case 'en_curso':
        return `Mejor intento ${unidad.mejor}% · aún sin corona`;
      case 'bloqueada':
        return 'Bloqueada';
      default:
        return 'Lista para empezar';
    }
  }

  private cargarGamificacion(): void {
    this.gamificacionStore.cargar();
  }

  private cargarRuta(id: string): void {
    this.cargandoRuta.set(true);
    this.errorRuta.set(null);

    this.aprendizaje.ruta(id).subscribe({
      next: (ruta) => {
        if (this.libroActivo() !== id) return;
        this.ruta.set(ruta);
        this.nodoAbierto.set(ruta.unidades[ruta.actual]?.chapterId ?? null);
        this.cargandoRuta.set(false);
      },
      error: () => {
        this.errorRuta.set('No se pudo cargar la ruta de este libro.');
        this.cargandoRuta.set(false);
      },
    });
  }

  private leerLibroGuardado(): string | null {
    try {
      return localStorage.getItem(CLAVE_LIBRO);
    } catch {
      return null;
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.api.progreso().subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        this.cargando.set(false);

        // Sin libro elegido (o ya borrado), la ruta abre con el primero disponible.
        const candidatos = this.librosConRuta();
        const activo = this.libroActivo();
        if (candidatos.length > 0 && !candidatos.some((l) => l.id === activo)) {
          this.elegirLibro(candidatos[0].id);
        }
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
