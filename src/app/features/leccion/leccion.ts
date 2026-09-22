import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  AprendizajeService,
  Ejercicio,
  Leccion as LeccionArmada,
  ResultadoLeccion,
} from '../../core/services/aprendizaje.service';
import { DisposicionService } from '../../core/services/disposicion.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { Icono } from '../../shared/icono/icono';
import { EstadoLumo, Lumo } from '../../shared/lumo/lumo';

type Fase = 'cargando' | 'ejercicio' | 'final' | 'error';

const INSTRUCCION: Record<Ejercicio['tipo'], string> = {
  opcion: 'Elige la opción correcta',
  hueco: 'Completa la frase',
  verdadero_falso: '¿Verdadero o falso?',
};

/** Frases de Lumo al acertar y al fallar; se rotan para no repetir. */
const ANIMOS_BIEN = ['¡Eso es!', '¡Muy bien!', '¡Exacto!', '¡Sigue así!', '¡Perfecto!'];
const ANIMOS_MAL = ['Casi. Mira lo que decía el libro:', 'No pasa nada, así se aprende:', 'Uy. El libro lo cuenta así:'];

const PIEZAS_CONFETI = 28;
const COLORES_CONFETI = ['#b4552e', '#3f8457', '#e0a911', '#7c5cbf', '#3f6d9e', '#e8672a'];

@Component({
  selector: 'app-leccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, Lumo],
  templateUrl: './leccion.html',
  styleUrl: './leccion.scss',
  host: {
    '(document:keydown)': 'alTeclear($event)',
  },
})
export class Leccion {
  readonly documentId = input.required<string>();
  readonly chapterId = input.required<string>();

