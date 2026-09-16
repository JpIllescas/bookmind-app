import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';

import { AuthService } from '../../../core/services/auth.service';
import { Icono } from '../../../shared/icono/icono';

// El worker se copia a la raíz del build desde angular.json.
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/** Cómo se calcula el zoom cuando no lo fija el usuario. */
export type ModoAjuste = 'ancho' | 'pagina' | 'libre';

/** Continuo desplaza el libro entero; página muestra una sola hoja. */
export type ModoVista = 'continuo' | 'pagina';

interface Hoja {
  numero: number;
  ancho: number;
  alto: number;
}

const ESCALA_MINIMA = 0.25;
const ESCALA_MAXIMA = 4;
const PASO_ZOOM = 0.2;

/** Margen alrededor de la hoja dentro del área de lectura. */
const RESPIRO = 32;

@Component({
  selector: 'app-visor-pdf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  templateUrl: './visor-pdf.html',
  styleUrl: './visor-pdf.scss',
})
export class VisorPdf implements OnDestroy {
  readonly url = input.required<string>();

  readonly paginaCambio = output<number>();

  private readonly auth = inject(AuthService);
  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly hojas = viewChildren<ElementRef<HTMLElement>>('hoja');

  readonly paginas = signal<Hoja[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly escala = signal(1);
  readonly modoAjuste = signal<ModoAjuste>('ancho');
  readonly vista = signal<ModoVista>('continuo');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly porcentajeZoom = computed(() => Math.round(this.escala() * 100));

  private documento: PDFDocumentProxy | null = null;
  // En pdf.js v6 el `destroy()` está en la tarea de carga, no en el documento.
  private carga: PDFDocumentLoadingTask | null = null;
  private readonly pintadas = new Map<number, { escala: number; tarea: RenderTask }>();
  private readonly pintando = new Set<number>();
  private observador?: IntersectionObserver;
  private medidor?: ResizeObserver;
  private readonly visibles = new Set<number>();

  /** Los canvas se dibujan al doble en pantallas retina para que no se vean borrosos. */
  private readonly densidad = Math.min(globalThis.devicePixelRatio || 1, 2);

  constructor() {
    effect((alDestruir) => {
      const url = this.url();
      alDestruir(() => this.cerrarDocumento());
      void this.abrir(url);
    });

    // Las hojas aparecen cuando el PDF ya se abrió; hasta entonces no hay qué observar.
    effect(() => {
      const hojas = this.hojas();
      if (hojas.length === 0) return;

      this.observarHojas(hojas.map((hoja) => hoja.nativeElement));
      this.repintarVisibles();
    });

    effect(() => {
      // Cambiar el zoom obliga a redibujar lo que se está viendo.
      this.escala();
      this.repintarVisibles();
    });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    this.medidor?.disconnect();
    this.cerrarDocumento();
  }

  /** Lleva el visor a una página; es lo que usan las citas del chat. */
  irAPagina(numero: number): void {
    const destino = Math.min(Math.max(numero, 1), this.total());
    if (destino === 0) return;

    this.paginaActual.set(destino);
    this.paginaCambio.emit(destino);

    if (this.vista() === 'pagina') {
      this.repintarVisibles();
      return;
    }

    this.hojas()[destino - 1]?.nativeElement.scrollIntoView({ block: 'start' });
  }

  anterior(): void {
    this.irAPagina(this.paginaActual() - 1);
  }

  siguiente(): void {
    this.irAPagina(this.paginaActual() + 1);
  }

  alEscribirPagina(evento: Event): void {
    const numero = Number((evento.target as HTMLInputElement).value);
    if (Number.isFinite(numero)) this.irAPagina(numero);
  }

  acercar(): void {
    this.fijarEscala(this.escala() + PASO_ZOOM);
  }

  alejar(): void {
    this.fijarEscala(this.escala() - PASO_ZOOM);
  }

  ajustar(modo: Exclude<ModoAjuste, 'libre'>): void {
    this.modoAjuste.set(modo);
    this.recalcularAjuste();
  }

  alternarVista(): void {
    this.vista.set(this.vista() === 'continuo' ? 'pagina' : 'continuo');
    this.repintarVisibles();

    if (this.vista() === 'continuo') {
      queueMicrotask(() => this.irAPagina(this.paginaActual()));
    }
  }

  /** En modo página solo se muestra la hoja actual; el resto queda oculto. */
  estaVisible(numero: number): boolean {
    return this.vista() === 'continuo' || numero === this.paginaActual();
  }

  alDesplazar(): void {
    if (this.vista() === 'pagina') return;

    const contenedor = this.area()?.nativeElement;
    if (!contenedor) return;

    const limite = contenedor.getBoundingClientRect().top + RESPIRO;
    const hojas = this.hojas();

    // Solo se miden las hojas cercanas: en un libro de 400 páginas medirlas todas cuesta.
    const actual = [...this.visibles].sort((a, b) => a - b).reduce((elegida, numero) => {
      const hoja = hojas[numero - 1]?.nativeElement;
      return hoja && hoja.getBoundingClientRect().top <= limite ? numero : elegida;
    }, this.paginaActual());

    if (actual !== this.paginaActual()) {
      this.paginaActual.set(actual);
      this.paginaCambio.emit(actual);
    }
  }

  private async abrir(url: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    try {
      const tarea = getDocument({
        url,
        // El JWT viaja igual que en el resto de peticiones del cliente.
        httpHeaders: { Authorization: `Bearer ${this.auth.token ?? ''}` },
        // Sin estos dos, pdf.js se trae el libro entero de una aunque solo se vea una página.
        disableAutoFetch: true,
        disableStream: true,
      });

      const documento = await tarea.promise;
      this.carga = tarea;
      this.documento = documento;
      this.total.set(documento.numPages);

      const primera = await documento.getPage(1);
      const medidas = primera.getViewport({ scale: 1 });
      primera.cleanup();

      // Se asume el tamaño de la primera hoja; al pintar cada página se corrige sola.
      this.paginas.set(
        Array.from({ length: documento.numPages }, (_, indice) => ({
          numero: indice + 1,
          ancho: medidas.width,
          alto: medidas.height,
        })),
      );

      this.cargando.set(false);
      this.vigilarTamano();
      this.recalcularAjuste();
    } catch (error) {
      this.error.set(
        'No se pudo abrir el archivo del documento. ' +
          (error instanceof Error ? error.message : ''),
      );
      this.cargando.set(false);
    }
  }

  private observarHojas(elementos: HTMLElement[]): void {
    this.observador?.disconnect();

    this.observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const numero = Number(entrada.target.getAttribute('data-pagina'));
          if (entrada.isIntersecting) this.visibles.add(numero);
          else this.visibles.delete(numero);
        }

        this.repintarVisibles();
        // Tras un salto largo el scroll ya terminó: el número de página se corrige aquí.
        this.alDesplazar();
      },
      // Un margen de una pantalla arriba y abajo evita ver la hoja en blanco al bajar.
      { root: this.area()?.nativeElement ?? null, rootMargin: '100% 0px' },
    );

    for (const elemento of elementos) this.observador.observe(elemento);
  }

  private vigilarTamano(): void {
    const contenedor = this.area()?.nativeElement;
    if (!contenedor || this.medidor) return;

    this.medidor = new ResizeObserver(() => this.recalcularAjuste());
    this.medidor.observe(contenedor);
  }

  /** Traduce "ajustar al ancho" o "a la página" a una escala concreta. */
  private recalcularAjuste(): void {
    const modo = this.modoAjuste();
    const contenedor = this.area()?.nativeElement;
    const hoja = this.paginas()[0];

    if (modo === 'libre' || !contenedor || !hoja) return;

    const anchoDisponible = contenedor.clientWidth - RESPIRO * 2;
    const altoDisponible = contenedor.clientHeight - RESPIRO * 2;

    const escala =
      modo === 'ancho'
        ? anchoDisponible / hoja.ancho
        : Math.min(anchoDisponible / hoja.ancho, altoDisponible / hoja.alto);

    this.escala.set(this.acotar(escala));
  }

  private fijarEscala(valor: number): void {
    // Tocar el zoom a mano desactiva el ajuste automático.
    this.modoAjuste.set('libre');
    this.escala.set(this.acotar(valor));
  }

  private acotar(escala: number): number {
    return Math.min(Math.max(escala, ESCALA_MINIMA), ESCALA_MAXIMA);
  }

  private repintarVisibles(): void {
    const pendientes =
      this.vista() === 'pagina' ? [this.paginaActual()] : [...this.visibles];

    for (const numero of pendientes) void this.pintar(numero);
  }

  private async pintar(numero: number): Promise<void> {
    const documento = this.documento;
    const escala = this.escala();
    const elemento = this.hojas()[numero - 1]?.nativeElement;
    const lienzo = elemento?.querySelector('canvas');

    if (!documento || !lienzo) return;

    // Ya está dibujada a esta escala, o se está dibujando ahora mismo.
    if (this.pintadas.get(numero)?.escala === escala) return;
    if (this.pintando.has(numero)) return;

    this.pintando.add(numero);

    try {
      const anterior = this.pintadas.get(numero);

      if (anterior) {
        anterior.tarea.cancel();
        // pdf.js no admite dos render() sobre el mismo canvas: hay que esperar el corte.
        await anterior.tarea.promise.catch(() => undefined);
        this.pintadas.delete(numero);
      }

      const pagina = await documento.getPage(numero);
      const viewport = pagina.getViewport({ scale: escala * this.densidad });
      const contexto = lienzo.getContext('2d');

      if (!contexto) return;

      const factor = escala * this.densidad;
      this.corregirMedidas(numero, viewport.width / factor, viewport.height / factor);

      lienzo.width = viewport.width;
      lienzo.height = viewport.height;
      lienzo.style.width = `${viewport.width / this.densidad}px`;
      lienzo.style.height = `${viewport.height / this.densidad}px`;

      const tarea = pagina.render({ canvas: lienzo, canvasContext: contexto, viewport });
      this.pintadas.set(numero, { escala, tarea });

      await tarea.promise;
      pagina.cleanup();
    } catch {
      // Cancelar una página al hacer zoom o al pasar de largo no es un error.
      this.pintadas.delete(numero);
    } finally {
      this.pintando.delete(numero);

      // El zoom pudo cambiar mientras se dibujaba: entonces hay que repetirlo.
      const dibujada = this.pintadas.get(numero);
      if (dibujada && dibujada.escala !== this.escala()) void this.pintar(numero);
    }
  }

  /** Ajusta el hueco de una hoja que no mide lo mismo que la primera del libro. */
  private corregirMedidas(numero: number, ancho: number, alto: number): void {
    const hoja = this.paginas()[numero - 1];

    if (!hoja || (Math.abs(hoja.ancho - ancho) < 1 && Math.abs(hoja.alto - alto) < 1)) {
      return;
    }

    this.paginas.update((hojas) =>
      hojas.map((actual) =>
        actual.numero === numero ? { ...actual, ancho, alto } : actual,
      ),
    );
  }

  private cerrarDocumento(): void {
    for (const { tarea } of this.pintadas.values()) tarea.cancel();

    this.pintadas.clear();
    this.visibles.clear();
    void this.carga?.destroy();
    this.carga = null;
    this.documento = null;
  }
}
