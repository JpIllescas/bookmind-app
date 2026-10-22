import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';

import { AuthService } from '../../core/services/auth.service';

interface PasoOnboarding {
  objetivo: string;
  titulo: string;
  texto: string;
}

const PASOS: PasoOnboarding[] = [
  {
    objetivo: 'subir',
    titulo: 'Empieza subiendo un libro',
    texto: 'Carga un PDF o EPUB desde aquí. BookMind lo prepara para que puedas estudiarlo con sus páginas como referencia.',
  },
  {
    objetivo: 'biblioteca',
    titulo: 'Todo queda en tu biblioteca',
    texto: 'Cuando el libro esté listo, aparecerá aquí. Podrás abrirlo, ver tu progreso y continuar justo donde lo dejaste.',
  },
  {
    objetivo: 'asistente',
    titulo: 'Haz preguntas sobre tus libros',
    texto: 'Usa el Asistente IA para consultar tus libros. También encontrarás sugerencias de preguntas y respuestas con citas de página.',
  },
];

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pasos = PASOS;
  readonly paso = signal(0);
  readonly objetivo = signal<DOMRect | null>(null);

  constructor() {
    afterNextRender(() => {
      this.actualizarObjetivo();
      window.addEventListener('resize', this.actualizarObjetivo, { passive: true });
      window.addEventListener('scroll', this.actualizarObjetivo, { passive: true });
    });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', this.actualizarObjetivo);
      window.removeEventListener('scroll', this.actualizarObjetivo);
    });
  }

  siguiente(): void {
    if (this.paso() < this.pasos.length - 1) {
      this.paso.update((actual) => actual + 1);
      afterNextRender(() => this.actualizarObjetivo());
      return;
    }
    this.terminar();
  }

  saltar(): void {
    this.terminar();
  }

  private readonly actualizarObjetivo = (): void => {
    const selector = `[data-onboarding="${this.pasos[this.paso()].objetivo}"]`;
    this.objetivo.set(document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null);
  };

  private terminar(): void {
    this.auth.completarOnboarding().subscribe();
  }
}
