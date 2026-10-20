import type { EstadoLumo, FocoLumo } from './lumo';

/** Un valor que persigue su objetivo con inercia: de aquí sale el arrastre de orejas, cola y mirada. */
export interface Resorte {
  valor: number;
  velocidad: number;
}

export interface Elasticidad {
  rigidez: number;
  amortiguacion: number;
}

export const crearResorte = (valor = 0): Resorte => ({ valor, velocidad: 0 });

/** Euler semimplícito; el paso se acota para que un cuadro lento (pestaña de vuelta) no lo dispare. */
export function avanzarResorte(resorte: Resorte, objetivo: number, { rigidez, amortiguacion }: Elasticidad, dt: number): void {
  const paso = Math.min(Math.max(dt, 0), 1 / 30);
  const aceleracion = -rigidez * (resorte.valor - objetivo) - amortiguacion * resorte.velocidad;
  resorte.velocidad += aceleracion * paso;
  resorte.valor += resorte.velocidad * paso;
}

export interface Parpadeo {
  espera: number;
  doble: boolean;
}

/** Intervalos irregulares y, a veces, doble: un parpadeo periódico se lee mecánico. */
export function siguienteParpadeo(azar: () => number = Math.random): Parpadeo {
  return { espera: 2200 + azar() * 4300, doble: azar() < 0.2 };
}

const CIERRE = 70;
const CERRADO = 30;
const APERTURA = 90;
const PARPADEO = CIERRE + CERRADO + APERTURA;
const PAUSA_DOBLE = 110;
const CASI_CERRADO = 0.1;

export const duracionParpadeo = (doble: boolean): number => (doble ? PARPADEO * 2 + PAUSA_DOBLE : PARPADEO);

/** Cierra rápido y abre más despacio, como un párpado real. */
function unParpadeo(ms: number): number {
  if (ms < 0 || ms >= PARPADEO) return 1;
  if (ms < CIERRE) return 1 - (1 - CASI_CERRADO) * (ms / CIERRE);
  if (ms < CIERRE + CERRADO) return CASI_CERRADO;
  return CASI_CERRADO + (1 - CASI_CERRADO) * ((ms - CIERRE - CERRADO) / APERTURA);
}

/** Apertura de los ojos (1 abiertos) a `ms` del inicio del parpadeo. */
export function aperturaOjos(ms: number, doble: boolean): number {
  const primero = unParpadeo(ms);
  return doble ? Math.min(primero, unParpadeo(ms - PARPADEO - PAUSA_DOBLE)) : primero;
}

interface Ritmo {
  /** Segundos por respiración y cuánto se estira el cuerpo. */
  respiracion: number;
  amplitud: number;
  /** Vaivén de la cola en reposo, en grados y segundos. */
  cola: number;
  periodoCola: number;
}

/** Dormido respira lento y casi no mueve la cola; al celebrar la agita rápido. */
export const RITMOS: Record<EstadoLumo, Ritmo> = {
  neutro: { respiracion: 4.2, amplitud: 0.018, cola: 4, periodoCola: 3.6 },
  saluda: { respiracion: 3.6, amplitud: 0.02, cola: 6, periodoCola: 2.6 },
  piensa: { respiracion: 3.8, amplitud: 0.014, cola: 2.5, periodoCola: 4.6 },
  celebra: { respiracion: 2.2, amplitud: 0.024, cola: 8, periodoCola: 0.6 },
  duerme: { respiracion: 5.6, amplitud: 0.026, cola: 0.8, periodoCola: 6 },
  asiente: { respiracion: 3.8, amplitud: 0.018, cola: 5, periodoCola: 2.4 },
  apenado: { respiracion: 5, amplitud: 0.022, cola: 1.2, periodoCola: 5.4 },
  anima: { respiracion: 3.8, amplitud: 0.018, cola: 5, periodoCola: 2.8 },
};

export const respiracion = (segundos: number, ritmo: Ritmo): number =>
  1 + ritmo.amplitud * Math.sin((2 * Math.PI * segundos) / ritmo.respiracion);

export const vaivenCola = (segundos: number, ritmo: Ritmo): number =>
  ritmo.cola * Math.sin((2 * Math.PI * segundos) / ritmo.periodoCola);

/** Inclinación de la cabeza propia de cada estado; se suma al giro hacia lo que mira. */
export function inclinacion(estado: EstadoLumo, guino: boolean): number {
  if (guino) return -6;
  const grados: Partial<Record<EstadoLumo, number>> = { saluda: -3, piensa: 3, duerme: -5, apenado: 4, anima: -4 };
  return grados[estado] ?? 0;
}

const MIRADAS: Record<FocoLumo, Mirada> = {
  arriba: { x: 0, y: -2.4, giro: 0 },
  abajo: { x: 0, y: 2.6, giro: 0 },
  izquierda: { x: -2.6, y: 0.4, giro: -4 },
  derecha: { x: 2.6, y: 0.4, giro: 4 },
  'abajo-izquierda': { x: -2.2, y: 2.2, giro: -3 },
};

/** Mirada que no depende del puntero: leyendo baja al libro, apenado baja la vista, y si no lo que pida la pantalla. */
export function miradaFija(estado: EstadoLumo, foco: FocoLumo | null): Mirada | null {
  if (estado === 'piensa') return { x: 1.5, y: 2.6, giro: 0 };
  if (estado === 'apenado') return { x: -0.6, y: 2.4, giro: 0 };
  return foco ? MIRADAS[foco] : null;
}

/** Hasta dónde se desplaza la pupila (unidades del viewBox) y en qué tramo deja de seguir. */
const MIRADA_MAX = 2.8;
const MIRADA_ALCANCE = 560;
const MIRADA_DESVANECE = 360;
const GIRO_MAX = 5;

export interface Mirada {
  x: number;
  y: number;
  giro: number;
}

/** Hacia dónde miran pupilas y cabeza dado un punto a (dx, dy) px de los ojos; de lejos vuelven al centro. */
export function miradaHacia(dx: number, dy: number): Mirada {
  const distancia = Math.hypot(dx, dy);
  if (distancia === 0 || distancia >= MIRADA_ALCANCE) return { x: 0, y: 0, giro: 0 };
  // Sube rápido cerca y se apaga gradualmente al alejarse: sin saltos en el borde.
  const cercania = Math.min(1, distancia / 140);
  const lejania = Math.max(0, distancia - MIRADA_DESVANECE) / (MIRADA_ALCANCE - MIRADA_DESVANECE);
  const fuerza = cercania * (1 - lejania);
  return {
    x: (dx / distancia) * fuerza * MIRADA_MAX,
    y: (dy / distancia) * fuerza * MIRADA_MAX * 0.8,
    giro: (dx / distancia) * fuerza * GIRO_MAX,
  };
}
