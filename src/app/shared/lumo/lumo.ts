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

import {
  type Elasticidad,
  RITMOS,
  aperturaOjos,
  avanzarResorte,
  crearResorte,
  duracionParpadeo,
  inclinacion,
  miradaFija,
  miradaHacia,
  respiracion,
  siguienteParpadeo,
  vaivenCola,
} from './movimiento-lumo';

/** Qué está haciendo Lumo; cada estado cambia la cara y la animación. */
export type EstadoLumo = 'neutro' | 'saluda' | 'piensa' | 'celebra' | 'duerme' | 'asiente' | 'apenado' | 'anima';

/** Hacia dónde mira cuando la pantalla le pide atender algo (el texto que escribes, la respuesta que llega). */
export type FocoLumo = 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'abajo-izquierda';

/** Reacción al tocarlo: escala con toques seguidos. */
type Reaccion = 'sorpresa' | 'guino' | 'risa';

/** Gestos espontáneos entre estados, para que no se quede tieso. */
type Gesto = 'mirar' | 'oreja' | 'lentes' | 'cola';

/** Los degradados del SVG llevan id: con varios Lumo en pantalla deben ser únicos. */
let secuencia = 0;

const DURACION_REACCION: Record<Reaccion, number> = { sorpresa: 700, guino: 900, risa: 1100 };
const VENTANA_TOQUES = 1800;

/** La cabeza es firme; orejas y cola, más blandas, se quedan atrás y rebotan. */
const CABEZA: Elasticidad = { rigidez: 140, amortiguacion: 20 };
const OJOS: Elasticidad = { rigidez: 260, amortiguacion: 28 };
const OREJAS: Elasticidad = { rigidez: 90, amortiguacion: 7 };
const COLA: Elasticidad = { rigidez: 40, amortiguacion: 6 };
const PUNTA: Elasticidad = { rigidez: 28, amortiguacion: 4 };
const BUFANDA: Elasticidad = { rigidez: 30, amortiguacion: 5 };

