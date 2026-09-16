import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';

import { DocumentoDetalle } from '../../core/models/documento.model';
import { ChatService, MensajeChat } from '../../core/services/chat.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { StudyService } from '../../core/services/study.service';
import { Icono } from '../../shared/icono/icono';
import { TextoRico } from '../../shared/texto-rico/texto-rico';
import { ContentService, GeneratedContent, GeneratedType, IntentoQuiz } from '../../core/services/content.service';
import { Material } from './material/material';
import { VisorPdf } from './visor-pdf/visor-pdf';

/** Umbral del backend. Debajo de esto una afirmación se marca. */
const UMBRAL_ANCLAJE = 0.86;

/** Espera antes de guardar el avance, para no llamar al backend en cada página. */
const RETARDO_PROGRESO_MS = 1500;

/** Una entrada del hilo: o un mensaje, o un material generado. */
interface ItemConversacion {
  id: string;
  cuando: string;
  mensaje: MensajeChat | null;
  material: GeneratedContent | null;
}

@Component({
  selector: 'app-lector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Icono, VisorPdf, TextoRico, Material],
  templateUrl: './lector.html',
  styleUrl: './lector.scss',
})
export class Lector {
  /** Llega de la ruta /lector/:id gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  /** ?pagina=N: con qué página abrir, cuando se llega desde una cita. */
  readonly pagina = input<string>();

  private readonly documentos = inject(DocumentosService);
  private readonly chat = inject(ChatService);
  private readonly contenidoApi = inject(ContentService);
  private readonly estudio = inject(StudyService);
  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');
  private readonly visor = viewChild(VisorPdf);

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly mensajes = signal<MensajeChat[]>([]);
  readonly acciones = signal<string[]>([]);
  readonly borrador = signal('');
  readonly cargando = signal(true);
  readonly pensando = signal(false);
  readonly error = signal<string | null>(null);
  readonly contenidos = signal<GeneratedContent[]>([]);
  readonly generando = signal<GeneratedType | null>(null);

  /**
   * Orden de aparición en el hilo. No se ordena por fecha porque el mensaje
   * optimista lleva la hora del navegador y el material la del servidor: si los
   * relojes no coinciden, lo recién generado se cuela arriba y parece perdido.
   */
  private readonly orden = signal(new Map<string, number>());
  private siguienteOrden = 0;

