import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { motivoDe, paletaDe } from './paleta-portada';

/**
 * Portada de libro dibujada con CSS: lomo, degradado y un motivo geométrico.
 * Sin imágenes: la paleta y el motivo salen del título, así cada libro es reconocible.
 */
@Component({
  selector: 'app-portada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"portada portada--" + motivo() + (tamano() === "grande" ? " portada--grande" : "")',
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
      @if (autor(); as nombre) {
        <span class="portada__autor">{{ nombre }}</span>
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

  readonly paleta = computed(() => paletaDe(this.titulo()));
  readonly motivo = computed(() => motivoDe(this.titulo()));
}
