import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Documento } from '../../core/models/documento.model';
import { DocumentosService } from '../../core/services/documentos.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { Icono } from '../../shared/icono/icono';

type Filtro = 'todos' | 'PDF' | 'EPUB' | 'progreso';

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'PDF', etiqueta: 'PDF' },
  { valor: 'EPUB', etiqueta: 'EPUB' },
  { valor: 'progreso', etiqueta: 'En progreso' },
];

@Component({
  selector: 'app-biblioteca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  templateUrl: './biblioteca.html',
  styleUrl: './biblioteca.scss',
})
export class Biblioteca {
  private readonly documentosApi = inject(DocumentosService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly filtros = FILTROS;

  readonly documentos = signal<Documento[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly busqueda = signal('');
  readonly filtroActivo = signal<Filtro>('todos');

  /** Id del libro con el borrado pendiente de confirmar, en su propia tarjeta. */
  readonly porBorrar = signal<string | null>(null);
  readonly borrando = signal<string | null>(null);

  /** Distinto de "ninguno coincide con el filtro": la salida es otra. */
  readonly bibliotecaVacia = computed(
    () => !this.cargando() && this.documentos().length === 0,
  );

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

  alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroActivo.set('todos');
  }
}
