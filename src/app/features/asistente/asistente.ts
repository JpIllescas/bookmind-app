import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Documento } from '../../core/models/documento.model';
import {
  AsistenteService,
  EstadoMotor,
  RespuestaBiblioteca,
} from '../../core/services/asistente.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { Icono } from '../../shared/icono/icono';
import { EstadoLumo, Lumo } from '../../shared/lumo/lumo';
import { paletaDe } from '../../shared/portada/paleta-portada';
import { Portada } from '../../shared/portada/portada';
import { TextoRico } from '../../shared/texto-rico/texto-rico';

/** Ejemplos para que la primera pregunta no salga de la nada. */
const SUGERENCIAS = [
  '¿Qué dice sobre la fotosíntesis?',
  'Explícame el tema principal',
  'Hazme un repaso rápido de lo que tengo',
];

@Component({
  selector: 'app-asistente',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, TextoRico, Lumo, Portada],
  templateUrl: './asistente.html',
  styleUrl: './asistente.scss',
})
export class Asistente {
  private readonly api = inject(AsistenteService);
  private readonly documentos = inject(DocumentosService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly sugerencias = SUGERENCIAS;
  readonly paletaDe = paletaDe;

  readonly pregunta = signal('');
  readonly buscando = signal(false);
  readonly resultado = signal<RespuestaBiblioteca | null>(null);
  readonly libros = signal<Documento[]>([]);
  readonly motor = signal<EstadoMotor | null>(null);
  readonly probando = signal(false);
  readonly error = signal<string | null>(null);

  readonly listos = computed(() =>
    this.libros().filter((libro) => libro.processingStatus === 'ready'),
  );

  readonly puedeBuscar = computed(
    () => this.pregunta().trim().length >= 3 && !this.buscando(),
  );

  /** Lumo acompaña cada momento: saluda, lee mientras busca y comenta el resultado. */
  readonly estadoLumo = computed<EstadoLumo>(() => {
    if (this.buscando()) return 'piensa';
    if (this.error()) return 'neutro';
    if (this.resultado()) return 'celebra';
    return 'saluda';
  });

  readonly mensajeLumo = computed(() => {
    if (this.buscando()) return 'Dame un momento, estoy hojeando tus libros…';
    if (this.error()) return 'Uy, algo falló. ¿Probamos otra vez?';

    const resultado = this.resultado();
    if (resultado) {
      const fuentes = resultado.fuentes.length;
      return fuentes > 0
        ? `¡Lo encontré! Sale en ${fuentes} ${fuentes === 1 ? 'pasaje' : 'pasajes'}; abajo te digo la página.`
        : 'No lo vi en tus libros. Prueba con otras palabras o sube el libro donde crees que está.';
    }

    const listos = this.listos().length;
    if (listos === 0) return '¡Hola! Sube tu primer libro y lo leo contigo.';
    return `¡Hola! Tengo ${listos} ${listos === 1 ? 'libro' : 'libros'} listos. Pregúntame lo que quieras de ellos.`;
  });

  constructor() {
    this.documentos.listar().subscribe({
      next: (libros) => this.libros.set(libros),
      error: () => undefined,
    });

    this.cargarEstado();
  }

  alEscribir(evento: Event): void {
    this.pregunta.set((evento.target as HTMLInputElement).value);
  }

  usarSugerencia(texto: string): void {
    this.pregunta.set(texto);
    this.buscar();
  }

  buscar(): void {
    if (!this.puedeBuscar()) return;

    this.buscando.set(true);
    this.resultado.set(null);
    this.error.set(null);

    this.api.preguntar(this.pregunta().trim()).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta);
        this.buscando.set(false);
        this.cargarEstado();
      },
      // Sin esto la sugerencia parece no hacer nada cuando el motor falla.
      error: (respuesta: { error?: { message?: string } }) => {
        this.error.set(
          respuesta.error?.message ?? 'El asistente no pudo responder.',
        );
        this.buscando.set(false);
        this.cargarEstado();
      },
    });
  }

  probar(): void {
    if (this.probando()) return;
    this.probando.set(true);

    this.api.probar().subscribe({
      next: (prueba) => {
        this.notificaciones[prueba.ok ? 'exito' : 'error'](
          prueba.ok
            ? `El asistente respondió en ${(prueba.ms / 1000).toFixed(1)} s.`
            : 'El asistente no respondió a la prueba.',
        );
        this.probando.set(false);
        this.cargarEstado();
      },
      error: () => {
        this.notificaciones.error('No se pudo probar el asistente.');
        this.probando.set(false);
      },
    });
  }

  /** Texto del estado; el proveedor no publica su carga, esto es lo observado. */
  etiquetaEstado(motor: EstadoMotor): string {
    return {
      operativo: 'Respondiendo con normalidad',
      saturado: 'El modelo está saturado; los intentos se reintentan solos',
      sin_cuota: 'Se agotó la cuota del proveedor',
      con_fallos: 'La última llamada falló',
      sin_datos: 'Sin llamadas todavía en esta sesión del servidor',
      simulado: 'Motor simulado (LLM_PROVIDER=mock)',
    }[motor.estado];
  }

  segundos(ms: number | null): string {
    return ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`;
  }

  private cargarEstado(): void {
    this.api.estado().subscribe({
      next: (estado) => this.motor.set(estado),
      error: () => undefined,
    });
  }
}
