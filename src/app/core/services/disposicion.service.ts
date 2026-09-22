import { Injectable, computed, signal } from '@angular/core';

const CLAVE_LATERAL = 'bookmind.lateral-plegada';

/** Estado de la barra lateral compartido entre el shell y las pantallas. */
@Injectable({ providedIn: 'root' })
export class DisposicionService {
  private readonly preferenciaPlegada = signal(this.leerGuardada());

  /** Una pantalla (el lector) puede pedir la barra plegada sin tocar la preferencia. */
  private readonly forzarPlegada = signal(false);

  readonly lateralPlegada = computed(() => this.forzarPlegada() || this.preferenciaPlegada());
  readonly plegadaPorPantalla = this.forzarPlegada.asReadonly();

  alternarLateral(): void {
    // Si una pantalla la fuerza, el clic la libera en vez de cambiar la preferencia.
    if (this.forzarPlegada()) {
      this.forzarPlegada.set(false);
      this.preferenciaPlegada.set(false);
      return;
    }

    this.preferenciaPlegada.update((plegada) => !plegada);
    try {
      localStorage.setItem(CLAVE_LATERAL, String(this.preferenciaPlegada()));
    } catch {
      // Sin almacenamiento, la preferencia dura lo que dure la sesión.
    }
  }

  forzarLateralPlegada(plegada: boolean): void {
    this.forzarPlegada.set(plegada);
  }

  private leerGuardada(): boolean {
    try {
      return localStorage.getItem(CLAVE_LATERAL) === 'true';
    } catch {
      return false;
    }
  }
}
