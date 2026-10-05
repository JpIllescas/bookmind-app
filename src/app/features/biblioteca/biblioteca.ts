import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Documento } from '../../core/models/documento.model';
import { AuthService } from '../../core/services/auth.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { Icono } from '../../shared/icono/icono';
import { EstadoLumo, Lumo } from '../../shared/lumo/lumo';
import { paletaDe } from '../../shared/portada/paleta-portada';
import { Portada } from '../../shared/portada/portada';
import { IdiomaService } from '../../core/services/idioma.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

type Filtro = 'todos' | 'PDF' | 'EPUB' | 'progreso';

/** Consejos cortos que Lumo da al tocarlo; rotan en orden. */
const CONSEJOS = [
  'Una lección de cinco ejercicios toma unos tres minutos: es la forma más rápida de mantener la racha.',
  'Pregúntale al libro con tus palabras; la respuesta llega con la página exacta de donde sale.',
  'Repasar un capítulo dominado suma coronas; empezar uno nuevo suma más XP.',
  'Si un resumen te queda corto, pídele al chat que profundice en una sección concreta.',
  'La meta diaria sale de la duración que elegiste en tu plan; puedes ajustarla en Preferencias.',
];

const TIPS_EN = [
  'A five-question lesson takes about three minutes: it is the fastest way to keep your streak alive.',
  'Ask the book in your own words; the answer comes with the exact page it came from.',
  'Reviewing a mastered chapter earns crowns; starting a new one earns more XP.',
  'If a summary feels too short, ask the chat to go deeper into a specific section.',
  'Your daily goal comes from the duration you chose in your plan; you can adjust it in Preferences.',
];

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'library.all' },
  { valor: 'progreso', etiqueta: 'library.inProgress' },
  { valor: 'PDF', etiqueta: 'PDF' },
  { valor: 'EPUB', etiqueta: 'EPUB' },
];

