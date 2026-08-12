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
import { RouterLink } from '@angular/router';

import { DocumentoDetalle } from '../../core/models/documento.model';
import { ChatService, MensajeChat } from '../../core/services/chat.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { Icono } from '../../shared/icono/icono';

/** Umbral del backend. Debajo de esto una afirmación se marca. */
const UMBRAL_ANCLAJE = 0.86;

@Component({
  selector: 'app-lector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, Icono],
  templateUrl: './lector.html',
  styleUrl: './lector.scss',
})
export class Lector {
  /** Llega de la ruta /lector/:id gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly documentos = inject(DocumentosService);
  private readonly chat = inject(ChatService);
  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');

  readonly documento = signal<DocumentoDetalle | null>(null);
  readonly mensajes = signal<MensajeChat[]>([]);
  readonly acciones = signal<string[]>([]);
  readonly borrador = signal('');
  readonly cargando = signal(true);
  readonly pensando = signal(false);
  readonly error = signal<string | null>(null);

  readonly parrafos = computed(() =>
    (this.documento()?.extractedText ?? '')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean),
  );

  readonly puedeEnviar = computed(
    () => this.borrador().trim().length > 0 && !this.pensando(),
  );

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) this.cargar(id);
    });

    // Al llegar un mensaje nuevo, el hilo baja solo.
    effect(() => {
      this.mensajes();
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

    // El mensaje se pinta de inmediato, sin esperar al servidor.
    this.mensajes.update((actuales) => [
      ...actuales,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: texto,
        blockType: 'text',
        groundingScore: null,
        citations: null,
        flaggedClaims: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    this.borrador.set('');
    this.pensando.set(true);
    this.error.set(null);

    this.chat.enviar(documentId, texto).subscribe({
      next: (respuesta) => {
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

    this.chat.historial(id).subscribe({
      next: (mensajes) => this.mensajes.set(mensajes),
      error: () => undefined,
    });

    this.chat.acciones(id).subscribe({
      next: (acciones) => this.acciones.set(acciones),
      error: () => undefined,
    });
  }
}
