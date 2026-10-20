import { describe, expect, it } from 'vitest';

import type { Diagrama } from './diagrama';
import {
  ANCHO_CARACTER,
  CARACTERES_POR_LINEA,
  MAXIMO_LINEAS,
  NodoDispuesto,
  disponerDiagrama,
  partirEtiqueta,
} from './disposicion-diagrama';

/** El mapa mental real que guardó Gemini para Medio social 2.º (etiquetas de hasta 41 caracteres). */
const MAPA_REAL: Diagrama = {
  type: 'mind_map',
  title: 'Plan de Estudio Aplicado: Medio Social y Natural',
  nodes: [
    { id: 'n1', type: 'root', label: 'Plan de Estudio: Medio Social y Natural' },
    { id: 'n2', type: 'topic', label: 'Sesión 1: Sistema Locomotor (30 min)' },
    { id: 'n3', type: 'subtopic', label: 'Ejercicio: Flexión de mano por 2 min' },
    { id: 'n4', type: 'topic', label: 'Sesión 2: Seres Vivos y Entorno (35 min)' },
    { id: 'n5', type: 'subtopic', label: 'Taller: Experimento de descomposición' },
    { id: 'n6', type: 'topic', label: 'Sesión 3: Recursos y Materia (40 min)' },
    { id: 'n7', type: 'subtopic', label: 'Ejercicio: Frotación de rocas para arena' },
    { id: 'n8', type: 'topic', label: 'Sesión 4: Convivencia y Cultura (30 min)' },
    { id: 'n9', type: 'subtopic', label: 'Aplicación: Diálogo y taller de alfombras' },
  ],
  edges: [
    { source: 'n1', target: 'n2', label: 'inicia con' },
    { source: 'n2', target: 'n3' },
    { source: 'n1', target: 'n4' },
    { source: 'n4', target: 'n5' },
    { source: 'n1', target: 'n6' },
    { source: 'n6', target: 'n7' },
    { source: 'n1', target: 'n8' },
    { source: 'n8', target: 'n9' },
  ],
};

const CONCEPTUAL: Diagrama = {
  type: 'concept_map',
  title: 'Seres vivos',
  nodes: [
    { id: 'a', type: 'root', label: 'Seres vivos' },
    { id: 'b', label: 'Animales' },
    { id: 'c', label: 'Plantas' },
    { id: 'd', label: 'Fotosíntesis' },
  ],
  edges: [
    { source: 'a', target: 'b', label: 'se dividen en' },
    { source: 'a', target: 'c', label: 'se dividen en' },
    { source: 'c', target: 'd', label: 'realizan' },
    { source: 'b', target: 'c', label: 'se alimentan de' },
  ],
};

function seSolapan(a: NodoDispuesto, b: NodoDispuesto): boolean {
  return a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
}

describe('partirEtiqueta', () => {
  it('parte por palabras sin pasar del largo de línea', () => {
    const lineas = partirEtiqueta('Sesión 2: Seres Vivos y Entorno (35 min)');
    expect(lineas.length).toBeGreaterThan(1);
    expect(lineas.every((linea) => linea.length <= CARACTERES_POR_LINEA)).toBe(true);
    expect(lineas.join(' ')).toBe('Sesión 2: Seres Vivos y Entorno (35 min)');
  });

  it('recorta con "…" lo que no cabe en tres líneas y corta una palabra gigante', () => {
    const lineas = partirEtiqueta('uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince');
    expect(lineas).toHaveLength(MAXIMO_LINEAS);
    expect(lineas[MAXIMO_LINEAS - 1].endsWith('…')).toBe(true);
    expect(partirEtiqueta('Electroencefalografistamente')[0]).toHaveLength(CARACTERES_POR_LINEA);
  });
});

