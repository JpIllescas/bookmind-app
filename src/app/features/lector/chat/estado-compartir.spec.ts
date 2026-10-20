import { describe, expect, it } from 'vitest';

import type { Conversacion } from '../../../core/services/chat.service';
import { conEnlace, estaCompartida } from './estado-compartir';

const conversacion = (id: string, shareToken: string | null = null): Conversacion => ({
  id, titulo: id, mensajes: 2, ultimoMensaje: null, createdAt: '', updatedAt: '', shareToken,
});

describe('estado de compartir', () => {
  const lista = [conversacion('a'), conversacion('b', 'tok-b')];

  it('sabe cuál está compartida según el listado del servidor', () => {
    expect(estaCompartida(lista, 'a')).toBe(false);
    expect(estaCompartida(lista, 'b')).toBe(true);
    expect(estaCompartida(lista, null)).toBe(false);
  });

  it('compartir y revocar cambian solo esa conversación', () => {
    const compartida = conEnlace(lista, 'a', 'tok-a');
    expect(estaCompartida(compartida, 'a')).toBe(true);
    expect(compartida[1]).toBe(lista[1]);

    expect(estaCompartida(conEnlace(compartida, 'a', null), 'a')).toBe(false);
  });
});
