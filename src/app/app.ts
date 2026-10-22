import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgxSonnerToaster } from 'ngx-sonner';

import { Lumo } from './shared/lumo/lumo';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NgxSonnerToaster, Lumo],
  template: `
    <router-outlet />
    @if (splashVisible()) {
      <div class="splash" role="status" aria-live="polite" aria-label="Cargando BookMind">
        <div class="splash__halo" aria-hidden="true"></div>
        <app-lumo
          class="splash__lumo"
          estado="piensa"
          [tamano]="190"
          [interactivo]="false"
          foco="abajo"
        />
        <div class="splash__copy">
          <img class="splash__logo" src="/logo.jpg" alt="BookAI" />
          <span class="splash__message">Preparando tu espacio de estudio...</span>
        </div>
      </div>
    }
    <ngx-sonner-toaster position="top-right" richColors closeButton />
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  readonly splashVisible = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        this.cancelarTemporizador();
        this.splashVisible.set(false);
        this.temporizador = setTimeout(() => this.splashVisible.set(true), 450);
        return;
      }

      if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        this.cancelarTemporizador();
        this.splashVisible.set(false);
      }
    });

    this.destroyRef.onDestroy(() => this.cancelarTemporizador());
  }

  private cancelarTemporizador(): void {
    if (!this.temporizador) return;
    clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}
