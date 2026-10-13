import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { ChatService, EventoChat } from './chat.service';

const codificar = (eventos: EventoChat[]) =>
  new TextEncoder().encode(eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''));

/** Un cuerpo SSE real, cortado en los bytes que se indiquen: así llega por la red. */
function respuestaEnTrozos(eventos: EventoChat[], cortes: number[]): Response {
  const bytes = codificar(eventos);
  const limites = [0, ...cortes, bytes.length];
  const cuerpo = new ReadableStream<Uint8Array>({
    start(controlador) {
      for (let i = 0; i < limites.length - 1; i += 1) {
        controlador.enqueue(bytes.slice(limites[i], limites[i + 1]));
      }
      controlador.close();
    },
  });
  return new Response(cuerpo, { status: 201, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('ChatService.enviarEnStream', () => {
  let servicio: ChatService;
  const fetchFalso = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchFalso);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: AuthService, useValue: { token: 'jwt-de-prueba' } }],
    });
    servicio = TestBed.inject(ChatService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchFalso.mockReset();
  });

  const recibir = (senal = new AbortController().signal) =>
    firstValueFrom(
      servicio.enviarEnStream('doc-1', null, '¿Qué es la célula?', senal).pipe(toArray()),
    );

  it('arma los eventos aunque los trozos corten un evento, o una letra con tilde, por la mitad', async () => {
    const eventos: EventoChat[] = [
      { tipo: 'inicio', conversationId: 'c-1', mensajeUsuarioId: 'm-1' },
      { tipo: 'token', texto: 'La célula es la unidad básica ' },
      { tipo: 'token', texto: 'de la vida (pág. 12).' },
      {
        tipo: 'anclaje',
        groundingScore: 0.91,
        citations: [{ claim: 'La célula…', page: 12, score: 0.91 }],
        flaggedClaims: [],
      },
      { tipo: 'fin', id: 'm-2', contextoParcial: false, titulo: 'Qué es la célula' },
    ];
    // Un corte entre los dos bytes de la "é" de "célula".
    const antesDeLaTilde = codificar(eventos.slice(0, 1)).length + 'data: {"tipo":"token","texto":"La c'.length;
    fetchFalso.mockResolvedValue(respuestaEnTrozos(eventos, [7, antesDeLaTilde + 1, 150, 151]));

    expect(await recibir()).toEqual(eventos);
  });

  it('manda el JWT y el cuerpo que espera el backend', async () => {
    fetchFalso.mockResolvedValue(respuestaEnTrozos([], []));

    await recibir();

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(String(url)).toMatch(/\/chat\/stream$/);
    expect((opciones!.headers as Record<string, string>)['Authorization']).toBe('Bearer jwt-de-prueba');
    expect(JSON.parse(opciones!.body as string)).toEqual({
      documentId: 'doc-1',
      message: '¿Qué es la célula?',
      idioma: 'es',
    });
  });

  it('un error del backend llega como un evento legible, no como excepción', async () => {
    fetchFalso.mockResolvedValue(
      new Response(JSON.stringify({ message: ['El libro todavía se está procesando.'] }), { status: 409 }),
    );

    expect(await recibir()).toEqual([{ tipo: 'error', mensaje: 'El libro todavía se está procesando.' }]);
  });

  it('sin red avisa qué revisar; si el estudiante canceló, termina en silencio', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await recibir()).toEqual([
      { tipo: 'error', mensaje: 'No se pudo conectar con el asistente. Revisa tu conexión.' },
    ]);

    const cancelado = new AbortController();
    cancelado.abort();
    fetchFalso.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    expect(await recibir(cancelado.signal)).toEqual([]);
  });
});
