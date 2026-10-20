import type { Diagrama, NodoDiagrama } from './diagrama';

/** Caja de un nodo ya colocada, con su texto partido en líneas. */
export interface NodoDispuesto {
  id: string;
  lineas: string[];
  pagina?: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  profundidad: number;
  /** Índice de la idea principal de la que cuelga; colorea toda la rama. */
  rama: number;
}

export interface EtiquetaDispuesta {
  texto: string;
  x: number;
  y: number;
  ancho: number;
}

export interface ConexionDispuesta {
  id: string;
  d: string;
  rama: number;
  flecha: boolean;
  etiqueta?: EtiquetaDispuesta;
}

/** Relación que no sigue el árbol: dibujada como línea cruzaría el mapa, así que va escrita al pie. */
export interface NotaDispuesta {
  origen: string;
  relacion?: string;
  destino: string;
  x: number;
  y: number;
}

export interface Disposicion {
  nodos: NodoDispuesto[];
  conexiones: ConexionDispuesta[];
  /** Encabezado y renglones de "Otras relaciones"; vacío si todas siguen el árbol. */
  notas: NotaDispuesta[];
  tituloNotas?: { x: number; y: number };
  ancho: number;
  alto: number;
}

export const CARACTERES_POR_LINEA = 20;
export const MAXIMO_LINEAS = 3;
export const ANCHO_CARACTER = 7.4;
export const ALTO_LINEA = 17;
const ALTO_PAGINA = 14;
const RELLENO_X = 14;
const RELLENO_Y = 10;
const ANCHO_MINIMO = 76;
const ESCALA_RAIZ = 1.12;
const SEPARACION_Y = 14;
const SEPARACION_X_MENTAL = 48;
const SEPARACION_X_MINIMA = 56;
const SEPARACION_X_MAXIMA = 230;
/** Hueco entre el rótulo y la caja a la que apunta: ahí va la punta de la flecha. */
const TRAMO_FLECHA = 20;
const ALTO_NOTA = 20;
const ANCHO_CARACTER_NOTA = 6.6;
const CARACTERES_ETIQUETA = 22;
const ANCHO_CARACTER_ETIQUETA = 6.2;
const MARGEN = 16;
const SANGRIA = 26;
const SEPARACION_FILAS = 10;
const ALTO_ROTULO = 20;
const RADIO_CODO = 8;
export const RAMAS = 6;

/** Parte una etiqueta en líneas cortas por palabras; lo que no cabe termina en "…". */
export function partirEtiqueta(texto: string, maximo = CARACTERES_POR_LINEA, lineas = MAXIMO_LINEAS): string[] {
  const palabras = texto.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const resultado: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    // Una palabra más larga que la línea se corta para que no se salga de la caja.
    const pieza = palabra.length > maximo ? `${palabra.slice(0, maximo - 1)}…` : palabra;
    if (!actual) actual = pieza;
    else if (actual.length + 1 + pieza.length <= maximo) actual += ` ${pieza}`;
    else {
      resultado.push(actual);
      actual = pieza;
    }
  }
  if (actual) resultado.push(actual);

  if (resultado.length <= lineas) return resultado.length ? resultado : [''];

  const visibles = resultado.slice(0, lineas);
  const ultima = visibles[lineas - 1];
  visibles[lineas - 1] = ultima.length >= maximo ? `${ultima.slice(0, maximo - 1)}…` : `${ultima}…`;
  return visibles;
}

interface Caja {
  nodo: NodoDiagrama;
  lineas: string[];
  ancho: number;
  alto: number;
  hijos: Caja[];
  profundidad: number;
  rama: number;
  bloque: number;
  x: number;
  cy: number;
  lado: 1 | -1;
}

