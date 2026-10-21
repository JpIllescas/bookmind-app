import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { Documento } from '../../../core/models/documento.model';
import { DocumentosService } from '../../../core/services/documentos.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { TraducirPipe } from '../../../shared/i18n/traducir.pipe';

/** Formulario sobre la portada para cambiar título y autor; la tarjeta deja de ser enlace mientras está abierto. */
@Component({
  selector: 'app-renombrar-libro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraducirPipe],
  template: `
    <form (submit)="guardar($event)" (keydown.escape)="cancelar($event)">
      <label class="campo">
        <span>{{ 'library.renameTitle' | traducir }}</span>
        <input type="text" name="titulo" maxlength="200" required autocomplete="off"
          [value]="titulo()" (input)="titulo.set(valorDe($event))" />
      </label>
      <label class="campo">
        <span>{{ 'library.renameAuthor' | traducir }}</span>
        <input type="text" name="autor" maxlength="120" autocomplete="off"
          [placeholder]="'library.renameAuthorHint' | traducir"
          [value]="autor()" (input)="autor.set(valorDe($event))" />
      </label>
      <div class="botones">
        <button type="submit" class="guardar" [disabled]="guardando()">
          {{ (guardando() ? 'library.renameSaving' : 'library.renameSave') | traducir }}
        </button>
        <button type="button" class="cancelar" (click)="cancelar($event)">{{ 'common.cancel' | traducir }}</button>
      </div>
    </form>
  `,
  styleUrl: './renombrar-libro.scss',
})
export class RenombrarLibro {
  private readonly documentos = inject(DocumentosService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly libro = input.required<Documento>();
  readonly guardado = output<Documento>();
  readonly cancelado = output<void>();

  readonly titulo = linkedSignal(() => this.libro().title);
  readonly autor = linkedSignal(() => this.libro().author ?? '');
  readonly guardando = signal(false);

  constructor() {
    // `autofocus` no aplica a lo que se inserta después de cargar la página.
    const anfitrion = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => anfitrion.querySelector('input')?.select());
  }

  valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  cancelar(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.cancelado.emit();
  }

  guardar(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    if (this.guardando()) return;

    const libro = this.libro();
    const titulo = this.titulo().trim();
    const autor = this.autor().trim() || null;

    if (!titulo) {
      this.notificaciones.error('El título no puede quedar vacío. Escribe cómo quieres llamar al libro.');
      return;
    }
    if (titulo === libro.title && autor === libro.author) {
      this.cancelado.emit();
      return;
    }

    this.guardando.set(true);
    this.documentos.renombrar(libro.id, { titulo, autor }).subscribe({
      next: (actualizado) => {
        this.guardando.set(false);
        this.notificaciones.exito(`Ahora se llama "${actualizado.title}".`);
        this.guardado.emit({ ...libro, title: actualizado.title, author: actualizado.author });
      },
      error: () => {
        this.guardando.set(false);
        this.notificaciones.error('No se pudo cambiar el nombre. Revisa tu conexión e intenta de nuevo.');
      },
    });
  }
}
