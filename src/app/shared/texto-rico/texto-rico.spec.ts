import { describe, expect, it } from 'vitest';

import { aHtml } from './texto-rico';

describe('aHtml', () => {
  it('convierte negritas y viñetas en etiquetas, no en asteriscos', () => {
    const html = aHtml('Ideas **clave**:\n- Primera\n- Segunda');

    expect(html).toContain('<strong>clave</strong>');
    expect(html).toContain('<ul><li>Primera</li><li>Segunda</li></ul>');
    expect(html).not.toContain('**');
  });

  it('escapa el HTML que venga en la respuesta', () => {
    const html = aHtml('Cuidado con <img src=x onerror=alert(1)>');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('dibuja el bloque mapa como mapa de ideas', () => {
    const html = aHtml(
      ['```mapa', 'El principito', '- Baobabs: hay que arrancarlos (pág. 10)', '  - Si no, estallan', '- Zorro: crear vínculos', '```'].join('\n'),
    );

    expect(html).toContain('class="mapa"');
    expect(html).toContain('El principito');
    expect(html).toContain('<span class="mapa__nombre">Baobabs</span>');
    expect(html).toContain('<li>Si no, estallan</li>');
    // Dos ramas, cada una con su color.
    expect(html.match(/class="mapa__rama"/g)).toHaveLength(2);
    expect(html).toContain('#b4552e');
    expect(html).toContain('#4a8a5f');
  });

  it('entiende el mapa aunque el modelo lo devuelva indentado', () => {
    const html = aHtml(
      ['```mapa', '   Tema', '   - Rama: idea', '     - Detalle', '```'].join('\n'),
    );

    expect(html).toContain('class="mapa"');
    expect(html).toContain('<span class="mapa__nombre">Rama</span>');
    expect(html).toContain('<li>Detalle</li>');
  });

  it('dibuja el bloque linea como línea de tiempo', () => {
    const html = aHtml(
      ['```linea', '1492: Llegada a América', '1821: Independencia', '```'].join('\n'),
    );

    expect(html).toContain('class="linea"');
    expect(html).toContain('<span class="linea__cuando">1492</span>');
    expect(html.match(/class="linea__hito"/g)).toHaveLength(2);
  });

  it('numera el bloque pasos', () => {
    const html = aHtml(
      ['```pasos', '- La planta capta luz', '- Produce glucosa', '```'].join('\n'),
    );

    expect(html).toContain('class="pasos"');
    expect(html).toContain('>1</span>');
    expect(html).toContain('>2</span>');
  });

  it('enfrenta dos columnas en el bloque comparativa', () => {
    const html = aHtml(
      [
        '```comparativa',
        'El principito vs El zorro',
        '- Origen: Asteroide B 612 | La Tierra',
        '```',
      ].join('\n'),
    );

    expect(html).toContain('class="comparativa"');
    expect(html).toContain('Asteroide B 612');
    expect(html).toContain('La Tierra');
  });

  it('un bloque conocido pero mal formado cae a texto, no se pierde', () => {
    const html = aHtml(['```linea', 'una sola línea sin fecha', '```'].join('\n'));

    expect(html).not.toContain('class="linea"');
    expect(html).toContain('<pre>');
  });

  it('cae al bloque de texto si el mapa no trae ramas', () => {
    const html = aHtml(['```mapa', 'solo una línea suelta', '```'].join('\n'));

    expect(html).toContain('<pre>');
    expect(html).not.toContain('class="mapa"');
  });

  it('conserva el ASCII de las respuestas viejas dentro de un bloque', () => {
    const html = aHtml(['```', '├── PERCEPCIÓN ──▶ algo', '```'].join('\n'));

    expect(html).toContain('<pre>');
    expect(html).toContain('├── PERCEPCIÓN ──▶ algo');
  });
});