@Component({
  selector: 'app-biblioteca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, Lumo, Portada, TraducirPipe],
  templateUrl: './biblioteca.html',
  styleUrl: './biblioteca.scss',
})
export class Biblioteca {
  private readonly documentosApi = inject(DocumentosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly auth = inject(AuthService);
  private readonly gamificacionStore = inject(GamificacionService);
  readonly idioma = inject(IdiomaService);

  readonly filtros = FILTROS;
  readonly paletaDe = paletaDe;

  readonly gamificacion = this.gamificacionStore.resumen;
  readonly progresoMeta = this.gamificacionStore.progresoMeta;
  readonly progresoNivel = this.gamificacionStore.progresoNivel;
  readonly metaCumplida = this.gamificacionStore.metaCumplida;

  readonly documentos = signal<Documento[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly busqueda = signal('');
  readonly filtroActivo = signal<Filtro>('todos');

  /** Id del libro con el borrado pendiente de confirmar, en su propia tarjeta. */
  readonly porBorrar = signal<string | null>(null);
  readonly borrando = signal<string | null>(null);

  /** Consejo visible tras tocar a Lumo; vuelve al mensaje del día a los segundos. */
  readonly consejo = signal<string | null>(null);
  private consejoIndice = 0;
  private consejoTemporizador: ReturnType<typeof setTimeout> | null = null;

  readonly primerNombre = computed(() => this.auth.usuario()?.name?.split(/\s+/)[0] ?? '');

  readonly saludo = computed(() => {
    const hora = new Date().getHours();
    if (this.idioma.idioma() === 'en') {
      if (hora < 12) return 'Good morning';
      if (hora < 19) return 'Good afternoon';
      return 'Good evening';
    }
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly estadoLumo = computed<EstadoLumo>(() => {
    const g = this.gamificacion();
    if (!g) return 'saluda';
    if (g.rachaEnRiesgo) return 'duerme';
    return this.metaCumplida() ? 'celebra' : 'saluda';
  });

  /** El subtítulo cambia con el día del estudiante, no es un eslogan fijo. */
  readonly mensajeDelDia = computed(() => {
    const ingles = this.idioma.idioma() === 'en';
    const g = this.gamificacion();
    if (!g) {
      return ingles
        ? 'Upload a book and study it by talking with it: summaries, flashcards, and quizzes come from its pages.'
        : 'Sube un libro y estúdialo conversando con él: resúmenes, flashcards y quiz salen de sus páginas.';
    }
    if (g.rachaEnRiesgo) {
      return ingles
        ? `Your ${g.racha}-day streak is at risk today. A short lesson can save it.`
        : `Tu racha de ${g.racha} ${g.racha === 1 ? 'día' : 'días'} se apaga hoy. Una lección corta y la salvas.`;
    }
    if (this.metaCumplida()) {
      return ingles
        ? "Today's goal is complete. Anything you read now is extra."
        : 'Meta de hoy cumplida. Lo que leas ahora suma como extra.';
    }
    if (g.xpHoy > 0) {
      return ingles
        ? `You are at ${g.xpHoy} of ${g.metaDiaria} XP today. ${g.metaDiaria - g.xpHoy} to go.`
        : `Vas por ${g.xpHoy} de ${g.metaDiaria} XP hoy. Te faltan ${g.metaDiaria - g.xpHoy}.`;
    }
    if (g.racha > 0) {
      return ingles
        ? `You have a ${g.racha}-day streak. A lesson today keeps it going.`
        : `Llevas ${g.racha} ${g.racha === 1 ? 'día' : 'días'} seguidos. Una lección de hoy mantiene la racha.`;
    }
    return ingles
      ? 'Open a book or take a lesson to start your streak.'
      : 'Abre un libro o haz una lección para encender tu racha.';
  });

  /** Distinto de "ninguno coincide con el filtro": la salida es otra. */
  readonly bibliotecaVacia = computed(
    () => !this.cargando() && this.documentos().length === 0,
  );

  readonly resumen = computed(() => {
    const todos = this.documentos();
    return {
      total: todos.length,
      enProgreso: todos.filter((d) => d.progress > 0 && d.progress < 100).length,
      terminados: todos.filter((d) => d.progress >= 100).length,
      paginas: todos.reduce((suma, d) => suma + d.pages, 0),
    };
  });

  /** El libro empezado y sin terminar que se abrió más recientemente. */
  readonly paraSeguir = computed(() => {
    const candidatos = this.documentos().filter(
      (d) => d.progress > 0 && d.progress < 100 && d.processingStatus === 'ready',
    );
    return candidatos.length > 0 ? candidatos[0] : null;
  });

  readonly visibles = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const filtro = this.filtroActivo();

    return this.documentos().filter((documento) => {
      const coincideFiltro =
        filtro === 'todos' ||
        (filtro === 'progreso'
          ? documento.progress > 0 && documento.progress < 100
          : documento.type === filtro);

      if (!coincideFiltro) return false;
      if (!termino) return true;

      return (
        documento.title.toLowerCase().includes(termino) ||
        (documento.author ?? '').toLowerCase().includes(termino) ||
        documento.etiqueta.toLowerCase().includes(termino)
      );
    });
  });

  readonly sinResultados = computed(
    () => !this.bibliotecaVacia() && !this.cargando() && this.visibles().length === 0,
  );

  constructor() {
    this.cargar();
    this.gamificacionStore.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.documentosApi.listar().subscribe({
      next: (documentos) => {
        this.documentos.set(documentos);
        this.cargando.set(false);
      },
      error: () => {
        // El 401 lo maneja el interceptor; esto es "el backend no responde".
        this.error.set(
          'No se pudo cargar tu biblioteca. Revisa que el servidor esté encendido.',
        );
        this.cargando.set(false);
      },
    });
  }

  estadoDe(documento: Documento): { texto: string; clase: string } | null {
    switch (documento.processingStatus) {
      case 'pending':
      case 'processing':
        return { texto: 'Preparando', clase: 'pildora--aviso' };
      case 'failed':
        return { texto: 'Falló', clase: 'pildora--error' };
      default:
        return documento.progress >= 100 ? { texto: 'Terminado', clase: 'pildora--exito' } : null;
    }
  }

  pedirBorrado(evento: Event, documento: Documento): void {
    // La tarjeta entera es un enlace al lector: hay que cortar la navegación.
    evento.preventDefault();
    evento.stopPropagation();
    this.porBorrar.set(documento.id);
  }

  cancelarBorrado(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.porBorrar.set(null);
  }

  confirmarBorrado(evento: Event, documento: Documento): void {
    evento.preventDefault();
    evento.stopPropagation();

    if (this.borrando()) return;
    this.borrando.set(documento.id);

    this.documentosApi.eliminar(documento.id).subscribe({
      next: () => {
        this.documentos.update((actuales) =>
          actuales.filter((actual) => actual.id !== documento.id),
        );
        this.notificaciones.exito(`Se eliminó "${documento.title}".`);
        this.porBorrar.set(null);
        this.borrando.set(null);
      },
      error: () => {
        this.notificaciones.error('No se pudo eliminar el documento.');
        this.borrando.set(null);
      },
    });
  }

  darConsejo(): void {
    const consejos = this.idioma.idioma() === 'en' ? TIPS_EN : CONSEJOS;
    this.consejo.set(consejos[this.consejoIndice % consejos.length]);
    this.consejoIndice++;
    if (this.consejoTemporizador) clearTimeout(this.consejoTemporizador);
    this.consejoTemporizador = setTimeout(() => this.consejo.set(null), 7000);
  }

  alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroActivo.set('todos');
  }
}