describe('disponerDiagrama', () => {
  for (const modo of ['compacto', 'amplio'] as const) {
    it(`el mapa real no encima cajas y el texto cabe en ellas (${modo})`, () => {
      const { nodos, ancho, alto } = disponerDiagrama(MAPA_REAL, { modo });

      for (let i = 0; i < nodos.length; i++) {
        for (let j = i + 1; j < nodos.length; j++) expect(seSolapan(nodos[i], nodos[j])).toBe(false);
      }
      for (const nodo of nodos) {
        const masLarga = Math.max(...nodo.lineas.map((linea) => linea.length));
        expect(masLarga * ANCHO_CARACTER).toBeLessThanOrEqual(nodo.ancho);
        expect(nodo.x).toBeGreaterThanOrEqual(0);
        expect(nodo.x + nodo.ancho).toBeLessThanOrEqual(ancho);
        expect(nodo.y + nodo.alto).toBeLessThanOrEqual(alto);
      }
    });
  }

  it('en compacto cabe a tamaño real en el panel del Studio (el dibujo anterior medía 1.018 px)', () => {
    expect(disponerDiagrama(MAPA_REAL, { modo: 'compacto' }).ancho).toBeLessThanOrEqual(300);
    expect(disponerDiagrama(CONCEPTUAL, { modo: 'compacto' }).ancho).toBeLessThanOrEqual(300);
  });

  it('en compacto cada hijo va debajo de su padre y más adentro, con el rótulo encima', () => {
    const { nodos, conexiones } = disponerDiagrama(CONCEPTUAL, { modo: 'compacto' });
    const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
    const plantas = porId.get('c')!;
    const fotosintesis = porId.get('d')!;

    expect(fotosintesis.y).toBeGreaterThan(plantas.y + plantas.alto);
    expect(fotosintesis.x).toBeGreaterThan(plantas.x);
    const rotulo = conexiones.find((c) => c.id === 'c>d')!.etiqueta!;
    expect(rotulo.y).toBeGreaterThan(plantas.y + plantas.alto);
    expect(rotulo.y).toBeLessThan(fotosintesis.y);
  });

  it('a dos lados reparte las ideas a izquierda y derecha de la raíz', () => {
    const { nodos } = disponerDiagrama(MAPA_REAL, { modo: 'amplio' });
    const raiz = nodos.find((nodo) => nodo.profundidad === 0)!;
    const ideas = nodos.filter((nodo) => nodo.profundidad === 1);

    expect(ideas.filter((idea) => idea.x > raiz.x)).toHaveLength(2);
    expect(ideas.filter((idea) => idea.x < raiz.x)).toHaveLength(2);
  });

  it('cada detalle queda del mismo lado y de la misma rama que su idea', () => {
    const { nodos } = disponerDiagrama(MAPA_REAL, { modo: 'amplio' });
    const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
    const raiz = porId.get('n1')!;

    for (const [idea, detalle] of [['n2', 'n3'], ['n4', 'n5'], ['n6', 'n7'], ['n8', 'n9']]) {
      const a = porId.get(idea)!;
      const b = porId.get(detalle)!;
      expect(b.rama).toBe(a.rama);
      expect(Math.sign(b.x - raiz.x)).toBe(Math.sign(a.x - raiz.x));
      expect(Math.abs(b.x - raiz.x)).toBeGreaterThan(Math.abs(a.x - raiz.x));
    }
  });

  it('el mapa mental no lleva flechas ni rótulos; el conceptual sí', () => {
    expect(disponerDiagrama(MAPA_REAL).conexiones.every((c) => !c.flecha && !c.etiqueta)).toBe(true);

    const conceptual = disponerDiagrama(CONCEPTUAL);
    expect(conceptual.conexiones.every((c) => c.flecha && c.etiqueta)).toBe(true);
  });

  for (const modo of ['compacto', 'amplio'] as const) {
    it(`una relación que no sigue el árbol va escrita al pie, no como línea que cruza el mapa (${modo})`, () => {
      const { conexiones, notas, alto, nodos } = disponerDiagrama(CONCEPTUAL, { modo });

      expect(conexiones.some((c) => c.id === 'b>c')).toBe(false);
      expect(notas).toEqual([expect.objectContaining({ origen: 'Animales', relacion: 'se alimentan de', destino: 'Plantas' })]);
      const fondoDelMapa = Math.max(...nodos.map((n) => n.y + n.alto));
      expect(notas[0].y).toBeGreaterThan(fondoDelMapa);
      expect(notas[0].y).toBeLessThan(alto);
    });
  }

  it('en amplio cada rótulo queda junto a su destino, a la altura de la caja y antes de ella', () => {
    // Caso real: El principito con 8 personajes colgando de la raíz.
    const personajes = ['El Aviador', 'El Rey', 'El Vanidoso', 'El Hombre de Negocios', 'El Farolero', 'El Geógrafo', 'La Serpiente', 'El Zorro'];
    const verbos = ['se encuentra con', 'visita a', 'conoce a', 'observa a', 'admira a', 'interroga a', 'habla con', 'domestica a'];
    const mapa: Diagrama = {
      type: 'concept_map',
      title: 'Personajes',
      nodes: [{ id: 'p', label: 'El Principito', type: 'root' }, ...personajes.map((label, i) => ({ id: `n${i}`, label }))],
      edges: personajes.map((_, i) => ({ source: 'p', target: `n${i}`, label: verbos[i] })),
    };
    const { nodos, conexiones } = disponerDiagrama(mapa, { modo: 'amplio' });
    const porId = new Map(nodos.map((n) => [n.id, n]));

    for (const conexion of conexiones) {
      const destino = porId.get(conexion.id.split('>')[1])!;
      const rotulo = conexion.etiqueta!;
      expect(rotulo.y).toBeCloseTo(destino.y + destino.alto / 2, 0);
      expect(rotulo.x + rotulo.ancho / 2).toBeLessThan(destino.x);
      expect(destino.x - (rotulo.x + rotulo.ancho / 2)).toBeLessThanOrEqual(24);
    }
    // Ningún par de rótulos se pisa.
    const rotulos = conexiones.map((c) => c.etiqueta!);
    for (let i = 0; i < rotulos.length; i++) {
      for (let j = i + 1; j < rotulos.length; j++) expect(Math.abs(rotulos[i].y - rotulos[j].y)).toBeGreaterThanOrEqual(18);
    }
  });

  it('un nodo sin conexión cuelga de la raíz en vez de quedar suelto', () => {
    const suelto: Diagrama = { ...CONCEPTUAL, nodes: [...CONCEPTUAL.nodes, { id: 'e', label: 'Hongos' }] };
    const { conexiones } = disponerDiagrama(suelto);
    expect(conexiones.some((c) => c.id === 'a>e')).toBe(true);
  });

  it('la página del nodo agranda la caja para mostrarla', () => {
    const sinPagina = disponerDiagrama(CONCEPTUAL).nodos.find((n) => n.id === 'b')!;
    const conPagina = disponerDiagrama({
      ...CONCEPTUAL,
      nodes: CONCEPTUAL.nodes.map((n) => (n.id === 'b' ? { ...n, pagina: 12 } : n)),
    }).nodos.find((n) => n.id === 'b')!;

    expect(conPagina.pagina).toBe(12);
    expect(conPagina.alto).toBeGreaterThan(sinPagina.alto);
  });
});