function medir(nodo: NodoDiagrama, esRaiz: boolean): Pick<Caja, 'lineas' | 'ancho' | 'alto'> {
  const lineas = partirEtiqueta(nodo.label);
  const escala = esRaiz ? ESCALA_RAIZ : 1;
  const largo = Math.max(...lineas.map((linea) => linea.length), nodo.pagina ? 7 : 0);
  return {
    lineas,
    ancho: Math.max(ANCHO_MINIMO, Math.round(largo * ANCHO_CARACTER * escala + RELLENO_X * 2)),
    alto: Math.round(lineas.length * ALTO_LINEA * escala + RELLENO_Y * 2 + (nodo.pagina ? ALTO_PAGINA : 0)),
  };
}

/** Árbol desde la raíz; lo que quedó suelto cuelga de la raíz para que nada flote. */
function armarArbol(diagrama: Diagrama): { raiz: Caja; cruzadas: Diagrama['edges'] } {
  const nodos = diagrama.nodes;
  const conEntrada = new Set(diagrama.edges.map((conexion) => conexion.target));
  const nodoRaiz = nodos.find((nodo) => nodo.type === 'root') ?? nodos.find((nodo) => !conEntrada.has(nodo.id)) ?? nodos[0];

  const cajas = new Map<string, Caja>();
  for (const nodo of nodos) {
    cajas.set(nodo.id, {
      nodo, ...medir(nodo, nodo === nodoRaiz), hijos: [], profundidad: 0, rama: 0, bloque: 0, x: 0, cy: 0, lado: 1,
    });
  }

  const raiz = cajas.get(nodoRaiz.id)!;
  const visitados = new Set([raiz.nodo.id]);
  const enArbol = new Set<string>();
  const cola = [raiz];

  while (cola.length > 0) {
    const caja = cola.shift()!;
    for (const conexion of diagrama.edges) {
      if (conexion.source !== caja.nodo.id || visitados.has(conexion.target)) continue;
      const hijo = cajas.get(conexion.target);
      if (!hijo) continue;
      visitados.add(hijo.nodo.id);
      enArbol.add(`${conexion.source}>${conexion.target}`);
      caja.hijos.push(hijo);
      cola.push(hijo);
    }
  }

  for (const caja of cajas.values()) {
    if (!visitados.has(caja.nodo.id)) raiz.hijos.push(caja);
  }

  const cruzadas = diagrama.edges.filter(
    (conexion) => !enArbol.has(`${conexion.source}>${conexion.target}`) && cajas.has(conexion.source) && cajas.has(conexion.target),
  );

  return { raiz, cruzadas };
}

function marcar(caja: Caja, profundidad: number, rama: number): void {
  caja.profundidad = profundidad;
  caja.rama = rama;
  caja.hijos.forEach((hijo, i) => marcar(hijo, profundidad + 1, profundidad === 0 ? i % RAMAS : rama));
}

function calcularBloque(caja: Caja): number {
  const hijos = caja.hijos.reduce((suma, hijo) => suma + calcularBloque(hijo), 0) + SEPARACION_Y * Math.max(0, caja.hijos.length - 1);
  caja.bloque = Math.max(caja.alto, hijos);
  return caja.bloque;
}

/** Apila los hijos de cada nodo en vertical y centra al padre frente a ellos. */
function apilar(caja: Caja, arriba: number): void {
  caja.cy = arriba + caja.bloque / 2;
  const total = caja.hijos.reduce((suma, hijo) => suma + hijo.bloque, 0) + SEPARACION_Y * Math.max(0, caja.hijos.length - 1);
  let y = caja.cy - total / 2;
  for (const hijo of caja.hijos) {
    apilar(hijo, y);
    y += hijo.bloque + SEPARACION_Y;
  }
}

function descendientes(caja: Caja): Caja[] {
  return caja.hijos.flatMap((hijo) => [hijo, ...descendientes(hijo)]);
}