  readonly parrafos = computed(() =>
    (this.documento()?.extractedText ?? '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
  );

  /** El PDF se abre con el visor; el EPUB todavía se muestra como texto. */
  readonly esPdf = computed(() => this.documento()?.type === 'PDF');

  readonly urlArchivo = computed(() => this.documentos.urlArchivo(this.id()));

  readonly sinTexto = computed(() => this.documento()?.textLayer === 'sin_texto');

  private temporizadorProgreso?: ReturnType<typeof setTimeout>;

  readonly puedeEnviar = computed(
    () => this.borrador().trim().length > 0 && !this.pensando() && !this.sinTexto(),
  );

  constructor() {
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

    // Al llegar un mensaje nuevo, el hilo baja solo.
    effect(() => {
      this.conversacion();
      this.pensando();
      queueMicrotask(() => {
        const elemento = this.hilo()?.nativeElement;
        if (elemento) elemento.scrollTop = elemento.scrollHeight;
      });
    });
  }

  enviar(): void {
    if (!this.puedeEnviar()) return;

    const texto = this.borrador().trim();
    const documentId = this.id();
    const localId = `local-${Date.now()}`;

    // El mensaje se pinta de inmediato, sin esperar al servidor.
    this.mensajes.update((actuales) => [
      ...actuales,
      {
        id: localId,
        role: 'user',
        content: texto,
        blockType: 'text',
        groundingScore: null,
        citations: null,
        flaggedClaims: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    this.anotarOrden([localId]);

    this.borrador.set('');
    this.pensando.set(true);
    this.error.set(null);

    this.chat.enviar(documentId, texto).subscribe({
      next: (respuesta) => {
        this.anotarOrden([respuesta.id]);

        this.mensajes.update((actuales) => [
          ...actuales,
          {
            id: respuesta.id,
            role: 'assistant',
            content: respuesta.response,
            blockType: respuesta.blockType,
            groundingScore: respuesta.groundingScore,
            citations: respuesta.citations,
            flaggedClaims: respuesta.flaggedClaims,
            createdAt: new Date().toISOString(),
          },
        ]);
        this.pensando.set(false);

        // El chat solo reconoce la petición: el material lo pide el mismo botón de siempre.
        if (respuesta.blockType !== 'text') this.generar(respuesta.blockType);
      },
      error: (respuesta: { error?: { message?: string } }) => {
        this.error.set(
          respuesta.error?.message ?? 'El asistente no pudo responder.',
        );
        this.pensando.set(false);
      },
    });
  }

  usarAccion(accion: string): void {
    this.borrador.set(accion);
    this.enviar();
  }

  etiquetaMaterial(tipo: GeneratedType): string {
    return { summary: 'el resumen', flashcards: 'las flashcards', quiz: 'el quiz' }[
      tipo
    ];
  }

  generar(tipo: GeneratedType): void {
    if (this.generando()) return;
    this.generando.set(tipo);
    this.contenidoApi.generar(this.id(), tipo).subscribe({
      next: (contenido) => {
        // Al final: la conversación va de lo más viejo a lo más nuevo.
        this.anotarOrden([contenido.id]);
        this.contenidos.update((v) => [...v, contenido]);
        this.generando.set(null);
      },
      error: () => {
        this.error.set('No se pudo generar el material.');
        this.generando.set(null);
      },
    });
  }

  /**
   * Mensajes y materiales en una sola línea de tiempo: el material es la
   * respuesta a lo que se pidió, no algo que hay que ir a buscar a otro panel.
   */
  readonly conversacion = computed<ItemConversacion[]>(() =>
    [
      ...this.mensajes().map((mensaje) => ({
        id: mensaje.id,
        cuando: mensaje.createdAt,
        mensaje,
        material: null,
      })),
      ...this.contenidos().map((material) => ({
        id: material.id,
        cuando: material.createdAt,
        mensaje: null,
        material,
      })),
    ].sort((uno, otro) => this.posicion(uno.id) - this.posicion(otro.id)),
  );

  private posicion(id: string): number {
    return this.orden().get(id) ?? Number.MAX_SAFE_INTEGER;
  }

  /** Registra los ids en el orden en que deben verse; los ya conocidos no se mueven. */
  private anotarOrden(ids: string[]): void {
    this.orden.update((actual) => {
      const copia = new Map(actual);

      for (const id of ids) {
        if (!copia.has(id)) copia.set(id, this.siguienteOrden++);
      }

      return copia;
    });
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

  alEscribir(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
  }

  alTeclear(evento: KeyboardEvent): void {
    // Enter envía; Shift+Enter permite escribir varias líneas.
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
  }

  /** Salta a la página que cita el asistente. */
  irACita(pagina: number): void {
    this.visor()?.irAPagina(pagina);
  }

  /** El avance sale de la página que se está leyendo, no de una barra manual. */
  alCambiarPagina(numero: number): void {
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

  /** Afirmaciones que el verificador marcó como poco ancladas. */
  citasMarcadas(mensaje: MensajeChat): number {
    return mensaje.flaggedClaims?.length ?? 0;
  }

  estaMarcada(mensaje: MensajeChat, cita: { claim: string }): boolean {
    return mensaje.flaggedClaims?.includes(cita.claim) ?? false;
  }

  porcentaje(score: number | null): string {
    return score === null ? '—' : `${Math.round(score * 100)}%`;
  }

  /** Verde si supera el umbral; terracota si no. */
  claseAnclaje(score: number | null): string {
    if (score === null) return 'anclaje--neutro';
    return score >= UMBRAL_ANCLAJE ? 'anclaje--bien' : 'anclaje--dudoso';
  }

  private cargar(id: string): void {
    this.cargando.set(true);

    this.documentos.obtener(id).subscribe({
      next: (documento) => {
        this.documento.set(documento);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo abrir el libro.');
        this.cargando.set(false);
      },
    });

    // Juntos: para intercalarlos hay que tenerlos los dos.
    forkJoin({
      mensajes: this.chat.historial(id),
      materiales: this.contenidoApi.listar(id),
    }).subscribe({
      next: ({ mensajes, materiales }) => {
        const previos = [
          ...mensajes.map((mensaje) => ({ id: mensaje.id, cuando: mensaje.createdAt })),
          ...materiales.map((material) => ({
            id: material.id,
            cuando: material.createdAt,
          })),
        ].sort((uno, otro) => uno.cuando.localeCompare(otro.cuando));

        // Del historial sí: ambas fechas vienen del mismo reloj, el del servidor.
        this.anotarOrden(previos.map((item) => item.id));

        this.mensajes.set(mensajes);
        this.contenidos.set(materiales);
      },
      error: () => undefined,
    });

    this.chat.acciones(id).subscribe({
      next: (acciones) => this.acciones.set(acciones),
      error: () => undefined,
    });
  }
}