  private readonly aprendizaje = inject(AprendizajeService);
  private readonly disposicion = inject(DisposicionService);
  private readonly gamificacion = inject(GamificacionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly fase = signal<Fase>('cargando');
  readonly leccion = signal<LeccionArmada | null>(null);
  readonly error = signal<string | null>(null);
  readonly indice = signal(0);
  readonly elegida = signal<number | null>(null);
  readonly comprobado = signal(false);
  readonly aciertos = signal(0);
  readonly resultado = signal<ResultadoLeccion | null>(null);
  readonly guardando = signal(false);

  readonly ejercicios = computed(() => this.leccion()?.ejercicios ?? []);
  readonly actual = computed<Ejercicio | null>(() => this.ejercicios()[this.indice()] ?? null);
  readonly total = computed(() => this.ejercicios().length);
  readonly avance = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.indice() / this.total()) * 100),
  );
  readonly acerto = computed(() => {
    const ejercicio = this.actual();
    return !!ejercicio && this.comprobado() && this.elegida() === ejercicio.correcta;
  });

  readonly instruccion = computed(() => {
    const ejercicio = this.actual();
    return ejercicio ? INSTRUCCION[ejercicio.tipo] : '';
  });

  /** Partes de la frase con hueco, para resaltar el espacio en blanco. */
  readonly partesHueco = computed(() => {
    const ejercicio = this.actual();
    if (!ejercicio || ejercicio.tipo !== 'hueco') return null;
    const [antes, ...resto] = ejercicio.enunciado.split('_____');
    return { antes, despues: resto.join('_____') };
  });

  readonly estadoLumo = computed<EstadoLumo>(() => {
    if (this.fase() === 'final') return 'celebra';
    if (this.fase() === 'cargando') return 'piensa';
    if (!this.comprobado()) return 'neutro';
    return this.acerto() ? 'celebra' : 'neutro';
  });

  readonly animo = computed(() => {
    const paso = this.indice();
    return this.acerto()
      ? ANIMOS_BIEN[paso % ANIMOS_BIEN.length]
      : ANIMOS_MAL[paso % ANIMOS_MAL.length];
  });

  readonly porcentaje = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.aciertos() / this.total()) * 100),
  );

  readonly confeti = Array.from({ length: PIEZAS_CONFETI }, (_, i) => ({
    izquierda: (i * 37) % 100,
    retardo: (i % 7) * 0.12,
    color: COLORES_CONFETI[i % COLORES_CONFETI.length],
    giro: (i * 53) % 360,
  }));

  /** La celebración con confeti no tiene sentido si el sistema pide menos movimiento. */
  readonly conConfeti =
    typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // La lección va a pantalla completa: la barra lateral se pliega mientras dure.
    this.disposicion.forzarLateralPlegada(true);
    this.destroyRef.onDestroy(() => this.disposicion.forzarLateralPlegada(false));

    effect(() => {
      const documentId = this.documentId();
      const chapterId = this.chapterId();
      if (documentId && chapterId) this.cargar(documentId, chapterId);
    });
  }

  elegir(opcion: number): void {
    if (this.comprobado()) return;
    this.elegida.set(opcion);
  }

  comprobar(): void {
    const ejercicio = this.actual();
    if (!ejercicio || this.elegida() === null || this.comprobado()) return;

    this.comprobado.set(true);
    if (this.elegida() === ejercicio.correcta) this.aciertos.update((n) => n + 1);
  }

  continuar(): void {
    if (!this.comprobado()) return;

    if (this.indice() + 1 >= this.total()) {
      this.terminar();
      return;
    }

    this.indice.update((i) => i + 1);
    this.elegida.set(null);
    this.comprobado.set(false);
  }

  otraLeccion(): void {
    this.fase.set('cargando');
    this.aprendizaje.regenerarLeccion(this.documentId(), this.chapterId()).subscribe({
      next: (leccion) => this.empezar(leccion),
      error: (respuesta: { error?: { message?: string } }) =>
        this.fallar(respuesta.error?.message ?? 'No se pudo preparar otra lección.'),
    });
  }

  volverALaRuta(): void {
    void this.router.navigate(['/progreso']);
  }

  /** 1–4 eligen una opción; Enter comprueba o continúa. */
  alTeclear(evento: KeyboardEvent): void {
    if (this.fase() !== 'ejercicio') return;

    if (evento.key === 'Enter') {
      evento.preventDefault();
      this.comprobado() ? this.continuar() : this.comprobar();
      return;
    }

    const numero = Number(evento.key);
    const opciones = this.actual()?.opciones.length ?? 0;
    if (numero >= 1 && numero <= opciones) this.elegir(numero - 1);
  }

  claseOpcion(indice: number): string {
    const ejercicio = this.actual();
    if (!ejercicio) return '';

    if (!this.comprobado()) return this.elegida() === indice ? 'opcion--elegida' : '';
    if (indice === ejercicio.correcta) return 'opcion--correcta';
    return this.elegida() === indice ? 'opcion--fallo' : 'opcion--apagada';
  }

  private cargar(documentId: string, chapterId: string): void {
    this.fase.set('cargando');
    this.error.set(null);

    this.aprendizaje.leccion(documentId, chapterId).subscribe({
      next: (leccion) => this.empezar(leccion),
      error: (respuesta: { error?: { message?: string } }) =>
        this.fallar(respuesta.error?.message ?? 'No se pudo preparar la lección.'),
    });
  }

  private empezar(leccion: LeccionArmada): void {
    this.leccion.set(leccion);
    this.indice.set(0);
    this.elegida.set(null);
    this.comprobado.set(false);
    this.aciertos.set(0);
    this.resultado.set(null);
    this.fase.set(leccion.ejercicios.length > 0 ? 'ejercicio' : 'error');
    if (leccion.ejercicios.length === 0) this.error.set('Esta unidad no tiene ejercicios todavía.');
  }

  private fallar(mensaje: string): void {
    this.error.set(mensaje);
    this.fase.set('error');
  }

  private terminar(): void {
    this.fase.set('final');
    this.guardando.set(true);

    this.aprendizaje
      .registrar(this.documentId(), this.chapterId(), this.aciertos(), this.total())
      .subscribe({
        next: (resultado) => {
          this.resultado.set(resultado);
          this.gamificacion.actualizar(resultado.resumen);
          this.guardando.set(false);
        },
        // La pantalla final se muestra igual: el alumno ya hizo el trabajo.
        error: () => {
          this.error.set('No se pudo guardar el resultado, pero la lección cuenta para ti.');
          this.guardando.set(false);
        },
      });
  }
}