/** Columnas por profundidad: cada una tan ancha como su caja más ancha. */
function colocarColumnas(raiz: Caja, ramas: Caja[], lado: 1 | -1, separacion: number): void {
  const anchoPorNivel = new Map<number, number>();
  const todas = ramas.flatMap((rama) => [rama, ...descendientes(rama)]);
  for (const caja of todas) {
    anchoPorNivel.set(caja.profundidad, Math.max(anchoPorNivel.get(caja.profundidad) ?? 0, caja.ancho));
  }

  const borde = new Map<number, number>([[1, raiz.ancho / 2 + separacion]]);
  for (let nivel = 2; anchoPorNivel.has(nivel); nivel++) {
    borde.set(nivel, borde.get(nivel - 1)! + anchoPorNivel.get(nivel - 1)! + separacion);
  }

  for (const caja of todas) {
    caja.lado = lado;
    const inicio = borde.get(caja.profundidad)!;
    caja.x = lado === 1 ? inicio : -inicio - caja.ancho;
  }
}

function apilarLado(raiz: Caja, ramas: Caja[]): void {
  const total = ramas.reduce((suma, rama) => suma + rama.bloque, 0) + SEPARACION_Y * Math.max(0, ramas.length - 1);
  let y = -total / 2;
  for (const rama of ramas) {
    apilar(rama, y);
    y += rama.bloque + SEPARACION_Y;
  }
}

/** Reparte las ramas a izquierda y derecha para que los dos lados pesen parecido. */
function repartir(ramas: Caja[]): [Caja[], Caja[]] {
  const derecha: Caja[] = [];
  const izquierda: Caja[] = [];
  let pesoDerecha = 0;
  let pesoIzquierda = 0;
  for (const rama of ramas) {
    if (pesoDerecha <= pesoIzquierda) {
      derecha.push(rama);
      pesoDerecha += rama.bloque;
    } else {
      izquierda.push(rama);
      pesoIzquierda += rama.bloque;
    }
  }
  return [derecha, izquierda];
}

function bordeDe(caja: Caja, hacia: 1 | -1): number {
  return hacia === 1 ? caja.x + caja.ancho : caja.x;
}

function curva(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) / 2;
  return `M ${r(x1)} ${r(y1)} C ${r(x1 + dx)} ${r(y1)}, ${r(x2 - dx)} ${r(y2)}, ${r(x2)} ${r(y2)}`;
}

function r(valor: number): number {
  return Math.round(valor * 10) / 10;
}

function etiquetaDe(texto: string | undefined, x: number, y: number): EtiquetaDispuesta | undefined {
  const limpio = texto?.replace(/\s+/g, ' ').trim();
  if (!limpio) return undefined;
  const corto = limpio.length > CARACTERES_ETIQUETA ? `${limpio.slice(0, CARACTERES_ETIQUETA - 1).trimEnd()}…` : limpio;
  return { texto: corto, x, y, ancho: Math.round(corto.length * ANCHO_CARACTER_ETIQUETA + 12) };
}

/** Compacto: árbol con sangría de arriba abajo, para paneles angostos. Amplio: a lo ancho. */
export type ModoDisposicion = 'compacto' | 'amplio';

/**
 * Coloca un diagrama sin solapes. En modo amplio el mapa mental sale del centro
 * a los dos lados y el conceptual va de izquierda a derecha con flechas.
 */
