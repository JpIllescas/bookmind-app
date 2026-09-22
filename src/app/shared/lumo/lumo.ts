import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

/** Qué está haciendo Lumo; cada estado cambia la cara y la animación. */
export type EstadoLumo = 'neutro' | 'saluda' | 'piensa' | 'celebra' | 'duerme';

/** Reacción al tocarlo: escala con toques seguidos. */
type Reaccion = 'sorpresa' | 'guino' | 'risa';

/** Gestos espontáneos entre estados, para que no se quede tieso. */
type Gesto = 'mirar' | 'oreja' | 'lentes' | 'cola';

/** Los degradados del SVG llevan id: con varios Lumo en pantalla deben ser únicos. */
let secuencia = 0;

/** Hasta dónde se desplaza la pupila (unidades del viewBox) y en qué tramo deja de seguir. */
const MIRADA_MAX = 2.8;
const MIRADA_ALCANCE = 560;
const MIRADA_DESVANECE = 360;
/** Cuánto gira la cabeza hacia el puntero. */
const GIRO_MAX = 5;

const DURACION_REACCION: Record<Reaccion, number> = { sorpresa: 700, guino: 900, risa: 1100 };
const VENTANA_TOQUES = 1800;

/**
 * Lumo, el zorro lector de BookMind. Es un SVG dibujado a mano para poder
 * animar partes sueltas (orejas, brazos, ojos, cola) sin imágenes ni librerías.
 */
@Component({
  selector: 'app-lumo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'clases()',
    '[style.--tamano.px]': 'tamano()',
  },
  templateUrl: './lumo.html',
  styleUrl: './lumo.scss',
})
export class Lumo {
  readonly estado = input<EstadoLumo>('neutro');
  readonly tamano = input(120);
  /** Si llega texto, Lumo lo dice en una burbuja. */
  readonly mensaje = input<string | null>(null);
  /** De qué lado del zorro sale la burbuja. */
  readonly lado = input<'derecha' | 'izquierda' | 'arriba'>('derecha');
  /** Sin interacción cuando está junto a controles (nodo de la ruta, pie de la lección). */
  readonly interactivo = input(true);

  /** El estudiante tocó a Lumo: la pantalla puede responder con un consejo. */
  readonly toque = output<void>();

  readonly uid = `lumo-${++secuencia}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly reaccion = signal<Reaccion | null>(null);
  private readonly gesto = signal<Gesto | null>(null);
  private readonly atento = signal(false);

  private cuadroPendiente = 0;
  private toquesSeguidos = 0;
  private ventanaToques: ReturnType<typeof setTimeout> | null = null;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  /** Cambia con cada mensaje para que la plantilla recree la burbuja. */
  readonly alterno = signal(false);

  clases(): string {
    const partes = ['lumo', `lumo--${this.estado()}`, `lumo--${this.lado()}`];
    if (this.mensaje()) partes.push('lumo--con-burbuja');
    if (!this.interactivo()) partes.push('lumo--pasivo');
    if (this.atento()) partes.push('lumo--atento');
    const reaccion = this.reaccion();
    if (reaccion) partes.push(`lumo--${reaccion}`);
    const gesto = this.gesto();
    if (gesto) partes.push(`lumo--gesto-${gesto}`);
    return partes.join(' ');
  }

  constructor() {
    effect(() => {
      this.mensaje();
      untracked(() => this.alterno.update((valor) => !valor));
    });

    afterNextRender(() => {
      if (this.sinMovimiento()) return;
      this.programarGesto();
      if (this.interactivo()) {
        document.addEventListener('pointermove', this.seguirPuntero, { passive: true });
      }
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('pointermove', this.seguirPuntero);
      cancelAnimationFrame(this.cuadroPendiente);
      this.temporizadores.forEach(clearTimeout);
      if (this.ventanaToques) clearTimeout(this.ventanaToques);
    });
  }

  /** Con teclado, Enter y espacio equivalen al toque. */
  alTecla(evento: Event): void {
    evento.preventDefault();
    this.alPulsar();
  }

  alPulsar(): void {
    if (!this.interactivo()) return;
    this.toque.emit();
    if (this.sinMovimiento() || this.reaccion()) return;

    // Toques seguidos escalan: respingo, guiño y, al tercero, risa.
    this.toquesSeguidos++;
    const reaccion: Reaccion =
      this.toquesSeguidos === 1 ? 'sorpresa' : this.toquesSeguidos === 2 ? 'guino' : 'risa';
    this.reaccion.set(reaccion);
    this.esperar(() => this.reaccion.set(null), DURACION_REACCION[reaccion]);
    // La ventana se reinicia con cada toque: cuenta la cadencia, no el primer toque.
    if (this.ventanaToques) clearTimeout(this.ventanaToques);
    this.ventanaToques = setTimeout(() => (this.toquesSeguidos = 0), VENTANA_TOQUES);
  }

  alEntrar(): void {
    if (this.interactivo()) this.atento.set(true);
  }

  alSalir(): void {
    this.atento.set(false);
  }

  /** Cada 6–14 s hace un gesto pequeño; dormido solo mueve la oreja. */
  private programarGesto(): void {
    this.esperar(() => {
      if (document.visibilityState === 'visible' && !this.gesto() && !this.reaccion()) {
        const opciones: Gesto[] =
          this.estado() === 'duerme' ? ['oreja'] : ['mirar', 'oreja', 'lentes', 'cola'];
        this.gesto.set(opciones[Math.floor(Math.random() * opciones.length)]);
        this.esperar(() => this.gesto.set(null), 1500);
      }
      this.programarGesto();
    }, 6000 + Math.random() * 8000);
  }

  /** Las pupilas y la cabeza siguen al puntero mientras esté cerca; de lejos vuelven al centro. */
  private readonly seguirPuntero = (evento: PointerEvent): void => {
    cancelAnimationFrame(this.cuadroPendiente);
    this.cuadroPendiente = requestAnimationFrame(() => {
      const svg = this.host.nativeElement.querySelector('svg');
      if (!svg) return;
      const caja = svg.getBoundingClientRect();
      // Los ojos están a un 39 % de la altura del dibujo.
      const dx = evento.clientX - (caja.left + caja.width / 2);
      const dy = evento.clientY - (caja.top + caja.height * 0.39);
      const distancia = Math.hypot(dx, dy);
      let x = 0;
      let y = 0;
      let giro = 0;
      if (distancia > 0 && distancia < MIRADA_ALCANCE) {
        // Sube rápido cerca y se apaga gradualmente al alejarse: sin saltos en el borde.
        const cercania = Math.min(1, distancia / 140);
        const lejania = Math.max(0, distancia - MIRADA_DESVANECE) / (MIRADA_ALCANCE - MIRADA_DESVANECE);
        const fuerza = cercania * (1 - lejania);
        x = (dx / distancia) * fuerza * MIRADA_MAX;
        y = (dy / distancia) * fuerza * MIRADA_MAX * 0.8;
        giro = (dx / distancia) * fuerza * GIRO_MAX;
      }
      const estilo = this.host.nativeElement.style;
      estilo.setProperty('--mirada-x', `${x.toFixed(2)}px`);
      estilo.setProperty('--mirada-y', `${y.toFixed(2)}px`);
      estilo.setProperty('--giro', `${giro.toFixed(2)}deg`);
    });
  };

  private esperar(accion: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.temporizadores = this.temporizadores.filter((otro) => otro !== id);
      accion();
    }, ms);
    this.temporizadores.push(id);
  }

  /** Las reacciones por clase no pasan por la regla global de reduced-motion. */
  private sinMovimiento(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
