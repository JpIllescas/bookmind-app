import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { type LibroConColor, motivoDe, motivoDeLibro, paletaDe, paletaDeLibro } from './paleta-portada';

/**
 * Portada de libro dibujada con CSS: lomo, degradado y un motivo geométrico.
 * Sin imágenes: con `libro`, el color sale de la materia y el motivo del libro; si no, del título.
 */
@Component({
  selector: 'app-portada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"portada portada--" + motivo() + (tamano() === "grande" ? " portada--grande" : "") + (editorial() ? " portada--editorial" : "")',
    '[style.--base]': 'paleta().base',
    '[style.--claro]': 'paleta().claro',
    '[style.--relieve]': 'paleta().relieve',
    '[attr.aria-hidden]': 'true',
  },
  template: `
    <span class="portada__lomo"></span>
    <span class="portada__motivo"></span>
    <span class="portada__cinta"></span>
    <span class="portada__textos">
      <span class="portada__titulo">{{ titulo() }}</span>
      @if (editorial()) {
        <span class="portada__filete"></span>
      }
      @if (autor(); as nombre) {
        <span class="portada__autor">{{ nombre }}</span>
      }
      @if (editorial() && etiqueta(); as texto) {
        <span class="portada__etiqueta">{{ texto }}</span>
      }
    </span>
  `,
  styleUrl: './portada.scss',
})
export class Portada {
  readonly titulo = input.required<string>();
  readonly autor = input<string | null>(null);
  /** Las grandes muestran el autor y un título mayor. */
  readonly tamano = input<'chica' | 'grande'>('chica');
  readonly libro = input<LibroConColor | null>(null);
  /** Sobria, como una edición real: título arriba, filete y la materia al pie; sin motivo geométrico. */
  readonly editorial = input(false);
  /** Solo en la editorial: la materia, al pie de la portada. */
  readonly etiqueta = input<string | null>(null);

  readonly paleta = computed(() => {
    const libro = this.libro();
    return libro ? paletaDeLibro(libro) : paletaDe(this.titulo());
  });
  readonly motivo = computed(() => {
    const libro = this.libro();
    return libro ? motivoDeLibro(libro) : motivoDe(this.titulo());
  });}
