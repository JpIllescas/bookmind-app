import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icono } from '../../shared/icono/icono';

/** Marcador para las pantallas que aún no existen. */
@Component({
  selector: 'app-pendiente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  template: `
    <div class="contenedor">
      <p class="kicker">Próximamente</p>
      <h1>{{ titulo() }}</h1>
      <p class="descripcion">{{ descripcion() }}</p>
      <a class="volver" routerLink="/biblioteca">
        <app-icono nombre="flecha-izquierda" [tamano]="16" />
        Volver a la biblioteca
      </a>
    </div>
  `,
  styles: `
    .contenedor {
      max-width: 620px;
      margin: 0 auto;
      padding: 90px 48px;
      text-align: center;
    }

    h1 {
      margin: 8px 0 10px;
      font-size: 32px;
    }

    .descripcion {
      margin: 0 0 22px;
      color: var(--texto-secundario);
    }

    .volver {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--acento);
      font-weight: 600;
      text-decoration: none;
    }
  `,
})
export class Pendiente {
  readonly titulo = input.required<string>();
  readonly descripcion = input.required<string>();
}
