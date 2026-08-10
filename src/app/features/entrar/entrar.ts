import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-entrar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly modo = signal<'entrar' | 'registrar'>('entrar');
  readonly email = signal('');
  readonly password = signal('');
  readonly nombre = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  cambiarModo(): void {
    this.modo.update((actual) => (actual === 'entrar' ? 'registrar' : 'entrar'));
    this.error.set(null);
  }

  enviar(): void {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);

    const peticion =
      this.modo() === 'entrar'
        ? this.auth.login(this.email(), this.password())
        : this.auth.registrar(this.email(), this.password(), this.nombre());

    peticion.subscribe({
      next: () => {
        // Si el guard interceptó una ruta, se vuelve ahí.
        const destino = this.ruta.snapshot.queryParamMap.get('destino');
        void this.router.navigateByUrl(destino ?? '/biblioteca');
      },
      error: (respuesta: { status: number; error?: { message?: string } }) => {
        this.error.set(this.mensajeDeError(respuesta));
        this.enviando.set(false);
      },
    });
  }

  private mensajeDeError(respuesta: {
    status: number;
    error?: { message?: string };
  }): string {
    // Status 0: la petición no salió, el backend está apagado.
    if (respuesta.status === 0) {
      return 'No se pudo contactar al servidor. ¿Está corriendo el backend en el puerto 3000?';
    }

    const delServidor = respuesta.error?.message;
    if (typeof delServidor === 'string') return delServidor;
    if (Array.isArray(delServidor)) return (delServidor as string[]).join(' ');

    return 'Ocurrió un error. Intenta de nuevo.';
  }
}
