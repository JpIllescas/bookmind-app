import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { type EstadoLumo, type FocoLumo, Lumo } from '../../../shared/lumo/lumo';

/** Lumo asomado sobre el borde de la caja del chat: solo cabeza y orejas, sin quitarle espacio a la conversación. */
@Component({
  selector: 'app-lumo-asomado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Lumo],
  host: { 'aria-hidden': 'true', '[attr.data-estado]': 'estado()' },
  template: `<app-lumo [estado]="estado()" [foco]="foco()" [tamano]="54" [interactivo]="false" />`,
  styleUrl: './lumo-asomado.scss',
})
export class LumoAsomado {
  readonly estado = input<EstadoLumo>('neutro');
  readonly foco = input<FocoLumo | null>(null);
}
