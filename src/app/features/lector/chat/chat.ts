import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import {
  ChatService,
  Conversacion,
  EventoChat,
  MensajeChat,
  TipoBloque,
} from '../../../core/services/chat.service';
import { GeneratedContent, GeneratedType } from '../../../core/services/content.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { Icono, NombreIcono } from '../../../shared/icono/icono';
import { Lumo } from '../../../shared/lumo/lumo';
import { TextoRico } from '../../../shared/texto-rico/texto-rico';
import { DiagramaComponent } from '../../../shared/diagrama/diagrama';
import { IdiomaService } from '../../../core/services/idioma.service';
import { TraducirPipe } from '../../../shared/i18n/traducir.pipe';

/** Umbral del backend. Debajo de esto una afirmación se marca. */
const UMBRAL_ANCLAJE = 0.86;

/** Id del mensaje del asistente mientras se está escribiendo. */
const ID_EN_CURSO = 'en-curso';

const MAXIMO_CHIPS_PAGINA = 8;

const NOMBRE_MATERIAL: Record<Exclude<TipoBloque, 'text'>, string> = {
  summary: 'material.summary',
  flashcards: 'material.flashcards',
  quiz: 'material.quiz',
  glossary: 'material.glossary',
  timeline: 'material.timeline',
  mind_map: 'material.mindMap',
  concept_map: 'material.conceptMap',
};

const ICONO_MATERIAL: Record<Exclude<TipoBloque, 'text'>, NombreIcono> = {
  summary: 'documento',
  flashcards: 'tarjetas',
  quiz: 'check',
  glossary: 'libro',
  timeline: 'reloj',
  mind_map: 'mapa-mental',
  concept_map: 'lista',
};

