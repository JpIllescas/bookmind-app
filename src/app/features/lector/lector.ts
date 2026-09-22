import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { RouterLink } from '@angular/router';

import { Capitulo, DocumentoDetalle } from '../../core/models/documento.model';
import { DisposicionService } from '../../core/services/disposicion.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { StudyService } from '../../core/services/study.service';
import { Icono } from '../../shared/icono/icono';
import { ContentService, GeneratedContent, GeneratedType, IntentoQuiz } from '../../core/services/content.service';
import { Chat } from './chat/chat';
import { Studio } from './studio/studio';
import { VisorPdf } from './visor-pdf/visor-pdf';

/** Espera antes de guardar el avance, para no llamar al backend en cada página. */
const RETARDO_PROGRESO_MS = 1500;

/** En pantallas angostas se ve un panel a la vez. */
export type Panel = 'libro' | 'chat' | 'studio';

const CLAVE_DISPOSICION = 'bookmind.lector';

const ANCHO_LIBRO_MINIMO = 360;
const ANCHO_LIBRO_MAXIMO = 900;
const ANCHO_LIBRO_INICIAL = 520;

interface DisposicionGuardada {
  libro: boolean;
  studio: boolean;
  anchoLibro: number;
}

@Component({
  selector: 'app-lector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, VisorPdf, Studio, Chat],
  templateUrl: './lector.html',
  styleUrl: './lector.scss',
  host: {
    '[style.--ancho-libro]': 'anchoLibro() + "px"',
    '[class.lector--arrastrando]': 'arrastrando()',
  },
})
export class Lector {
  /** Llega de la ruta /lector/:id gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  /** ?pagina=N: con qué página abrir, cuando se llega desde una cita. */
  readonly pagina = input<string>();

