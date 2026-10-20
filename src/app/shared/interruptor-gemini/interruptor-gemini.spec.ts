import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AyudaGeminiService } from '../../core/services/ayuda-gemini.service';
import { InterruptorGemini } from './interruptor-gemini';

describe('InterruptorGemini', () => {
  const activada = signal(false);
  const cambiar = vi.fn();

  beforeEach(() => {
    activada.set(false);
    cambiar.mockClear();
    TestBed.configureTestingModule({
      imports: [InterruptorGemini],
      providers: [
        {
          provide: AyudaGeminiService,
          useValue: {
            cargar: vi.fn(),
            cambiar,
            activada,
            cargado: signal(true),
            disponible: signal(true),
            enUso: computed(() => activada()),
          },
        },
      ],
    });
  });

  function montar(compacto: boolean) {
    const fixture = TestBed.createComponent(InterruptorGemini);
    fixture.componentRef.setInput('compacto', compacto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('compacto muestra solo la etiqueta; completo también el estado', () => {
    expect(montar(true).querySelector('.interruptor__estado')).toBeNull();
    expect(montar(false).querySelector('.interruptor__estado')).not.toBeNull();
  });

  it('solo el compacto lleva aria-label: el completo se nombra con su etiqueta y su estado visibles', () => {
    expect(montar(true).querySelector('button')!.getAttribute('aria-label')).toBe('Ayuda de Gemini');
    expect(montar(false).querySelector('button')!.hasAttribute('aria-label')).toBe(false);
  });

  it('aria-checked sigue a la preferencia y al pulsar pide el cambio', () => {
    const fixture = TestBed.createComponent(InterruptorGemini);
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(boton.getAttribute('aria-checked')).toBe('false');

    boton.click();
    expect(cambiar).toHaveBeenCalledWith(true);

    activada.set(true);
    fixture.detectChanges();
    expect(boton.getAttribute('aria-checked')).toBe('true');
  });
});