@Component({
  selector: 'app-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Icono, TextoRico, Lumo, DiagramaComponent, TraducirPipe],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  readonly documentId = input.required<string>();
  /** El libro aún se prepara o es un escaneo: no se puede preguntar. */
  readonly bloqueado = input(false);
  readonly aviso = input<string | null>(null);
  readonly puedeSaltar = input(true);
  readonly generando = input<GeneratedType | null>(null);
  readonly materiales = input<GeneratedContent[]>([]);

  readonly pagina = output<number>();
  readonly generar = output<GeneratedType>();
  readonly abrirStudio = output<void>();

  private readonly chat = inject(ChatService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly idioma = inject(IdiomaService);
  private readonly hilo = viewChild<ElementRef<HTMLElement>>('hilo');
  private readonly entrada = viewChild<ElementRef<HTMLTextAreaElement>>('entrada');

  readonly conversaciones = signal<Conversacion[]>([]);
  /** null = conversación nueva que aún no existe en el servidor. */
  readonly activa = signal<string | null>(null);
  readonly mensajes = signal<MensajeChat[]>([]);
  readonly cargandoMensajes = signal(false);

  readonly borrador = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly sugerencias = signal<string[]>([]);
  readonly acciones = signal<string[]>([]);
  readonly modoTutor = signal(false);
  readonly escuchando = signal<string | null>(null);
  private audioReproduccion: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;

  readonly listaAbierta = signal(false);
  readonly renombrando = signal<string | null>(null);
  readonly tituloEditado = signal('');
  readonly porBorrar = signal<string | null>(null);
  /** Mensajes con la lista de citas desplegada. */
  readonly citasAbiertas = signal<Set<string>>(new Set());
  readonly compartiendo = signal(false);

  private controlador: AbortController | null = null;
  /** Último mensaje enviado, para poder reintentarlo si falló. */
  private ultimoEnviado = '';

  readonly conversacionActiva = computed(
    () => this.conversaciones().find((c) => c.id === this.activa()) ?? null,
  );

  readonly titulo = computed(() => this.conversacionActiva()?.titulo ?? this.idioma.traducir('chat.newConversation'));

  readonly vacia = computed(
    () => this.mensajes().length === 0 && !this.enviando() && !this.cargandoMensajes(),
  );

  readonly puedeEnviar = computed(
    () => this.borrador().trim().length > 0 && !this.enviando() && !this.bloqueado(),
  );

  constructor() {
    effect(() => {
      const id = this.documentId();
      if (id) this.cargarTodo(id);
    });

    // Al llegar texto nuevo, el hilo baja solo.
    effect(() => {
      this.mensajes();
      this.enviando();
      queueMicrotask(() => {
        const elemento = this.hilo()?.nativeElement;
        if (elemento) elemento.scrollTop = elemento.scrollHeight;
      });
    });

    this.destroyRef.onDestroy(() => {
      this.controlador?.abort();
      this.detenerAudio();
    });
  }

  // --- Conversaciones ---

  nuevaConversacion(): void {
    this.detener();
    this.activa.set(null);
    this.mensajes.set([]);
    this.error.set(null);
    this.listaAbierta.set(false);
    this.modoTutor.set(false);
    this.detenerAudio();
    queueMicrotask(() => this.entrada()?.nativeElement.focus());
  }

  compartirConversacion(): void {
    const id = this.activa();
    if (!id || this.compartiendo()) return;
    this.compartiendo.set(true);
    this.chat.compartir(this.documentId(), id).subscribe({
      next: ({ token }) => {
        const url = `${window.location.origin}/compartir/${token}`;
        void navigator.clipboard?.writeText(url);
        this.compartiendo.set(false);
        this.notificaciones.exito(this.idioma.traducir('chat.linkCopied'));
      },
      error: () => {
        this.compartiendo.set(false);
        this.notificaciones.error(this.idioma.traducir('chat.shareError'));
      },
    });
  }

  abrirConversacion(conversacion: Conversacion): void {
    if (conversacion.id === this.activa()) {
      this.listaAbierta.set(false);
      return;
    }

    this.detener();
    this.activa.set(conversacion.id);
    this.listaAbierta.set(false);
    this.error.set(null);
    this.cargarMensajes(conversacion.id);
  }

  alternarLista(): void {
    this.listaAbierta.update((abierta) => !abierta);
    this.porBorrar.set(null);
  }

  empezarRenombrar(conversacion: Conversacion, evento?: Event): void {
    evento?.stopPropagation();
    this.renombrando.set(conversacion.id);
    this.tituloEditado.set(conversacion.titulo);
  }

  alEditarTitulo(evento: Event): void {
    this.tituloEditado.set((evento.target as HTMLInputElement).value);
  }

  confirmarRenombrar(): void {
    const id = this.renombrando();
    const titulo = this.tituloEditado().trim();
    this.renombrando.set(null);

    if (!id || !titulo) return;

    this.chat.renombrar(this.documentId(), id, titulo).subscribe({
      next: (actualizada) =>
        this.conversaciones.update((lista) =>
          lista.map((c) => (c.id === id ? { ...c, titulo: actualizada.titulo } : c)),
        ),
      error: () => this.notificaciones.error(this.idioma.traducir('chat.renameError')),
    });
  }

  alTeclearTitulo(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') this.confirmarRenombrar();
    if (evento.key === 'Escape') this.renombrando.set(null);
  }

  pedirBorrar(conversacion: Conversacion, evento: Event): void {
    evento.stopPropagation();
    this.porBorrar.set(conversacion.id);
  }

  cancelarBorrar(evento: Event): void {
    evento.stopPropagation();
    this.porBorrar.set(null);
  }

  confirmarBorrar(conversacion: Conversacion, evento: Event): void {
    evento.stopPropagation();

    this.chat.eliminarConversacion(this.documentId(), conversacion.id).subscribe({
      next: () => {
        this.conversaciones.update((lista) => lista.filter((c) => c.id !== conversacion.id));
        this.porBorrar.set(null);
        if (this.activa() === conversacion.id) this.nuevaConversacion();
      },
      error: () => this.notificaciones.error(this.idioma.traducir('chat.deleteError')),
    });
  }

  // --- Envío ---

  enviar(): void {
    if (!this.puedeEnviar()) return;
    this.mandar(this.borrador().trim());
    this.borrador.set('');
    this.ajustarAltura();
  }

  usarSugerencia(texto: string): void {
    if (this.enviando() || this.bloqueado()) return;
    this.mandar(texto);
  }

  iniciarTutor(): void {
    this.nuevaConversacion();
    this.modoTutor.set(true);
    this.mandar('Quiero estudiar en modo tutor. Empieza con una pregunta sobre las ideas principales del libro.');
  }

  reintentar(): void {
    if (this.ultimoEnviado && !this.enviando()) {
      // El mensaje fallido ya está en el hilo: no se duplica.
      this.mandar(this.ultimoEnviado, true);
    }
  }

  detener(): void {
    this.controlador?.abort();
    this.controlador = null;
    this.enviando.set(false);
    this.cerrarEnCurso();
  }

  private mandar(texto: string, sinRepetirUsuario = false): void {
    this.ultimoEnviado = texto;
    this.error.set(null);

    if (!sinRepetirUsuario) {
      this.mensajes.update((actuales) => [
        ...actuales,
        this.mensajeLocal(`local-${Date.now()}`, 'user', texto),
      ]);
    }

    this.mensajes.update((actuales) => [
      ...actuales,
      this.mensajeLocal(ID_EN_CURSO, 'assistant', ''),
    ]);

    this.enviando.set(true);
    this.controlador = new AbortController();

    this.chat
      .enviarEnStream(
        this.documentId(),
        this.activa(),
        texto,
        this.controlador.signal,
        this.idioma.idioma(),
        this.modoTutor() ? 'tutor' : null,
      )
      .subscribe({
        next: (evento) => this.procesar(evento),
        complete: () => {
          this.enviando.set(false);
          this.controlador = null;
          this.cerrarEnCurso();
          this.recargarConversaciones();
        },
      });
  }

  private procesar(evento: EventoChat): void {
    switch (evento.tipo) {
      case 'inicio':
        if (!this.activa()) this.activa.set(evento.conversationId);
        break;

      case 'token':
        this.actualizarEnCurso((m) => ({ ...m, content: m.content + evento.texto }));
        break;

      case 'diagrama':
        this.actualizarEnCurso((m) => ({ ...m, diagram: evento.diagrama }));
        break;

      case 'material':
        this.actualizarEnCurso((m) => ({ ...m, blockType: evento.blockType }));
        // El chat solo reconoce la petición: el material se arma en el Studio.
        this.generar.emit(evento.blockType);
        break;

      case 'anclaje':
        this.actualizarEnCurso((m) => ({
          ...m,
          groundingScore: evento.groundingScore,
          citations: evento.citations,
          flaggedClaims: evento.flaggedClaims,
        }));
        break;

      case 'fin':
        this.actualizarEnCurso((m) => {
          const extraido = this.extraerDiagrama(m.content);
          return {
            ...m,
            id: evento.id,
            content: extraido?.content ?? m.content,
            diagram: extraido?.diagram ?? m.diagram,
          };
        });
        break;

      case 'error':
        this.error.set(evento.mensaje);
        break;
    }
  }

  /** El mensaje en curso deja de serlo: si quedó vacío (error o corte), se quita. */
  private cerrarEnCurso(): void {
    this.mensajes.update((actuales) =>
      actuales
        .filter((m) => m.id !== ID_EN_CURSO || m.content.trim() !== '' || m.diagram !== null)
        .map((m) => (m.id === ID_EN_CURSO ? { ...m, id: `local-${Date.now()}` } : m)),
    );
  }

  private actualizarEnCurso(cambio: (mensaje: MensajeChat) => MensajeChat): void {
    this.mensajes.update((actuales) =>
      actuales.map((m) => (m.id === ID_EN_CURSO ? cambio(m) : m)),
    );
  }

  /** Acepta tanto el evento tipado como una respuesta JSON completa del modelo. */
  private extraerDiagrama(texto: string): { content: string; diagram: NonNullable<MensajeChat['diagram']> } | null {
    const limpio = texto
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    if (!limpio.startsWith('{') || !limpio.endsWith('}')) return null;

    try {
      const objeto = JSON.parse(limpio) as {
        content?: unknown;
        diagram?: unknown;
        type?: unknown;
        title?: unknown;
        nodes?: unknown;
        edges?: unknown;
      };
      const candidato = objeto.diagram ?? objeto;

      if (!this.esDiagrama(candidato)) return null;

      return {
        content: typeof objeto.content === 'string' ? objeto.content : '',
        diagram: candidato,
      };
    } catch {
      return null;
    }
  }

  private esDiagrama(valor: unknown): valor is NonNullable<MensajeChat['diagram']> {
    if (!valor || typeof valor !== 'object') return false;
    const diagrama = valor as Record<string, unknown>;
    return (
      (diagrama['type'] === 'mind_map' ||
        diagrama['type'] === 'concept_map' ||
        diagrama['type'] === 'flowchart') &&
      typeof diagrama['title'] === 'string' &&
      Array.isArray(diagrama['nodes']) &&
      Array.isArray(diagrama['edges'])
    );
  }

  private mensajeLocal(id: string, role: MensajeChat['role'], content: string): MensajeChat {
    return {
      id,
      role,
      content,
      diagram: null,
      blockType: 'text',
      groundingScore: null,
      citations: null,
      flaggedClaims: null,
      createdAt: new Date().toISOString(),
    };
  }

  // --- Entrada ---

  alEscribir(evento: Event): void {
    this.borrador.set((evento.target as HTMLTextAreaElement).value);
    this.ajustarAltura();
  }

  alTeclear(evento: KeyboardEvent): void {
    // Enter envía; Shift+Enter permite escribir varias líneas.
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      this.enviar();
    }
  }

  private ajustarAltura(): void {
    const area = this.entrada()?.nativeElement;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 200)}px`;
  }

  // --- Mensajes ---

  esEnCurso(mensaje: MensajeChat): boolean {
    return mensaje.id === ID_EN_CURSO;
  }

  esMaterial(mensaje: MensajeChat): boolean {
    return mensaje.role === 'assistant' && mensaje.blockType !== 'text';
  }

  nombreMaterial(mensaje: MensajeChat): string {
    const clave = NOMBRE_MATERIAL[mensaje.blockType as Exclude<TipoBloque, 'text'>];
    return clave ? this.idioma.traducir(clave) : this.idioma.traducir('material.fallback');
  }

  iconoMaterial(mensaje: MensajeChat): NombreIcono {
    return ICONO_MATERIAL[mensaje.blockType as Exclude<TipoBloque, 'text'>] ?? 'documento';
  }

  /** Estado del material que pidió el chat: generándose, listo o pendiente. */
  estadoMaterial(mensaje: MensajeChat): 'generando' | 'listo' | 'pendiente' {
    const tipo = mensaje.blockType as GeneratedType;
    if (this.generando() === tipo) return 'generando';

    const hay = this.materiales().some(
      (m) => m.type === tipo && new Date(m.createdAt) >= new Date(mensaje.createdAt),
    );
    return hay ? 'listo' : 'pendiente';
  }

  copiar(mensaje: MensajeChat): void {
    navigator.clipboard
      ?.writeText(mensaje.content)
      .then(() => this.notificaciones.exito(this.idioma.traducir('chat.copied')))
      .catch(() => this.notificaciones.error(this.idioma.traducir('chat.copyError')));
  }

  alternarCitas(mensaje: MensajeChat): void {
    this.citasAbiertas.update((actuales) => {
      const copia = new Set(actuales);
      copia.has(mensaje.id) ? copia.delete(mensaje.id) : copia.add(mensaje.id);
      return copia;
    });
  }

  citasVisibles(mensaje: MensajeChat): boolean {
    return this.citasAbiertas().has(mensaje.id);
  }

  /** Páginas citadas sin repetir, en orden: los chips de "ver en el libro". */
  paginasCitadas(mensaje: MensajeChat): number[] {
    return [...new Set((mensaje.citations ?? []).map((c) => c.page))].sort((a, b) => a - b);
  }

  /** Las primeras; el resto se ve al desplegar las citas, para no llenar el pie de chips. */
  paginasVisibles(mensaje: MensajeChat): number[] {
    return this.paginasCitadas(mensaje).slice(0, MAXIMO_CHIPS_PAGINA);
  }

  paginasOcultas(mensaje: MensajeChat): number {
    return Math.max(0, this.paginasCitadas(mensaje).length - MAXIMO_CHIPS_PAGINA);
  }

  citasMarcadas(mensaje: MensajeChat): number {
    return mensaje.flaggedClaims?.length ?? 0;
  }

  estaMarcada(mensaje: MensajeChat, cita: { claim: string }): boolean {
    return mensaje.flaggedClaims?.includes(cita.claim) ?? false;
  }

  porcentaje(score: number | null): string {
    return score === null ? '—' : `${Math.round(score * 100)}%`;
  }

  claseAnclaje(score: number | null): string {
    if (score === null) return 'anclaje--neutro';
    return score >= UMBRAL_ANCLAJE ? 'anclaje--bien' : 'anclaje--dudoso';
  }

  irAPagina(numero: number): void {
    if (this.puedeSaltar()) this.pagina.emit(numero);
  }

  // --- Carga ---

  private cargarTodo(documentId: string): void {
    this.detener();
    this.mensajes.set([]);
    this.activa.set(null);

    this.chat.conversaciones(documentId).subscribe({
      next: (lista) => {
        this.conversaciones.set(lista);
        // Se retoma la más reciente; si no hay ninguna, se empieza en blanco.
        if (lista.length > 0) {
          this.activa.set(lista[0].id);
          this.cargarMensajes(lista[0].id);
        }
      },
      error: () => undefined,
    });

    this.chat.sugerencias(documentId, this.idioma.idioma()).subscribe({
      next: (lista) => this.sugerencias.set(lista),
      error: () => undefined,
    });

    this.chat.acciones(documentId, this.idioma.idioma()).subscribe({
      next: (lista) => this.acciones.set(lista),
      error: () => undefined,
    });
  }

  private cargarMensajes(conversationId: string): void {
    this.cargandoMensajes.set(true);

    this.chat.mensajes(this.documentId(), conversationId).subscribe({
      next: (mensajes) => {
        // Si el estudiante cambió de conversación mientras cargaba, esta ya no aplica.
        if (this.activa() !== conversationId) return;
        this.mensajes.set(mensajes.map((mensaje) => this.normalizarMensaje(mensaje)));
        this.cargandoMensajes.set(false);
      },
      error: () => {
        this.cargandoMensajes.set(false);
        this.error.set(this.idioma.traducir('chat.loadError'));
      },
    });
  }

  escuchar(mensaje: MensajeChat): void {
    if (this.escuchando() === mensaje.id) {
      this.detenerAudio();
      return;
    }

    const texto = mensaje.content.replace(/\s+/g, ' ').trim();
    if (!texto) return;

    this.detenerAudio();
    this.escuchando.set(mensaje.id);
    this.chat.speech(texto, this.idioma.idioma()).subscribe({
      next: (blob) => {
        this.audioUrl = URL.createObjectURL(blob);
        this.audioReproduccion = new Audio(this.audioUrl);
        this.audioReproduccion.onended = () => this.detenerAudio();
        this.audioReproduccion.onerror = () => this.escucharConNavegador(texto, mensaje.id);
        void this.audioReproduccion.play().catch(() => this.escucharConNavegador(texto, mensaje.id));
      },
      error: () => this.escucharConNavegador(texto, mensaje.id),
    });
  }

  detenerAudio(): void {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    this.audioReproduccion?.pause();
    this.audioReproduccion = null;
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    this.escuchando.set(null);
  }

  private escucharConNavegador(texto: string, id: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      this.notificaciones.error('No se pudo reproducir el audio. Configura ElevenLabs o usa Chrome/Edge.');
      this.escuchando.set(null);
      return;
    }

    const sintesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(texto);
    const idioma = this.idioma.idioma() === 'en' ? 'en-US' : 'es-ES';
    utterance.lang = idioma;
    utterance.rate = 0.95;
    utterance.volume = 1;
    const voz = sintesis.getVoices().find((candidata) => candidata.lang.toLowerCase().startsWith(idioma.slice(0, 2)));
    if (voz) utterance.voice = voz;
    utterance.onend = () => this.escuchando.set(null);
    utterance.onerror = () => this.escuchando.set(null);
    this.escuchando.set(id);
    setTimeout(() => {
      sintesis.resume();
      sintesis.speak(utterance);
    }, 60);
  }

  /** Las respuestas estructuradas se guardan como JSON para no perder el mapa al recargar. */
  private normalizarMensaje(mensaje: MensajeChat): MensajeChat {
    if (mensaje.role !== 'assistant' || mensaje.diagram || !mensaje.content.trim()) return mensaje;
    const extraido = this.extraerDiagrama(mensaje.content);
    return extraido
      ? { ...mensaje, content: extraido.content, diagram: extraido.diagram }
      : mensaje;
  }

  private recargarConversaciones(): void {
    this.chat.conversaciones(this.documentId()).subscribe({
      next: (lista) => this.conversaciones.set(lista),
      error: () => undefined,
    });
  }
}
