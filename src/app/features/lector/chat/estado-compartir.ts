import type { Conversacion } from '../../../core/services/chat.service';

/** La lista con el enlace público de una conversación puesto (token) o quitado (null). */
export function conEnlace(lista: Conversacion[], id: string, token: string | null): Conversacion[] {
  return lista.map((conversacion) => (conversacion.id === id ? { ...conversacion, shareToken: token } : conversacion));
}

export function estaCompartida(lista: Conversacion[], id: string | null): boolean {
  return !!id && !!lista.find((conversacion) => conversacion.id === id)?.shareToken;
}
