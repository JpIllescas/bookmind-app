import type { EstadoLumo, FocoLumo } from '../../../shared/lumo/lumo';

/** Cómo terminó la última respuesta; Lumo reacciona un momento y vuelve a la calma. */
export type DesenlaceRespuesta = 'respondio' | 'sin-resultados' | 'error';

export interface MomentoChat {
  /** Hay texto en la caja. */
  escribiendo: boolean;
  enviando: boolean;
  /** Ya llegan palabras de la respuesta. */
  recibiendoTexto: boolean;
  desenlace: DesenlaceRespuesta | null;
}

export interface LumoDelChat {
  estado: EstadoLumo;
  foco: FocoLumo | null;
}

/** Las mismas frases fijas con que el backend rechaza una pregunta que el libro no responde. */
const SIN_RESULTADOS = [
  /^no encontré/i,
  /^i could not find/i,
  /no aparece en (este|el) libro/i,
  /(el|este) libro no (habla|menciona|trata)/i,
];

export const esRespuestaSinResultados = (texto: string): boolean =>
  SIN_RESULTADOS.some((patron) => patron.test(texto.trim()));

/** Texto de la respuesta recién terminada: al llegar `fin` ya lleva su id definitivo, así que se busca por rol. */
export const ultimaRespuesta = (mensajes: readonly { role: string; content: string }[]): string =>
  [...mensajes].reverse().find((m) => m.role === 'assistant')?.content ?? '';

/** Cortada por el estudiante o vacía no merece reacción: asentir tras un "Detener" sería mentir. */
export function desenlaceDe(respuesta: string, huboError: boolean, cortada: boolean): DesenlaceRespuesta | null {
  if (huboError) return 'error';
  if (cortada || respuesta.trim() === '') return null;
  return esRespuestaSinResultados(respuesta) ? 'sin-resultados' : 'respondio';
}

/** Lumo vive sobre la caja, a la derecha: el texto que escribes queda abajo a la izquierda y la respuesta, arriba. */
export function lumoDelChat(momento: MomentoChat): LumoDelChat {
  if (momento.enviando) {
    return momento.recibiendoTexto ? { estado: 'neutro', foco: 'arriba' } : { estado: 'piensa', foco: null };
  }
  if (momento.desenlace === 'sin-resultados' || momento.desenlace === 'error') return { estado: 'apenado', foco: null };
  if (momento.desenlace === 'respondio') return { estado: 'asiente', foco: 'arriba' };
  if (momento.escribiendo) return { estado: 'neutro', foco: 'abajo-izquierda' };
  return { estado: 'neutro', foco: null };
}
