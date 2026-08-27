import {
  AfterViewInit,
  OnInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (respuesta: GoogleCredentialResponse) => void;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

@Component({
  selector: 'app-entrar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './entrar.html',
  styleUrl: './entrar.scss',
})
export class Entrar implements AfterViewInit, OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly zona = inject(NgZone);
  private readonly googleButton = inject(ElementRef<HTMLElement>);

  readonly modo = signal<'entrar' | 'registrar'>('entrar');
  readonly email = signal('');
  readonly password = signal('');
  readonly nombre = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly googleDisponible = signal(false);

  ngOnInit(): void {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('google_token');
    if (!token) return;

    history.replaceState(null, '', window.location.pathname);
    this.enviando.set(true);
    this.auth.guardarTokenGoogle(token).subscribe({
      next: () => this.irAlDestino(),
      error: () => {
        this.error.set('No se pudo completar el acceso con Google.');
        this.enviando.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    const error = new URLSearchParams(window.location.search).get('google_error');
    if (error) {
      history.replaceState(null, '', window.location.pathname);
      this.error.set('No se pudo completar el acceso con Google.');
    }
  }

  iniciarGoogle(): void {
    if (!environment.googleClientId || this.enviando()) {
      this.avisarGoogleNoConfigurado();
      return;
    }
    window.location.assign(`${environment.apiUrl}/auth/google`);
  }

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

  avisarGoogleNoConfigurado(): void {
    this.error.set(
      environment.googleClientId
        ? 'No se pudo cargar el inicio de sesión con Google. Revisa tu conexión o bloqueadores del navegador.'
        : 'El acceso con Google necesita configurar GOOGLE_CLIENT_ID en el frontend y el backend.',
    );
  }

  private async inicializarGoogle(): Promise<void> {
    if (!environment.googleClientId) return;

    const googleCargado = await this.esperarGoogle();
    if (!googleCargado) {
      this.error.set('No se pudo cargar el inicio de sesión con Google.');
      return;
    }

    const google = window.google;
    const elemento = this.googleButton.nativeElement.querySelector(
      '[data-google-button]',
    ) as HTMLElement | null;
    if (!google || !elemento) return;

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (respuesta) =>
        this.zona.run(() => this.autenticarConGoogle(respuesta.credential)),
    });
    google.accounts.id.renderButton(elemento, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 350,
    });
    this.googleDisponible.set(true);
  }

  private esperarGoogle(): Promise<boolean> {
    if (window.google) return Promise.resolve(true);

    return new Promise((resolve) => {
      const inicio = Date.now();
      const revisar = () => {
        if (window.google) {
          resolve(true);
          return;
        }
        if (Date.now() - inicio >= 10000) {
          resolve(false);
          return;
        }
        window.setTimeout(revisar, 100);
      };
      revisar();
    });
  }

  private autenticarConGoogle(idToken: string): void {
    if (this.enviando()) return;

    this.enviando.set(true);
    this.error.set(null);
    this.auth.loginConGoogle(idToken).subscribe({
      next: () => this.irAlDestino(),
      error: (respuesta: { status: number; error?: { message?: string } }) => {
        this.error.set(this.mensajeDeError(respuesta));
        this.enviando.set(false);
      },
    });
  }

  private irAlDestino(): void {
    const destino = this.ruta.snapshot.queryParamMap.get('destino');
    void this.router.navigateByUrl(destino ?? '/biblioteca');
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
