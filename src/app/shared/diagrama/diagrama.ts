import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
  templateUrl: './diagrama.html',
  styleUrl: './diagrama.scss',
})
export class DiagramaComponent {
  readonly diagrama = input.required<Diagrama>();

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
