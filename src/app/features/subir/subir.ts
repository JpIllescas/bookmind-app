import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Documento } from '../../core/models/documento.model';
import { DocumentosService } from '../../core/services/documentos.service';
import { Icono } from '../../shared/icono/icono';

type Estado = 'reposo' | 'subiendo' | 'procesando' | 'listo' | 'error';
type EstadoPaso = 'pendiente' | 'activo' | 'completo';

const MAX_MB = 80;
const EXTENSIONES = ['.pdf', '.epub'];

@Component({
  selector: 'app-subir',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icono],
  templateUrl: './subir.html',
  styleUrl: './subir.scss',
})
export class Subir {
  private readonly documentos = inject(DocumentosService);
  private readonly router = inject(Router);

  readonly estado = signal<Estado>('reposo');
  readonly arrastrando = signal(false);
  readonly archivo = signal<File | null>(null);
  readonly porcentaje = signal(0);
  readonly error = signal<string | null>(null);
  readonly resultado = signal<Documento | null>(null);

  readonly maxMb = MAX_MB;

  readonly tamanoLegible = computed(() => {
    const bytes = this.archivo()?.size ?? 0;
    return bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  /**
   * Los pasos del servidor se encienden juntos: ocurren en la misma petición y
   * no reporta en cuál va. Fingir que son secuenciales sería inventar.
   */
  readonly pasos = computed<{ etiqueta: string; estado: EstadoPaso }[]>(() => {
    const estado = this.estado();
    const subiendo = estado === 'subiendo';
    const enServidor = estado === 'procesando';
    const terminado = estado === 'listo';

    const paso = (activo: boolean, completo: boolean): EstadoPaso =>
      completo ? 'completo' : activo ? 'activo' : 'pendiente';

    return [
      {
        etiqueta: 'Subiendo archivo',
        estado: paso(subiendo, enServidor || terminado),
      },
      {
        etiqueta: 'Extrayendo y normalizando texto',
        estado: paso(enServidor, terminado),
      },
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
          this.estado.set('listo');
        }
      },
      error: (respuesta: { status: number; error?: { message?: string } }) => {
        this.error.set(this.mensajeDeError(respuesta));
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