export function disponerDiagrama(diagrama: Diagrama, opciones: { modo?: ModoDisposicion } = {}): Disposicion {
  if (diagrama.nodes.length === 0) return { nodos: [], conexiones: [], notas: [], ancho: 0, alto: 0 };

  const mental = diagrama.type === 'mind_map';
  const { raiz, cruzadas } = armarArbol(diagrama);
  marcar(raiz, 0, 0);
  if (opciones.modo === 'compacto') return conNotas(disponerCompacto(diagrama, raiz, mental), diagrama, cruzadas);
  raiz.hijos.forEach(calcularBloque);
  raiz.x = -raiz.ancho / 2;
  raiz.cy = 0;

  const conEtiquetas = !mental && diagrama.edges.some((conexion) => conexion.label?.trim());
  const masLarga = Math.max(0, ...diagrama.edges.map((conexion) => etiquetaDe(conexion.label, 0, 0)?.ancho ?? 0));
  const separacion = mental || !conEtiquetas
    ? SEPARACION_X_MENTAL
    // La curva llega al rótulo y un tramo recto con la flecha sigue hasta la caja: el hueco tiene que dar para los dos.
    : Math.min(SEPARACION_X_MAXIMA, Math.max(SEPARACION_X_MINIMA, masLarga + TRAMO_FLECHA + 44));

  const [derecha, izquierda] = mental && raiz.hijos.length > 1
    ? repartir(raiz.hijos)
    : [raiz.hijos, []];
  colocarColumnas(raiz, derecha, 1, separacion);
  colocarColumnas(raiz, izquierda, -1, separacion);
  apilarLado(raiz, derecha);
  apilarLado(raiz, izquierda);

  const cajas = [raiz, ...descendientes(raiz)];
  const etiquetaDeArista = new Map(diagrama.edges.map((conexion) => [`${conexion.source}>${conexion.target}`, conexion.label]));

  const conexiones: ConexionDispuesta[] = [];
  for (const padre of cajas) {
    for (const hijo of padre.hijos) {
      const x1 = bordeDe(padre, hijo.lado);
      const x2 = bordeDe(hijo, (hijo.lado * -1) as 1 | -1);
      const rotulo = mental ? undefined : etiquetaDe(etiquetaDeArista.get(`${padre.nodo.id}>${hijo.nodo.id}`), 0, 0);
      // Con rótulo, la relación se lee de corrido junto a su destino: "padre —relación→ hijo".
      const finRotulo = x2 - TRAMO_FLECHA * hijo.lado;
      const inicioRotulo = rotulo ? finRotulo - rotulo.ancho * hijo.lado : x2;
      conexiones.push({
        id: `${padre.nodo.id}>${hijo.nodo.id}`,
        d: rotulo
          ? `${curva(x1, padre.cy, inicioRotulo, hijo.cy)} M ${r(finRotulo)} ${r(hijo.cy)} L ${r(x2)} ${r(hijo.cy)}`
          : curva(x1, padre.cy, x2, hijo.cy),
        rama: hijo.rama,
        flecha: !mental,
        etiqueta: rotulo && { ...rotulo, x: (inicioRotulo + finRotulo) / 2, y: hijo.cy },
      });
    }
  }

  // Todo a coordenadas positivas con un margen alrededor.
  const izquierdaMin = Math.min(...cajas.map((caja) => caja.x));
  const derechaMax = Math.max(...cajas.map((caja) => caja.x + caja.ancho));
  const arribaMin = Math.min(...cajas.map((caja) => caja.cy - caja.alto / 2));
  const abajoMax = Math.max(...cajas.map((caja) => caja.cy + caja.alto / 2));
  const dx = MARGEN - izquierdaMin;
  const dy = MARGEN - arribaMin;

  const nodos = cajas.map((caja) => ({
    id: caja.nodo.id,
    lineas: caja.lineas,
    pagina: caja.nodo.pagina,
    x: r(caja.x + dx),
    y: r(caja.cy - caja.alto / 2 + dy),
    ancho: caja.ancho,
    alto: caja.alto,
    profundidad: caja.profundidad,
    rama: caja.rama,
  }));

  return conNotas({
    nodos,
    conexiones: conexiones.map((conexion) => ({
      ...conexion,
      d: desplazar(conexion.d, dx, dy),
      etiqueta: conexion.etiqueta && { ...conexion.etiqueta, x: r(conexion.etiqueta.x + dx), y: r(conexion.etiqueta.y + dy) },
    })),
    notas: [],
    ancho: Math.ceil(derechaMax - izquierdaMin + MARGEN * 2),
    alto: Math.ceil(abajoMax - arribaMin + MARGEN * 2),
  }, diagrama, cruzadas);
}

