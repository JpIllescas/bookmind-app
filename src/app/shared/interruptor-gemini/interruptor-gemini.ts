import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';

import { AyudaGeminiService } from '../../core/services/ayuda-gemini.service';
import { TraducirPipe } from '../i18n/traducir.pipe';

/** Encender o apagar la redacción con Gemini; apagado, todo sale del motor propio. */
@Component({
  selector: 'app-interruptor-gemini',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TraducirPipe],
  template: `
    <button
      type="button"
      role="switch"
      class="interruptor"
      [class.interruptor--compacto]="compacto()"
      [attr.aria-checked]="ayuda.enUso()"
      [disabled]="!ayuda.disponible()"
      [attr.aria-label]="compacto() ? ('gemini.label' | traducir) : null"
      [attr.title]="(ayuda.cargado() && !ayuda.disponible() ? 'gemini.unavailable' : 'gemini.label') | traducir"
      (click)="ayuda.cambiar(!ayuda.activada())"
    >
      <span class="interruptor__riel" aria-hidden="true"><span class="interruptor__perilla"></span></span>
      <span class="interruptor__textos">
        <span class="interruptor__etiqueta">{{ 'gemini.label' | traducir }}</span>
        @if (!compacto()) {
          <span class="interruptor__estado">{{ claveEstado() | traducir }}</span>
        }
      </span>
    </button>
  `,
  styleUrl: './interruptor-gemini.scss',
})
export class InterruptorGemini implements OnInit {
  protected readonly ayuda = inject(AyudaGeminiService);
  /** En cabeceras estrechas solo se ve la etiqueta; el estado lo dice el propio interruptor. */
  readonly compacto = input(false);

  protected readonly claveEstado = computed(() => {
    if (!this.ayuda.disponible()) return 'gemini.unavailableShort';
    return this.ayuda.activada() ? 'gemini.on' : 'gemini.off';
  });

  ngOnInit(): void {
    this.ayuda.cargar();
  }
}