/**
 * Lumo, el zorro lector de BookMind. Es un SVG dibujado a mano para poder
 * animar partes sueltas (orejas, brazos, ojos, cola) sin imágenes ni librerías.
 * Las expresiones van por clases; el movimiento continuo, por resortes en variables CSS.
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
  /** Si llega, mira hacia allí en vez de seguir al puntero. */
  readonly foco = input<FocoLumo | null>(null);

  /** El estudiante tocó a Lumo: la pantalla puede responder con un consejo. */
  readonly toque = output<void>();

  readonly uid = `lumo-${++secuencia}`;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly reaccion = signal<Reaccion | null>(null);
  private readonly gesto = signal<Gesto | null>(null);
  private readonly atento = signal(false);

  private toquesSeguidos = 0;
  private ventanaToques: ReturnType<typeof setTimeout> | null = null;
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  private readonly cabeza = crearResorte();
  private readonly miradaX = crearResorte();
  private readonly miradaY = crearResorte();
  private readonly orejas = crearResorte();
  private readonly cola = crearResorte();
  private readonly punta = crearResorte();
  private readonly bufanda = crearResorte();
  /** Último puntero visto; se convierte en mirada dentro del cuadro, no en cada movimiento. */
  private puntero: { x: number; y: number } | null = null;

  private cuadro = 0;
  private anterior = 0;
  private enPantalla = true;
  private parpadeo = { inicio: 0, doble: false };
  private observador: IntersectionObserver | null = null;

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

    // Cada cambio de estado sacude un poco orejas y cola: se nota que reaccionó, no que cambió de dibujo.
    effect(() => {
      const estado = this.estado();
      untracked(() => {
        if (estado === 'duerme') return;
        this.orejas.velocidad += estado === 'saluda' ? 80 : 40;
        this.cola.velocidad += estado === 'celebra' ? 200 : 60;
      });
    });

    afterNextRender(() => {
      if (this.sinMovimiento()) return;
      this.programarParpadeo(performance.now());
      this.programarGesto();
      if (this.interactivo()) {
        document.addEventListener('pointermove', this.seguirPuntero, { passive: true });
      }
      document.addEventListener('visibilitychange', this.reanudarOPausar);
      // Fuera de pantalla no se anima: con varios Lumo a la vez solo cuestan los visibles.
      if (typeof IntersectionObserver === 'function') {
        this.observador = new IntersectionObserver(([entrada]) => {
          this.enPantalla = entrada.isIntersecting;
          this.reanudarOPausar();
        });
        this.observador.observe(this.host.nativeElement);
      }
      this.reanudarOPausar();
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('pointermove', this.seguirPuntero);
      document.removeEventListener('visibilitychange', this.reanudarOPausar);
      this.observador?.disconnect();
      cancelAnimationFrame(this.cuadro);
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
    // El respingo sacude orejas y cola; el resorte hace el rebote.
    if (reaccion === 'sorpresa') {
      this.orejas.velocidad -= 90;
      this.cola.velocidad -= 160;
    }
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
        const gesto = opciones[Math.floor(Math.random() * opciones.length)];
        // Oreja y cola son un impulso al resorte: el sacudón y su rebote salen solos.
        if (gesto === 'oreja') this.orejas.velocidad += 70;
        else if (gesto === 'cola') this.cola.velocidad += 140;
        else {
          this.gesto.set(gesto);
          this.esperar(() => this.gesto.set(null), 1500);
        }
      }
      this.programarGesto();
    }, 6000 + Math.random() * 8000);
  }

  private programarParpadeo(desde: number): void {
    const { espera, doble } = siguienteParpadeo();
    this.parpadeo = { inicio: desde + espera, doble };
  }

  private readonly seguirPuntero = (evento: PointerEvent): void => {
    this.puntero = { x: evento.clientX, y: evento.clientY };
  };

  /** Las pupilas y la cabeza siguen al puntero mientras esté cerca; de lejos vuelven al centro. */
  private miradaAlPuntero(): { x: number; y: number; giro: number } {
    const svg = this.host.nativeElement.querySelector('svg');
    if (!this.puntero || !svg) return { x: 0, y: 0, giro: 0 };
    // Se mide antes de escribir estilos en el cuadro: leer después forzaría recalcular el layout.
    const caja = svg.getBoundingClientRect();
    // Los ojos están a un 39 % de la altura del dibujo.
    return miradaHacia(this.puntero.x - (caja.left + caja.width / 2), this.puntero.y - (caja.top + caja.height * 0.39));
  }

  private readonly reanudarOPausar = (): void => {
    const animar = this.enPantalla && document.visibilityState === 'visible';
    if (animar && !this.cuadro) {
      this.anterior = performance.now();
      this.cuadro = requestAnimationFrame(this.animar);
    } else if (!animar && this.cuadro) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
    }
  };

  private readonly animar = (ahora: number): void => {
    const dt = (ahora - this.anterior) / 1000;
    this.anterior = ahora;
    const segundos = ahora / 1000;
    const estado = this.estado();
    const reaccion = this.reaccion();
    const ritmo = reaccion === 'risa' ? RITMOS.celebra : RITMOS[estado];

    // Lo que pide la pantalla (o leer el libro) manda sobre el puntero.
    const mirada = miradaFija(estado, this.foco()) ?? this.miradaAlPuntero();
    avanzarResorte(this.miradaX, mirada.x, OJOS, dt);
    avanzarResorte(this.miradaY, mirada.y, OJOS, dt);
    avanzarResorte(this.cabeza, mirada.giro + inclinacion(estado, reaccion === 'guino'), CABEZA, dt);

    // Lo blando se queda atrás del giro de la cabeza: el arrastre es lo que se lee como vida.
    const giro = this.cabeza.velocidad;
    avanzarResorte(this.orejas, -giro * 0.05, OREJAS, dt);
    avanzarResorte(this.cola, vaivenCola(segundos, ritmo) - giro * 0.12, COLA, dt);
    avanzarResorte(this.punta, this.cola.valor * 1.4, PUNTA, dt);
    avanzarResorte(this.bufanda, 1.5 * Math.sin((2 * Math.PI * segundos) / 4.2) + giro * 0.06, BUFANDA, dt);

    let apertura = 1;
    if (ahora >= this.parpadeo.inicio) {
      const transcurrido = ahora - this.parpadeo.inicio;
      apertura = aperturaOjos(transcurrido, this.parpadeo.doble);
      if (transcurrido > duracionParpadeo(this.parpadeo.doble)) this.programarParpadeo(ahora);
    }

    const estilo = this.host.nativeElement.style;
    estilo.setProperty('--mirada-x', `${this.miradaX.valor.toFixed(2)}px`);
    estilo.setProperty('--mirada-y', `${this.miradaY.valor.toFixed(2)}px`);
    estilo.setProperty('--cabeza', `${this.cabeza.valor.toFixed(2)}deg`);
    estilo.setProperty('--cabeza-x', `${(this.miradaX.valor * 0.6).toFixed(2)}px`);
    estilo.setProperty('--oreja', `${this.orejas.valor.toFixed(2)}deg`);
    estilo.setProperty('--cola', `${this.cola.valor.toFixed(2)}deg`);
    estilo.setProperty('--cola-punta', `${(this.punta.valor - this.cola.valor).toFixed(2)}deg`);
    estilo.setProperty('--bufanda', `${this.bufanda.valor.toFixed(2)}deg`);
    estilo.setProperty('--respira', respiracion(segundos, ritmo).toFixed(4));
    estilo.setProperty('--abierto', apertura.toFixed(3));

    this.cuadro = requestAnimationFrame(this.animar);
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