/** Agrega al pie las relaciones que no siguen el árbol, como renglones "origen — relación → destino". */
function conNotas(base: Disposicion, diagrama: Diagrama, cruzadas: Diagrama['edges']): Disposicion {
  if (cruzadas.length === 0) return base;

  const nombre = new Map(diagrama.nodes.map((nodo) => [nodo.id, nodo.label.replace(/\s+/g, ' ').trim()]));
  const arriba = base.alto + 4;
  const notas = cruzadas.map((conexion, i) => ({
    origen: nombre.get(conexion.source) ?? '',
    relacion: conexion.label?.trim() || undefined,
    destino: nombre.get(conexion.target) ?? '',
    x: MARGEN,
    y: arriba + ALTO_NOTA * (i + 1) + 4,
  }));
  const masLarga = Math.max(...notas.map((nota) => `${nota.origen} — ${nota.relacion ?? ''} → ${nota.destino}`.length));

  return {
    ...base,
    notas,
    tituloNotas: { x: MARGEN, y: arriba + 4 },
    ancho: Math.max(base.ancho, Math.ceil(MARGEN * 2 + masLarga * ANCHO_CARACTER_NOTA)),
    alto: Math.ceil(arriba + ALTO_NOTA * (notas.length + 1) + MARGEN / 2),
  };
}

/** Cada nodo en su fila, más adentro cuanto más profundo. */
function disponerCompacto(diagrama: Diagrama, raiz: Caja, mental: boolean): Disposicion {
  const etiquetaDeArista = new Map(diagrama.edges.map((conexion) => [`${conexion.source}>${conexion.target}`, conexion.label]));
  const nodos: NodoDispuesto[] = [];
  const conexiones: ConexionDispuesta[] = [];
  let y = MARGEN;

  const visitar = (caja: Caja, padre: NodoDispuesto | null) => {
    const x = MARGEN + caja.profundidad * SANGRIA;
    const rotulo = padre && !mental ? etiquetaDeArista.get(`${padre.id}>${caja.nodo.id}`)?.trim() : undefined;
    if (rotulo) y += ALTO_ROTULO;

    const nodo: NodoDispuesto = {
      id: caja.nodo.id, lineas: caja.lineas, pagina: caja.nodo.pagina,
      x, y, ancho: caja.ancho, alto: caja.alto, profundidad: caja.profundidad, rama: caja.rama,
    };
    nodos.push(nodo);

    if (padre) {
      const px = padre.x + SANGRIA / 2;
      const medio = y + caja.alto / 2;
      const etiqueta = etiquetaDe(rotulo, 0, 0);
      conexiones.push({
        id: `${padre.id}>${nodo.id}`,
        d: `M ${px} ${padre.y + padre.alto} V ${medio - RADIO_CODO} Q ${px} ${medio} ${px + RADIO_CODO} ${medio} H ${x}`,
        rama: caja.rama,
        flecha: !mental,
        etiqueta: etiqueta && { ...etiqueta, x: x + etiqueta.ancho / 2, y: y - ALTO_ROTULO / 2 - 1 },
      });
    }

    y += caja.alto + SEPARACION_FILAS;
    caja.hijos.forEach((hijo) => visitar(hijo, nodo));
  };
  visitar(raiz, null);

  const derecha = Math.max(
    ...nodos.map((nodo) => nodo.x + nodo.ancho),
    ...conexiones.map((conexion) => (conexion.etiqueta ? conexion.etiqueta.x + conexion.etiqueta.ancho / 2 : 0)),
  );
  return { nodos, conexiones, notas: [], ancho: Math.ceil(derecha + MARGEN), alto: Math.ceil(y - SEPARACION_FILAS + MARGEN) };
}

function desplazar(d: string, dx: number, dy: number): string {
  let esX = true;
  return d.replace(/-?\d+(\.\d+)?/g, (numero) => {
    const valor = Number(numero) + (esX ? dx : dy);
    esX = !esX;
    return String(r(valor));
  });
}