  private readonly documentos = inject(DocumentosService);
  private readonly contenidoApi = inject(ContentService);
  private readonly estudio = inject(StudyService);
  private readonly disposicion = inject(DisposicionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly visor = viewChild(VisorPdf);

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly contenidos = signal<GeneratedContent[]>([]);
  readonly generando = signal<GeneratedType | null>(null);

  readonly capitulos = signal<Capitulo[]>([]);
  readonly capitulosAbiertos = signal(false);
  readonly paginaActual = signal(1);

  // --- Disposición de los tres paneles ---
  readonly libroVisible = signal(true);
  readonly studioVisible = signal(true);
  readonly anchoLibro = signal(ANCHO_LIBRO_INICIAL);
  readonly arrastrando = signal(false);
  /** Panel activo en móvil. */
  readonly panelMovil = signal<Panel>('chat');
  /** El Studio pulsa cuando llega algo nuevo estando cerrado. */
  readonly studioConNovedad = signal(false);

  readonly parrafos = computed(() =>
    (this.documento()?.extractedText ?? '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
  );

  /** El PDF se abre con el visor; el EPUB todavía se muestra como texto. */
  readonly esPdf = computed(() => this.documento()?.type === 'PDF');

  readonly urlArchivo = computed(() => this.documentos.urlArchivo(this.id()));

  /** Capítulo por el que va la lectura, según la página visible. */
  readonly capituloActual = computed(() => {
    const pagina = this.paginaActual();
    return (
      this.capitulos().find((c) => pagina >= c.paginaInicio && pagina <= c.paginaFin) ?? null
    );
  });

  readonly porcentajeLeido = computed(() => {
    const documento = this.documento();
    if (!documento || documento.pages === 0) return 0;
    return Math.min(Math.round((this.paginaActual() / documento.pages) * 100), 100);
  });

  /** Por qué el asistente no está disponible para este libro; null si sí lo está. */
  readonly avisoAsistente = computed<string | null>(() => {
    const documento = this.documento();
    if (!documento) return null;

    const estado = documento.processingStatus;

    if (estado === 'pending' || estado === 'processing') {
      return (
        'Estamos preparando el libro para el asistente: texto, materia e índice ' +
        'de citas. En cuanto termine podrás preguntar.'
      );
    }

    if (estado === 'failed') {
      return documento.processingError ?? 'No se pudo procesar este libro. Vuelve a subirlo.';
    }

    if (documento.textLayer === 'sin_texto') {
      return (
        'Este libro está escaneado como imágenes: puedes leerlo, pero el asistente ' +
        'necesita un archivo con texto seleccionable.'
      );
    }

    return null;
  });

  readonly asistenteBloqueado = computed(() => this.avisoAsistente() !== null);

  private temporizadorProgreso?: ReturnType<typeof setTimeout>;

  constructor() {
    this.restaurarDisposicion();

    // El lector necesita todo el ancho: la barra lateral se pliega mientras dure.
    this.disposicion.forzarLateralPlegada(true);
    this.destroyRef.onDestroy(() => this.disposicion.forzarLateralPlegada(false));

    effect(() => {
      const id = this.id();
      if (id) this.cargar(id);
    });

    // El visor aparece cuando el documento ya cargó; solo entonces se puede saltar.
    effect(() => {
      const destino = Number(this.pagina());
      const visor = this.visor();

      if (visor && Number.isFinite(destino) && destino > 0) {
        queueMicrotask(() => visor.irAPagina(destino));
      }
    });

    effect(() => {
      const disposicion: DisposicionGuardada = {
        libro: this.libroVisible(),
        studio: this.studioVisible(),
        anchoLibro: this.anchoLibro(),
      };
      try {
        localStorage.setItem(CLAVE_DISPOSICION, JSON.stringify(disposicion));
      } catch {
        // Sin almacenamiento, la disposición dura lo que dure la sesión.
      }
    });
  }

  // --- Paneles ---

  alternarLibro(): void {
    this.libroVisible.update((visible) => !visible);
  }

  alternarStudio(): void {
    this.studioVisible.update((visible) => !visible);
    this.studioConNovedad.set(false);
  }

  mostrarPanel(panel: Panel): void {
    this.panelMovil.set(panel);
    if (panel === 'studio') {
      this.studioVisible.set(true);
      this.studioConNovedad.set(false);
    }
    if (panel === 'libro') this.libroVisible.set(true);
  }

  /** Arrastre del separador entre el libro y el chat. */
  iniciarArrastre(evento: PointerEvent): void {
    evento.preventDefault();
    const origenX = evento.clientX;
    const anchoInicial = this.anchoLibro();
    this.arrastrando.set(true);

    const mover = (e: PointerEvent) => {
      const nuevo = anchoInicial + (e.clientX - origenX);
      this.anchoLibro.set(Math.min(ANCHO_LIBRO_MAXIMO, Math.max(ANCHO_LIBRO_MINIMO, nuevo)));
    };

    const soltar = () => {
      this.arrastrando.set(false);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };

    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
  }

  // --- Materiales ---

  generar(tipo: GeneratedType): void {
    if (this.generando()) return;

    this.generando.set(tipo);
    this.error.set(null);
    if (!this.studioVisible()) this.studioConNovedad.set(true);

    this.contenidoApi.generar(this.id(), tipo).subscribe({
      next: (contenido) => {
        // Al frente: el Studio muestra el más reciente de cada tipo.
        this.contenidos.update((v) => [contenido, ...v]);
        this.generando.set(null);
      },
      error: (respuesta: { error?: { message?: string } }) => {
        this.error.set(respuesta.error?.message ?? 'No se pudo generar el material.');
        this.generando.set(null);
      },
    });
  }

  abrirStudio(): void {
    this.studioVisible.set(true);
    this.studioConNovedad.set(false);
    this.panelMovil.set('studio');
  }

  registrarIntento(material: GeneratedContent, intento: IntentoQuiz): void {
    this.contenidoApi.registrarIntento(this.id(), material.id, intento).subscribe({
      next: () => undefined,
      // El quiz ya está contestado en pantalla: no se le arruina al alumno.
      error: () => this.error.set('No se pudo guardar el resultado del quiz.'),
    });
  }

  borrarMaterial(material: GeneratedContent): void {
    this.contenidoApi.eliminar(this.id(), material.id).subscribe({
      next: () =>
        this.contenidos.update((actuales) =>
          actuales.filter((actual) => actual.id !== material.id),
        ),
      error: () => this.error.set('No se pudo borrar el material.'),
    });
  }

  // --- Libro ---

  alternarCapitulos(): void {
    this.capitulosAbiertos.update((abiertos) => !abiertos);
  }

  irACapitulo(capitulo: Capitulo): void {
    this.capitulosAbiertos.set(false);
    this.irAPagina(capitulo.paginaInicio);
  }

  /** Salta a la página que cita el asistente o un material del Studio. */
  irAPagina(pagina: number): void {
    // Si el libro estaba oculto, una cita lo abre: es lo que el estudiante quiere ver.
    this.libroVisible.set(true);
    this.panelMovil.set('libro');
    queueMicrotask(() => this.visor()?.irAPagina(pagina));
  }

  /** El avance sale de la página que se está leyendo, no de una barra manual. */
  alCambiarPagina(numero: number): void {
    this.paginaActual.set(numero);

    const documento = this.documento();
    if (!documento || documento.pages === 0) return;

    const porcentaje = Math.min(Math.round((numero / documento.pages) * 100), 100);
    if (porcentaje <= documento.progress) return;

    this.documento.set({ ...documento, progress: porcentaje });

    clearTimeout(this.temporizadorProgreso);
    this.temporizadorProgreso = setTimeout(() => {
      this.estudio.actualizarProgreso(this.id(), porcentaje).subscribe({
        error: () => undefined,
      });
    }, RETARDO_PROGRESO_MS);
  }

  private restaurarDisposicion(): void {
    try {
      const guardada = JSON.parse(
        localStorage.getItem(CLAVE_DISPOSICION) ?? 'null',
      ) as DisposicionGuardada | null;

      if (!guardada) return;
      this.libroVisible.set(guardada.libro ?? true);
      this.studioVisible.set(guardada.studio ?? true);
      if (Number.isFinite(guardada.anchoLibro)) {
        this.anchoLibro.set(
          Math.min(ANCHO_LIBRO_MAXIMO, Math.max(ANCHO_LIBRO_MINIMO, guardada.anchoLibro)),
        );
      }
    } catch {
      // Un valor corrupto no debe romper el lector: se usa la disposición por defecto.
    }
  }

  private cargar(id: string): void {
    this.cargando.set(true);

    this.documentos.obtener(id).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.cargando.set(false);

        const estado = documento.processingStatus;
        if (estado === 'pending' || estado === 'processing') this.esperarLibro(id);
        else this.cargarCapitulos(id);
      },
      error: () => {
        this.error.set('No se pudo abrir el libro.');
        this.cargando.set(false);
      },
    });

    this.contenidoApi.listar(id).subscribe({
      next: (materiales) => this.contenidos.set(materiales),
      error: () => undefined,
    });
  }

  private cargarCapitulos(id: string): void {
    this.documentos.capitulos(id).subscribe({
      next: (capitulos) => this.capitulos.set(capitulos),
      // Sin capítulos el libro se lee igual: el desplegable simplemente no aparece.
      error: () => this.capitulos.set([]),
    });
  }

  /** Se puede leer mientras se indexa; el asistente se habilita solo cuando termina. */
  private esperarLibro(id: string): void {
    this.documentos
      .esperarProcesamiento(id)
      .pipe(
        // El detalle trae el texto del EPUB, que el resumen no incluye.
        switchMap(() => this.documentos.obtener(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (documento) => {
          this.documento.set(documento);
          if (documento.processingStatus === 'ready') this.cargarCapitulos(id);
        },
        error: () => undefined,
      });
  }
}
