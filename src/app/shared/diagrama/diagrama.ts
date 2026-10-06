import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { jsPDF } from 'jspdf';
import { Icono } from '../icono/icono';

export type TipoDiagrama = 'mind_map' | 'concept_map' | 'flowchart';

export interface NodoDiagrama {
  id: string;
  label: string;
  type?: 'root' | 'concept' | 'decision' | 'process' | 'start' | 'end';
  position?: { x: number; y: number };
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

interface NodoRenderizado extends NodoDiagrama {
  x: number;
  y: number;
}

const ANCHO = 220;
const ALTO = 64;
const SEPARACION_X = 250;
const SEPARACION_Y = 110;

@Component({
  selector: 'app-diagrama',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  templateUrl: './diagrama.html',
  styleUrl: './diagrama.scss',
})
export class DiagramaComponent {
  readonly diagrama = input.required<Diagrama>();
  readonly descargasAbiertas = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  readonly nodos = computed<NodoRenderizado[]>(() => {
    const diagrama = this.diagrama();
    const posiciones = new Map<string, { x: number; y: number }>();
    const niveles = this.calcularNiveles(diagrama);
    const usados = new Map<number, number>();

    for (const nodo of diagrama.nodes) {
      if (nodo.position) {
        posiciones.set(nodo.id, nodo.position);
        continue;
      }

      const nivel = niveles.get(nodo.id) ?? 0;
      const indice = usados.get(nivel) ?? 0;
      usados.set(nivel, indice + 1);
      posiciones.set(nodo.id, {
        x: 24 + indice * SEPARACION_X,
        y: 24 + nivel * SEPARACION_Y,
      });
    }

    return diagrama.nodes.map((nodo) => ({
      ...nodo,
      x: posiciones.get(nodo.id)?.x ?? 24,
      y: posiciones.get(nodo.id)?.y ?? 24,
    }));
  });

  readonly ancho = computed(() => {
    const nodos = this.nodos();
    return Math.max(520, ...nodos.map((nodo) => nodo.x + ANCHO + 24));
  });

  readonly alto = computed(() => {
    const nodos = this.nodos();
    return Math.max(180, ...nodos.map((nodo) => nodo.y + ALTO + 24));
  });

  readonly mapaNodos = computed(
    () => new Map(this.nodos().map((nodo) => [nodo.id, nodo])),
  );

  claseNodo(nodo: NodoRenderizado): string {
    return `nodo nodo--${nodo.type ?? 'concept'}`;
  }

  alternarDescargas(evento: Event): void {
    evento.stopPropagation();
    this.descargasAbiertas.update((abierta) => !abierta);
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
    const ancho = Number(svg.getAttribute('width')) || this.ancho();
    const alto = Number(svg.getAttribute('height')) || this.alto();
    const pdf = new jsPDF({
      orientation: ancho >= alto ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [ancho, alto],
    });
    pdf.addImage(datos, 'PNG', 0, 0, ancho, alto);
    pdf.save(this.nombreArchivo('pdf'));
  }

  private crearSvgExportable(): SVGSVGElement | null {
    const original = this.svg()?.nativeElement;
    if (!original) return null;

    const copia = original.cloneNode(true) as SVGSVGElement;
    const ancho = this.ancho();
    const alto = this.alto();
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', String(ancho));
    copia.setAttribute('height', String(alto));
    copia.style.minWidth = '0';
    copia.style.minHeight = '0';

    const estilos = getComputedStyle(this.host.nativeElement);
    const color = (variable: string, fallback: string) => estilos.getPropertyValue(variable).trim() || fallback;
    const fondo = color('--superficie', '#ffffff');
    const texto = color('--texto', '#1e293b');
    const secundario = color('--texto-terciario', '#64748b');
    const acento = color('--acento', '#6366f1');
    const acentoBorde = color('--acento-borde', '#a5b4fc');
    const acentoTinte = color('--acento-tinte', '#e0e7ff');
    const acentoSuave = color('--acento-tinte-suave', '#eef2ff');
    const estilosSvg = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    estilosSvg.textContent = `
      svg { background: ${fondo}; }
      .conexion { stroke: ${acentoBorde}; stroke-width: 2; }
      .conexion__texto { fill: ${secundario}; font-size: 12px; }
      marker path { fill: ${acento}; }
      .nodo rect { fill: ${acentoSuave}; stroke: ${acentoBorde}; stroke-width: 1.5; }
      .nodo text { fill: ${texto}; font-size: 14px; font-weight: 600; }
      .nodo--root rect { fill: ${acentoTinte}; stroke: ${acento}; }
    `;
    copia.prepend(estilosSvg);
    return copia;
  }

  private crearPng(svg: SVGSVGElement): Promise<Blob | null> {
    return new Promise((resolver) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const imagen = new Image();
      imagen.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Number(svg.getAttribute('width')) || this.ancho();
        canvas.height = Number(svg.getAttribute('height')) || this.alto();
        const contexto = canvas.getContext('2d');
        if (!contexto) return resolver(null);
        contexto.fillStyle = getComputedStyle(this.host.nativeElement).getPropertyValue('--superficie').trim() || '#ffffff';
        contexto.fillRect(0, 0, canvas.width, canvas.height);
        contexto.drawImage(imagen, 0, 0);
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

  private calcularNiveles(diagrama: Diagrama): Map<string, number> {
    const niveles = new Map<string, number>();
    const conEntrada = new Set(diagrama.edges.map((edge) => edge.target));
    const raices = diagrama.nodes.filter((nodo) => nodo.type === 'root' || !conEntrada.has(nodo.id));
    const cola = [...(raices.length > 0 ? raices : diagrama.nodes.slice(0, 1))];

    cola.forEach((nodo) => niveles.set(nodo.id, 0));
    while (cola.length > 0) {
      const nodo = cola.shift()!;
      const nivel = niveles.get(nodo.id) ?? 0;
      for (const edge of diagrama.edges.filter((item) => item.source === nodo.id)) {
        if (!niveles.has(edge.target)) {
          niveles.set(edge.target, nivel + 1);
          const destino = diagrama.nodes.find((item) => item.id === edge.target);
          if (destino) cola.push(destino);
        }
      }
    }

    return niveles;
  }
}
