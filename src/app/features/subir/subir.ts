import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { IdiomaService } from '../../core/services/idioma.service';
import { MAX_MB, SubidaEnCursoService } from '../../core/services/subida-en-curso.service';
import { Icono } from '../../shared/icono/icono';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

type EstadoPaso = 'pendiente' | 'activo' | 'completo';

@Component({
  selector: 'app-subir',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, TraducirPipe],
  templateUrl: './subir.html',
  styleUrl: './subir.scss',
})
export class Subir {
  private readonly subida = inject(SubidaEnCursoService);
  private readonly router = inject(Router);
  private readonly idioma = inject(IdiomaService);

  readonly arrastrando = signal(false);
  readonly estado = this.subida.etapa;
  readonly archivo = this.subida.archivo;
  readonly porcentaje = this.subida.porcentaje;
  readonly error = this.subida.error;
  readonly resultado = this.subida.documento;

  readonly textoOcr = computed(() => {
    const avance = this.subida.progresoOcr();
    if (!avance) return null;
    return `${this.idioma.traducir('ocr.digitizing')} · ${avance.procesadas}/${avance.total}`;
  });

  readonly maxMb = MAX_MB;

  readonly tamanoLegible = computed(() => {
    const bytes = this.archivo()?.size ?? 0;
    return bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  /** Los pasos del servidor se encienden juntos: ocurren en una sola petición. */
  readonly pasos = computed<{ etiqueta: string; estado: EstadoPaso }[]>(() => {
    const estado = this.estado();
    const subiendo = estado === 'enviando';
    const enServidor = estado === 'preparando';
    const terminado = estado === 'listo';
    const huboOcr = this.subida.huboOcr();

    const paso = (activo: boolean, completo: boolean): EstadoPaso =>
      completo ? 'completo' : activo ? 'activo' : 'pendiente';

    const digitalizando = this.subida.progresoOcr() !== null;

    return [
      {
        etiqueta: 'Subiendo archivo',
        estado: paso(subiendo, enServidor || terminado),
      },
      {
        etiqueta: 'Extrayendo y normalizando texto',
        estado: paso(enServidor && !huboOcr, terminado || huboOcr),
      },
      ...(huboOcr
        ? [{
            etiqueta: this.textoOcr() ?? this.idioma.traducir('ocr.stepDigitize'),
            estado: paso(digitalizando, terminado || (enServidor && !digitalizando)),
          }]
        : []),
      {
        etiqueta: 'Analizando el libro: materia y nivel',
        estado: paso(enServidor, terminado),
      },
      {
        etiqueta: 'Indexando el libro para las citas',
        estado: paso(enServidor, terminado),
      },
    ];
  });

  // --- Interacción ---

  alArrastrar(evento: DragEvent, dentro: boolean): void {
    evento.preventDefault();
    this.arrastrando.set(dentro);
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);

    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo) this.subida.iniciar(archivo);
  }

  alElegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (archivo) this.subida.iniciar(archivo);
    // Permite volver a elegir el mismo archivo tras un error.
    entrada.value = '';
  }

  reintentar(): void {
    this.subida.limpiar();
  }

  abrirLector(): void {
    const documento = this.resultado();
    if (!documento) return;
    void this.router.navigate(['/lector', documento.id]);
    this.subida.limpiar();
  }

  irABiblioteca(): void {
    void this.router.navigate(['/biblioteca']);
    this.subida.limpiar();
  }
}
