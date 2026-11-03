import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Documento, ProgresoOcr, estaEnProceso } from '../models/documento.model';
import { DocumentosService } from './documentos.service';
import { NotificacionesService } from './notificaciones.service';

export type EtapaSubida = 'reposo' | 'enviando' | 'preparando' | 'listo' | 'error';

export const MAX_MB = 150;
const EXTENSIONES = ['.pdf', '.epub'];

/** La subida vive aquí y no en /subir: así sigue y se ve aunque el estudiante cambie de pantalla. */
@Injectable({ providedIn: 'root' })
export class SubidaEnCursoService {
  private readonly documentos = inject(DocumentosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  private readonly _etapa = signal<EtapaSubida>('reposo');
  private readonly _archivo = signal<File | null>(null);
  private readonly _porcentaje = signal(0);
  private readonly _progresoOcr = signal<ProgresoOcr | null>(null);
  private readonly _huboOcr = signal(false);
  private readonly _documento = signal<Documento | null>(null);
  private readonly _error = signal<string | null>(null);
  private suscripcion: Subscription | null = null;

  readonly etapa = this._etapa.asReadonly();
  readonly archivo = this._archivo.asReadonly();
  /** Avance de la transferencia del archivo. */
  readonly porcentaje = this._porcentaje.asReadonly();
  /** Avance del OCR mientras el servidor digitaliza; null fuera de esa etapa. */
  readonly progresoOcr = this._progresoOcr.asReadonly();
  /** El paso de OCR solo aparece si el libro lo necesitó. */
  readonly huboOcr = this._huboOcr.asReadonly();
  /** El libro creado: existe desde que el servidor recibió el archivo. */
  readonly documento = this._documento.asReadonly();
  readonly error = this._error.asReadonly();

  readonly activa = computed(() => this._etapa() === 'enviando' || this._etapa() === 'preparando');

  /** null cuando no hay un avance medible (el servidor prepara el libro sin OCR). */
  readonly avance = computed<number | null>(() => {
    if (this._etapa() === 'enviando') return this._porcentaje();
    const ocr = this._progresoOcr();
    if (this._etapa() === 'preparando' && ocr && ocr.total > 0) {
      return Math.round((ocr.procesadas / ocr.total) * 100);
    }
    return null;
  });

  constructor() {
    // Cerrar o recargar la pestaña corta la transferencia; después, el servidor sigue solo.
    const alCerrar = (evento: BeforeUnloadEvent) => {
      if (this._etapa() === 'enviando') evento.preventDefault();
    };
    window.addEventListener('beforeunload', alCerrar);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', alCerrar));
  }

  /** Devuelve el problema si el archivo no sirve; si sirve, empieza a subirlo. */
  iniciar(archivo: File): string | null {
    if (this.activa()) return 'Ya hay un libro subiéndose. Espera a que termine para subir otro.';

    this.limpiar();
    this._archivo.set(archivo);

    const problema = this.validar(archivo);
    if (problema) {
      this.fallar(problema);
      return problema;
    }

    this._etapa.set('enviando');
    this.suscripcion = this.documentos.subir(archivo).subscribe({
      next: (evento) => {
        this._porcentaje.set(evento.porcentaje);
        if (evento.tipo === 'listo' && evento.documento) this.alRecibir(evento.documento);
      },
      error: (respuesta: { status: number; error?: { message?: string } }) =>
        this.fallar(this.mensajeDeError(respuesta)),
    });
    return null;
  }

  /** Vuelve a reposo; corta lo que siga en curso (al cerrar sesión, por ejemplo). */
  limpiar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this._etapa.set('reposo');
    this._archivo.set(null);
    this._porcentaje.set(0);
    this._progresoOcr.set(null);
    this._huboOcr.set(false);
    this._documento.set(null);
    this._error.set(null);
  }

  private alRecibir(documento: Documento): void {
    this._documento.set(documento);
    if (!estaEnProceso(documento)) {
      this.terminar(documento);
      return;
    }

    this._etapa.set('preparando');
    this.suscripcion = this.documentos.seguirProcesamiento(documento.id).subscribe({
      next: (actual) => {
        const digitalizando = actual.processingStatus === 'ocr';
        this._progresoOcr.set(digitalizando ? actual.progresoOcr : null);
        if (digitalizando) this._huboOcr.set(true);
        if (estaEnProceso(actual)) return;

        if (actual.processingStatus === 'ready') this.terminar(actual);
        else this.fallar(actual.processingError ?? 'No se pudo procesar el documento. Intenta subirlo de nuevo.');
      },
      error: () =>
        this.fallar('Perdimos la conexión mientras se preparaba el libro. Revisa la biblioteca en un momento.'),
    });
  }

  private terminar(documento: Documento): void {
    this._documento.set(documento);
    this._progresoOcr.set(null);
    this._etapa.set('listo');
    // En /subir el estudiante ya ve el resultado; fuera de ahí no se enteraría.
    if (!this.router.url.startsWith('/subir')) {
      this.notificaciones.exito(`«${documento.title}» está listo para estudiar.`);
    }
  }

  private fallar(mensaje: string): void {
    this._error.set(mensaje);
    this._progresoOcr.set(null);
    this._etapa.set('error');
    if (!this.router.url.startsWith('/subir')) this.notificaciones.error(mensaje);
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

  private mensajeDeError(respuesta: { status: number; error?: { message?: string } }): string {
    if (respuesta.status === 0) {
      return 'No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.';
    }
    if (respuesta.status === 413) {
      return `El archivo excede el máximo de ${MAX_MB} MB.`;
    }
    return respuesta.error?.message ?? 'No se pudo procesar el documento. Intenta subirlo de nuevo.';
  }
}
