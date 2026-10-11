import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Documento, ProgresoOcr, estaEnProceso } from '../../core/models/documento.model';
import { IdiomaService } from '../../core/services/idioma.service';
import { DocumentosService } from '../../core/services/documentos.service';
import { Icono } from '../../shared/icono/icono';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { TraducirPipe } from '../../shared/i18n/traducir.pipe';

type Estado = 'reposo' | 'subiendo' | 'procesando' | 'listo' | 'error';
type EstadoPaso = 'pendiente' | 'activo' | 'completo';

const MAX_MB = 150;
const EXTENSIONES = ['.pdf', '.epub'];

@Component({
  selector: 'app-subir',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono, TraducirPipe],
  templateUrl: './subir.html',
  styleUrl: './subir.scss',
})
export class Subir {
  private readonly documentos = inject(DocumentosService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly idioma = inject(IdiomaService);

  readonly estado = signal<Estado>('reposo');
  readonly arrastrando = signal(false);
  readonly archivo = signal<File | null>(null);
  readonly porcentaje = signal(0);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<Documento | null>(null);
  /** Avance del OCR mientras el servidor digitaliza; null fuera de esa etapa. */
  readonly progresoOcr = signal<ProgresoOcr | null>(null);
  /** El paso de OCR solo aparece si el libro lo necesitó. */
  readonly huboOcr = signal(false);

  readonly textoOcr = computed(() => {
    const avance = this.progresoOcr();
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
    const subiendo = estado === 'subiendo';
    const enServidor = estado === 'procesando';
    const terminado = estado === 'listo';

    const paso = (activo: boolean, completo: boolean): EstadoPaso =>
      completo ? 'completo' : activo ? 'activo' : 'pendiente';

    const digitalizando = this.progresoOcr() !== null;

    return [
      {
        etiqueta: 'Subiendo archivo',
        estado: paso(subiendo, enServidor || terminado),
      },
      {
        etiqueta: 'Extrayendo y normalizando texto',
        estado: paso(enServidor && !this.huboOcr(), terminado || this.huboOcr()),
      },
      ...(this.huboOcr()
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
    if (archivo) this.procesar(archivo);
  }

  alElegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (archivo) this.procesar(archivo);
    // Permite volver a elegir el mismo archivo tras un error.
    entrada.value = '';
  }

  reintentar(): void {
    this.estado.set('reposo');
    this.archivo.set(null);
    this.porcentaje.set(0);
    this.error.set(null);
    this.progresoOcr.set(null);
    this.huboOcr.set(false);
  }

  abrirLector(): void {
    const documento = this.resultado();
    if (documento) void this.router.navigate(['/lector', documento.id]);
  }

  // --- Subida ---

  private procesar(archivo: File): void {
    const problema = this.validar(archivo);
    if (problema) {
      this.archivo.set(archivo);
      this.error.set(problema);
      this.estado.set('error');
      this.notificaciones.error(problema);
      return;
    }

    this.archivo.set(archivo);
    this.error.set(null);
    this.porcentaje.set(0);
    this.estado.set('subiendo');

    this.documentos.subir(archivo).subscribe({
      next: (evento) => {
        this.porcentaje.set(evento.porcentaje);

        // Transferencia completa: ahora el trabajo ocurre en el servidor.
        if (evento.tipo === 'progreso' && evento.porcentaje === 100) {
          this.estado.set('procesando');
        }

        if (evento.tipo === 'listo' && evento.documento) {
          this.resultado.set(evento.documento);
          if (estaEnProceso(evento.documento)) {
            this.estado.set('procesando');
            this.seguir(evento.documento.id);
          } else this.estado.set('listo');
        }
      },
      error: (respuesta: { status: number; error?: { message?: string } }) => {
        this.error.set(this.mensajeDeError(respuesta));
        this.estado.set('error');
      },
    });
  }

  private seguir(id: string): void {
    this.documentos.seguirProcesamiento(id).subscribe({
      next: (documento) => {
        this.progresoOcr.set(documento.processingStatus === 'ocr' ? documento.progresoOcr : null);
        if (documento.processingStatus === 'ocr') this.huboOcr.set(true);
        if (estaEnProceso(documento)) return;

        if (documento.processingStatus === 'ready') {
          this.resultado.set(documento);
          this.estado.set('listo');
        } else {
          this.error.set(documento.processingError ?? 'No se pudo procesar el documento.');
          this.estado.set('error');
        }
      },
      error: () => {
        this.error.set('Perdimos la conexión mientras se preparaba el libro. Revisa la biblioteca en un momento.');
        this.estado.set('error');
      },
    });
  }

  private validar(archivo: File): string | null {
    const nombre = archivo.name.toLowerCase();

    if (!EXTENSIONES.some((ext) => nombre.endsWith(ext))) {
      return 'BookMind solo acepta archivos PDF y EPUB.';
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      return `El archivo pesa más de ${MAX_MB} MB.`;
    }
    if (archivo.size === 0) {
      return 'El archivo está vacío.';
    }
    return null;
  }

  private mensajeDeError(respuesta: {
    status: number;
    error?: { message?: string };
  }): string {
    if (respuesta.status === 0) {
      return 'No se pudo contactar al servidor. ¿Está corriendo el backend?';
    }
    if (respuesta.status === 413) {
      return `El archivo excede el máximo de ${MAX_MB} MB.`;
    }
    return respuesta.error?.message ?? 'No se pudo procesar el documento.';
  }
}
