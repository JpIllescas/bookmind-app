import { describe, expect, it } from 'vitest';

import { desenlaceDe, esRespuestaSinResultados, lumoDelChat, type MomentoChat, ultimaRespuesta } from './lumo-del-chat';

const quieto: MomentoChat = { escribiendo: false, enviando: false, recibiendoTexto: false, desenlace: null };

describe('lumoDelChat', () => {
  it('en reposo sigue al puntero', () => {
    expect(lumoDelChat(quieto)).toEqual({ estado: 'neutro', foco: null });
  });

  it('mientras escribes mira tu texto', () => {
    expect(lumoDelChat({ ...quieto, escribiendo: true })).toEqual({ estado: 'neutro', foco: 'abajo-izquierda' });
  });

  it('esperando la respuesta lee el libro, y cuando llega la lee a ella', () => {
    expect(lumoDelChat({ ...quieto, enviando: true }).estado).toBe('piensa');
    expect(lumoDelChat({ ...quieto, enviando: true, recibiendoTexto: true })).toEqual({ estado: 'neutro', foco: 'arriba' });
  });

  it('al terminar asiente; si el libro no lo dice o falla, se apena', () => {
    expect(lumoDelChat({ ...quieto, desenlace: 'respondio' }).estado).toBe('asiente');
    expect(lumoDelChat({ ...quieto, desenlace: 'sin-resultados' }).estado).toBe('apenado');
    expect(lumoDelChat({ ...quieto, desenlace: 'error' }).estado).toBe('apenado');
  });

  it('enviar de nuevo manda sobre la reacción anterior', () => {
    expect(lumoDelChat({ ...quieto, enviando: true, desenlace: 'sin-resultados' }).estado).toBe('piensa');
  });
});

describe('esRespuestaSinResultados', () => {
  it('reconoce el rechazo del chat sin Gemini y las frases de Gemini', () => {
    expect(esRespuestaSinResultados('No encontré en este libro nada sobre eso. Prueba con otras palabras.')).toBe(true);
    expect(esRespuestaSinResultados('I could not find that in this book.')).toBe(true);
    expect(esRespuestaSinResultados('Eso no aparece en este libro.')).toBe(true);
  });

  it('una respuesta normal no cuenta, aunque diga "encontré" más adelante', () => {
    expect(esRespuestaSinResultados('Esto es lo que encontré: el principito vive en el asteroide B 612 (pág. 12).')).toBe(false);
  });
});

describe('desenlaceDe', () => {
  it('asiente ante una respuesta y se apena si el libro no lo dice o hubo error', () => {
    expect(desenlaceDe('El principito vive en el asteroide B 612.', false, false)).toBe('respondio');
    expect(desenlaceDe('No encontré en este libro nada sobre eso.', false, false)).toBe('sin-resultados');
    expect(desenlaceDe('', true, false)).toBe('error');
  });

  it('si el estudiante la detuvo o no llegó texto, no reacciona', () => {
    expect(desenlaceDe('El principito vive', false, true)).toBeNull();
    expect(desenlaceDe('   ', false, false)).toBeNull();
  });
});

describe('ultimaRespuesta', () => {
  it('toma la respuesta aunque ya tenga su id definitivo (tras el evento fin)', () => {
    const hilo = [
      { id: 'a1', role: 'assistant', content: 'Respuesta anterior.' },
      { id: 'local-1', role: 'user', content: '¿Quién es el aviador?' },
      { id: '9f2c', role: 'assistant', content: 'El aviador cayó en el Sahara (pág. 6).' },
    ];
    expect(ultimaRespuesta(hilo)).toBe('El aviador cayó en el Sahara (pág. 6).');
  });

  it('sin respuesta del asistente devuelve vacío', () => {
    expect(ultimaRespuesta([{ role: 'user', content: 'hola' }])).toBe('');
  });
});
