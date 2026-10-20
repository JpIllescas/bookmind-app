import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { jsPDF } from 'jspdf';
import { Icono } from '../icono/icono';
import { Disposicion, disponerDiagrama } from './disposicion-diagrama';
import { limpiarDiagrama } from './limpiar-diagrama';

export type TipoDiagrama = 'mind_map' | 'concept_map' | 'flowchart';

export interface NodoDiagrama {
  id: string;
  label: string;
  type?: string;
  /** Página del libro que respalda el nodo, si el anclaje la encontró. */
  pagina?: number;
}

export interface ConexionDiagrama {
  source: string;
  target: string;
  label?: string;
}

export interface Diagrama {
  type: TipoDiagrama;
  title: string;
  nodes: NodoDiagrama[];
  edges: ConexionDiagrama[];
}

/** Bajo este ancho de lienzo el mapa va en árbol con sangría: a lo ancho quedaría ilegible. */
const ANCHO_PARA_AMPLIO = 640;
/** Más chico que esto el texto no se lee: el lienzo pasa a desplazarse en horizontal. */
const ESCALA_MINIMA = 0.72;

const PROPIEDADES_EXPORTADAS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-weight', 'font-family', 'opacity'];

let siguienteId = 0;

@Component({
  selector: 'app-diagrama',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono, NgTemplateOutlet],
  templateUrl: './diagrama.html',
  styleUrl: './diagrama.scss',
})
export class DiagramaComponent {
  readonly diagrama = input.required<Diagrama>();
  readonly descargasAbiertas = signal(false);
  readonly ampliado = signal(false);
  /** Los marcadores de flecha necesitan un id único por diagrama en la página. */
  readonly idFlecha = `flecha-diagrama-${siguienteId++}`;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly anchoLienzo = signal(0);

  /** Vale para los del Studio y para los del chat, también los ya guardados. */
  private readonly limpio = computed(() => limpiarDiagrama(this.diagrama()));

  readonly disposicion = computed<Disposicion>(() =>
    disponerDiagrama(this.limpio(), { modo: this.anchoLienzo() >= ANCHO_PARA_AMPLIO ? 'amplio' : 'compacto' }),
  );

  readonly disposicionAmpliada = computed<Disposicion>(() => disponerDiagrama(this.limpio(), { modo: 'amplio' }));

  readonly anchoMinimo = computed(() => Math.round(this.disposicion().ancho * ESCALA_MINIMA));

  readonly nombreTipo = computed(() => {
    const tipo = this.diagrama().type;
    return tipo === 'flowchart' ? 'Diagrama de flujo' : tipo === 'mind_map' ? 'Mapa mental' : 'Mapa conceptual';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const elemento = this.lienzo()?.nativeElement;
      if (!elemento || typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(([entrada]) => this.anchoLienzo.set(Math.round(entrada.contentRect.width)));
      observador.observe(elemento);
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  alternarDescargas(evento: Event): void {
    evento.stopPropagation();
    this.descargasAbiertas.update((abierta) => !abierta);
  }

  abrirAmpliado(evento: Event): void {
    evento.stopPropagation();
    this.descargasAbiertas.set(false);
    this.ampliado.set(true);
    this.dialogo()?.nativeElement.showModal?.();
  }

  /** Esc lo cierra el propio <dialog>; aquí llegan el botón y el clic fuera del marco. */
  cerrarAmpliado(): void {
    this.dialogo()?.nativeElement.close?.();
    this.ampliado.set(false);
  }

  async descargar(formato: 'png' | 'pdf' | 'svg', evento?: Event): Promise<void> {
    evento?.stopPropagation();
    this.descargasAbiertas.set(false);

    const svg = this.crearSvgExportable();
    if (!svg) return;

    if (formato === 'svg') {
      this.descargarBlob(new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
      return;
    }

    const png = await this.crearPng(svg);
    if (!png) return;

    if (formato === 'png') {
      this.descargarBlob(png, 'png');
      return;
    }

    const datos = await this.blobADataUrl(png);
    const { ancho, alto } = this.disposicion();
    const pdf = new jsPDF({ orientation: ancho >= alto ? 'landscape' : 'portrait', unit: 'pt', format: [ancho, alto] });
    pdf.addImage(datos, 'PNG', 0, 0, ancho, alto);
    pdf.save(this.nombreArchivo('pdf'));
  }

  /** Copia el SVG con los colores ya resueltos: fuera de la app no existen las variables CSS. */
  private crearSvgExportable(): SVGSVGElement | null {
    // Se exporta el del panel: el ampliado es la misma información a dos lados.
    const original = this.lienzo()?.nativeElement.querySelector<SVGSVGElement>('svg');
    if (!original) return null;

    const copia = original.cloneNode(true) as SVGSVGElement;
    const { ancho, alto } = this.disposicion();
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', String(ancho));
    copia.setAttribute('height', String(alto));
    copia.removeAttribute('style');

    const originales = original.querySelectorAll('*');
    copia.querySelectorAll('*').forEach((elemento, i) => {
      const estilo = getComputedStyle(originales[i]);
      const enLinea = PROPIEDADES_EXPORTADAS.map((propiedad) => `${propiedad}:${estilo.getPropertyValue(propiedad)}`).join(';');
      elemento.setAttribute('style', enLinea);
    });
    return copia;
  }

  private crearPng(svg: SVGSVGElement): Promise<Blob | null> {
    return new Promise((resolver) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const imagen = new Image();
      imagen.onload = () => {
        // Al doble de resolución para que el texto no salga borroso al imprimir.
        const escala = 2;
        const canvas = document.createElement('canvas');
        canvas.width = this.disposicion().ancho * escala;
        canvas.height = this.disposicion().alto * escala;
        const contexto = canvas.getContext('2d');
        if (!contexto) return resolver(null);
        contexto.fillStyle = getComputedStyle(this.host.nativeElement).getPropertyValue('--superficie').trim() || '#ffffff';
        contexto.fillRect(0, 0, canvas.width, canvas.height);
        contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(resolver, 'image/png');
      };
      imagen.onerror = () => resolver(null);
      imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    });
  }

  private blobADataUrl(blob: Blob): Promise<string> {
    return new Promise((resolver) => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result));
      lector.readAsDataURL(blob);
    });
  }

  private descargarBlob(blob: Blob, extension: string): void {
    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);
    enlace.href = url;
    enlace.download = this.nombreArchivo(extension);
    enlace.click();
    URL.revokeObjectURL(url);
  }

  private nombreArchivo(extension: string): string {
    const base = this.diagrama().title.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'mapa';
    return `${base}.${extension}`;
  }
}
