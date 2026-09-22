import { Injectable, computed, effect, signal } from '@angular/core';

/** `sistema` sigue a prefers-color-scheme; los otros dos lo fijan. */
export type Tema = 'claro' | 'oscuro' | 'sistema';

const CLAVE_TEMA = 'bookmind.tema';

const TEMAS: Tema[] = ['claro', 'oscuro', 'sistema'];

@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly preferido = signal<Tema>(this.leerGuardado());
  /** Sube con cada cambio del sistema para que `esOscuro` se recalcule. */
  private readonly cambiosSistema = signal(0);

  readonly tema = this.preferido.asReadonly();

  /** Lo que se ve en pantalla ahora mismo, resuelto el modo sistema. */
  readonly esOscuro = computed(() => {
    const tema = this.preferido();
    this.cambiosSistema();
    if (tema === 'sistema') return this.consulta?.matches ?? false;
    return tema === 'oscuro';
  });

  private readonly consulta =
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  constructor() {
    // El CSS lee data-theme; sin atributo manda prefers-color-scheme.
    effect(() => {
      const tema = this.preferido();
      const raiz = document.documentElement;

      if (tema === 'sistema') raiz.removeAttribute('data-theme');
      else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');

      try {
        localStorage.setItem(CLAVE_TEMA, tema);
      } catch {
        // Sin almacenamiento el tema simplemente no persiste.
      }
    });

    this.consulta?.addEventListener('change', () => this.cambiosSistema.update((n) => n + 1));
  }

  fijar(tema: Tema): void {
    this.preferido.set(tema);
  }

  /** Alterna entre claro y oscuro partiendo de lo que se ve, no de la preferencia. */
  alternar(): void {
    this.preferido.set(this.esOscuro() ? 'claro' : 'oscuro');
  }

  private leerGuardado(): Tema {
    try {
      const guardado = localStorage.getItem(CLAVE_TEMA);
      return TEMAS.includes(guardado as Tema) ? (guardado as Tema) : 'sistema';
    } catch {
      return 'sistema';
    }
  }
}
