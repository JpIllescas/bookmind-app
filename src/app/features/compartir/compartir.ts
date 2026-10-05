import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChatService, ConversacionPublica } from '../../core/services/chat.service';
import { TextoRico } from '../../shared/texto-rico/texto-rico';

@Component({
  selector: 'app-compartir',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TextoRico],
  templateUrl: './compartir.html',
  styleUrl: './compartir.scss',
})
export class Compartir {
  readonly token = input.required<string>();
  private readonly chat = inject(ChatService);
  readonly datos = signal<ConversacionPublica | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);

  constructor() {
    // La ruta pública no requiere sesión: el token largo funciona como autorización.
    effect(() => {
      const token = this.token();
      if (!token) return;
      this.chat.publica(token).subscribe({
        next: (datos) => {
          this.datos.set(datos);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
    });
  }
}
