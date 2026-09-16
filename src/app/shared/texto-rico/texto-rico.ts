import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Escapa antes de formatear: así el HTML resultante solo tiene etiquetas nuestras. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Negritas, cursivas y código dentro de una línea. */
function marcasEnLinea(linea: string): string {
  return linea
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}

/** Un color por rama del mapa; se repiten si hay más de cuatro. */
const COLORES_RAMA = ['#b4552e', '#4a8a5f', '#3f6d9e', '#8a6d3b'];

const RAMA = /^[-*•]\s+(.*)$/;
const HOJA = /^\s+[-*•]\s+(.*)$/;

/** Quita la sangría común: el modelo suele copiar el bloque ya indentado. */
function sinSangriaComun(lineas: string[]): string[] {
  const conTexto = lineas.filter((linea) => linea.trim() !== '');

  const minima = conTexto.reduce((menor, linea) => {
    const sangria = linea.length - linea.trimStart().length;
    return Math.min(menor, sangria);
  }, Number.MAX_SAFE_INTEGER);

  return conTexto.map((linea) => linea.slice(minima));
}

/** Dibuja el bloque ```mapa como un mapa de ideas, no como texto. */
function mapaAHtml(crudas: string[]): string {
  const utiles = sinSangriaComun(crudas);
  if (utiles.length === 0) return '';

  const tema = utiles[0].trim();
  const ramas: { texto: string; hojas: string[] }[] = [];

  for (const linea of utiles.slice(1)) {
    const hoja = HOJA.exec(linea);

    if (hoja && ramas.length > 0) {
      ramas[ramas.length - 1].hojas.push(hoja[1]);
      continue;
    }

    const rama = RAMA.exec(linea);
    if (rama) ramas.push({ texto: rama[1], hojas: [] });
  }

  if (ramas.length === 0) return '';

  const cuerpo = ramas
    .map((rama, indice) => {
      const color = COLORES_RAMA[indice % COLORES_RAMA.length];
      // "Rama: idea" se parte para destacar el nombre de la rama.
      const corte = rama.texto.indexOf(':');
      const titulo = corte > 0 ? rama.texto.slice(0, corte) : rama.texto;
      const resto = corte > 0 ? rama.texto.slice(corte + 1).trim() : '';

      const hojas =
        rama.hojas.length > 0
          ? `<ul class="mapa__hojas">${rama.hojas
              .map((hoja) => `<li>${marcasEnLinea(hoja)}</li>`)
              .join('')}</ul>`
          : '';

      return `<li class="mapa__rama" style="--rama: ${color}">
        <p class="mapa__idea"><span class="mapa__nombre">${marcasEnLinea(titulo)}</span>${
          resto ? ` ${marcasEnLinea(resto)}` : ''
        }</p>${hojas}
      </li>`;
    })
    .join('');

  return `<figure class="mapa">
    <figcaption class="mapa__tema">${marcasEnLinea(tema)}</figcaption>
    <ul class="mapa__ramas">${cuerpo}</ul>
  </figure>`;
}

/** Dibuja el bloque ```linea como una linea de tiempo. */
function lineaAHtml(crudas: string[]): string {
  const utiles = sinSangriaComun(crudas);
  if (utiles.length === 0) return '';

  const hitos = utiles
    .map((linea) => RAMA.exec(linea)?.[1] ?? linea.trim())
    .filter((texto) => texto !== '')
    .map((texto) => {
      const corte = texto.indexOf(':');

      return {
        cuando: corte > 0 ? texto.slice(0, corte).trim() : '',
        que: corte > 0 ? texto.slice(corte + 1).trim() : texto,
      };
    })
    .filter((hito) => hito.cuando !== '' && hito.que !== '');

  if (hitos.length < 2) return '';

  const cuerpo = hitos
    .map(
      (hito) => `<li class="linea__hito">
        <span class="linea__cuando">${marcasEnLinea(hito.cuando)}</span>
        <span class="linea__que">${marcasEnLinea(hito.que)}</span>
      </li>`,
    )
    .join('');

  return `<figure class="linea"><ol class="linea__hitos">${cuerpo}</ol></figure>`;
}

/** Dibuja el bloque ```pasos como un proceso numerado. */
function pasosAHtml(crudas: string[]): string {
  const utiles = sinSangriaComun(crudas);
  if (utiles.length === 0) return '';

  const pasos = utiles
    .map((linea) => RAMA.exec(linea)?.[1] ?? NUMERADA.exec(linea)?.[1] ?? linea.trim())
    .filter((texto) => texto !== '');

  if (pasos.length < 2) return '';

  const cuerpo = pasos
    .map(
      (paso, indice) => `<li class="pasos__paso">
        <span class="pasos__numero" aria-hidden="true">${indice + 1}</span>
        <span class="pasos__texto">${marcasEnLinea(paso)}</span>
      </li>`,
    )
    .join('');

  return `<figure class="pasos"><ol class="pasos__lista">${cuerpo}</ol></figure>`;
}

/** Dibuja el bloque ```comparativa como dos columnas enfrentadas. */
function comparativaAHtml(crudas: string[]): string {
  const utiles = sinSangriaComun(crudas);
  if (utiles.length < 2) return '';

  const cabecera = utiles[0].split(/\s+vs\.?\s+/i);
  if (cabecera.length !== 2) return '';

  const filas = utiles
    .slice(1)
    .map((linea) => RAMA.exec(linea)?.[1] ?? linea.trim())
    .map((texto) => {
      const corte = texto.indexOf(':');
      if (corte <= 0) return null;

      const lados = texto.slice(corte + 1).split('|');
      if (lados.length !== 2) return null;

      return {
        aspecto: texto.slice(0, corte).trim(),
        uno: lados[0].trim(),
        otro: lados[1].trim(),
      };
    })
    .filter((fila): fila is { aspecto: string; uno: string; otro: string } => fila !== null);

  if (filas.length === 0) return '';

  const cuerpo = filas
    .map(
      (fila) => `<tr>
        <th scope="row">${marcasEnLinea(fila.aspecto)}</th>
        <td>${marcasEnLinea(fila.uno)}</td>
        <td>${marcasEnLinea(fila.otro)}</td>
      </tr>`,
    )
    .join('');

  return `<figure class="comparativa"><table>
    <thead><tr><td></td>
      <th scope="col">${marcasEnLinea(cabecera[0].trim())}</th>
      <th scope="col">${marcasEnLinea(cabecera[1].trim())}</th>
    </tr></thead>
    <tbody>${cuerpo}</tbody>
  </table></figure>`;
}

/** Cada bloque con nombre tiene su dibujo; el resto cae a texto preformateado. */
const DIBUJOS: Record<string, (lineas: string[]) => string> = {
  mapa: mapaAHtml,
  linea: lineaAHtml,
  pasos: pasosAHtml,
  comparativa: comparativaAHtml,
};

const VINETA = /^\s*[-*•]\s+(.*)$/;
const NUMERADA = /^\s*\d+[.)]\s+(.*)$/;
const TITULO = /^\s*#{1,6}\s+(.*)$/;
const SEPARADOR = /^\s*([-*_]\s*){3,}$/;

/** Markdown mínimo: lo que el asistente usa de verdad, nada más. */
export function aHtml(texto: string): string {
  const lineas = escapar(texto).split('\n');
  const bloques: string[] = [];

  let parrafo: string[] = [];
  let lista: { tipo: 'ul' | 'ol'; puntos: string[] } | null = null;
  let enCodigo = false;
  let tipoCodigo = '';
  let codigo: string[] = [];

  // Un bloque mal formado no se pierde: cae al texto preformateado de siempre.
  const cerrarCodigo = () =>
    DIBUJOS[tipoCodigo]?.(codigo) || `<pre>${codigo.join('\n')}</pre>`;

  const cerrarParrafo = () => {
    if (parrafo.length === 0) return;
    bloques.push(`<p>${marcasEnLinea(parrafo.join(' '))}</p>`);
    parrafo = [];
  };

  const cerrarLista = () => {
    if (!lista) return;
    const puntos = lista.puntos.map((p) => `<li>${marcasEnLinea(p)}</li>`).join('');
    bloques.push(`<${lista.tipo}>${puntos}</${lista.tipo}>`);
    lista = null;
  };

  for (const linea of lineas) {
    const cerca = /^\s*```\s*([A-Za-z]*)/.exec(linea);
    if (cerca) {
      cerrarParrafo();
      cerrarLista();

      if (enCodigo) {
        bloques.push(cerrarCodigo());
        codigo = [];
        tipoCodigo = '';
        enCodigo = false;
      } else {
        enCodigo = true;
        tipoCodigo = cerca[1].toLowerCase();
      }

      continue;
    }

    if (enCodigo) {
      codigo.push(linea);
      continue;
    }

    if (linea.trim() === '' || SEPARADOR.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    const titulo = TITULO.exec(linea);
    if (titulo) {
      cerrarParrafo();
      cerrarLista();
      bloques.push(`<h4>${marcasEnLinea(titulo[1])}</h4>`);
      continue;
    }

    const vineta = VINETA.exec(linea);
    if (vineta) {
      cerrarParrafo();
      if (lista?.tipo !== 'ul') {
        cerrarLista();
        lista = { tipo: 'ul', puntos: [] };
      }
      lista.puntos.push(vineta[1]);
      continue;
    }

    const numerada = NUMERADA.exec(linea);
    if (numerada) {
      cerrarParrafo();
      if (lista?.tipo !== 'ol') {
        cerrarLista();
        lista = { tipo: 'ol', puntos: [] };
      }
      lista.puntos.push(numerada[1]);
      continue;
    }

    // Una línea suelta después de una viñeta la continúa, no abre párrafo.
    if (lista) {
      lista.puntos[lista.puntos.length - 1] += ` ${linea.trim()}`;
      continue;
    }

    parrafo.push(linea.trim());
  }

  // Bloque sin cerrar: se pinta igual, no se tira la respuesta.
  if (enCodigo && codigo.length > 0) bloques.push(cerrarCodigo());
  cerrarParrafo();
  cerrarLista();

  return bloques.join('');
}

/** Pinta la respuesta del asistente con su formato en vez de con los asteriscos. */
@Component({
  selector: 'app-texto-rico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div class="texto-rico" [innerHTML]="html()"></div>',
  styles: `
    .texto-rico {
      overflow-wrap: anywhere;

      :first-child { margin-top: 0; }
      :last-child { margin-bottom: 0; }

      p { margin: 0 0 8px; }

      h4 {
        margin: 12px 0 6px;
        font-size: 13.5px;
        font-weight: 700;
      }

      ul, ol {
        margin: 0 0 8px;
        padding-left: 20px;
      }

      li { margin-bottom: 4px; }

      code {
        padding: 1px 4px;
        border-radius: 4px;
        background: var(--fondo-app);
        font-size: 0.92em;
      }

      /* ------------------------------------------------------ mapa de ideas */

      .mapa {
        margin: 0 0 10px;
        padding: 12px 13px;
        border: 1px solid var(--borde);
        border-radius: var(--radio);
        background: var(--superficie-calida);
      }

      .mapa__tema {
        position: relative;
        margin: 0 0 14px;
        padding-bottom: 10px;
        font-family: var(--fuente-display);
        font-size: 14.5px;
        font-weight: 700;
        text-align: center;
        color: var(--texto);
      }

      /* El tallo del que cuelgan las ramas. */
      .mapa__tema::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 0;
        width: 1px;
        height: 10px;
        background: var(--borde-punteado);
      }

      .mapa__ramas {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .mapa__rama {
        position: relative;
        padding: 7px 10px 7px 12px;
        border-left: 3px solid var(--rama);
        border-radius: 0 var(--radio-chico) var(--radio-chico) 0;
        background: color-mix(in srgb, var(--rama) 7%, transparent);
      }

      .mapa__idea {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
      }

      .mapa__nombre {
        font-weight: 700;
        color: var(--rama);
      }

      .mapa__hojas {
        margin: 6px 0 0;
        padding-left: 16px;
        font-size: 12.5px;
        color: var(--texto-secundario);
      }

      .mapa__hojas li {
        margin-bottom: 2px;
      }

      /* --------------------------------------------------- linea de tiempo */

      .linea {
        margin: 0 0 10px;
        padding: 12px 13px;
        border: 1px solid var(--borde);
        border-radius: var(--radio);
        background: var(--superficie-calida);
      }

      .linea__hitos {
        margin: 0;
        padding: 0 0 0 14px;
        list-style: none;
        border-left: 2px solid var(--borde-punteado);
      }

      .linea__hito {
        position: relative;
        margin-bottom: 10px;
        font-size: 13px;
        line-height: 1.45;
      }

      .linea__hito:last-child { margin-bottom: 0; }

      /* El punto que ancla el hito al tallo. */
      .linea__hito::before {
        content: '';
        position: absolute;
        left: -20px;
        top: 5px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--acento);
      }

      .linea__cuando {
        display: block;
        font-weight: 700;
        color: var(--acento);
      }

      /* --------------------------------------------------- proceso por pasos */

      .pasos {
        margin: 0 0 10px;
        padding: 12px 13px;
        border: 1px solid var(--borde);
        border-radius: var(--radio);
        background: var(--superficie-calida);
      }

      .pasos__lista {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .pasos__paso {
        display: flex;
        gap: 9px;
        align-items: flex-start;
        font-size: 13px;
        line-height: 1.45;
      }

      .pasos__numero {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--acento);
        color: var(--sobre-acento, #fff);
        font-size: 11.5px;
        font-weight: 700;
        line-height: 20px;
        text-align: center;
      }

      /* ------------------------------------------------------- comparativa */

      .comparativa {
        margin: 0 0 10px;
        overflow-x: auto;
      }

      .comparativa table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
      }

      .comparativa th,
      .comparativa td {
        padding: 6px 8px;
        border: 1px solid var(--borde);
        text-align: left;
        vertical-align: top;
      }

      .comparativa thead th {
        background: var(--superficie-calida);
        color: var(--acento);
      }

      .comparativa tbody th {
        font-weight: 600;
        color: var(--texto-secundario);
      }

      /* El bloque desborda dentro de sí mismo, no empuja el ancho del chat. */
      pre {
        margin: 0 0 8px;
        padding: 9px 11px;
        border-radius: var(--radio-chico);
        background: var(--fondo-app);
        font-size: 12.5px;
        overflow-x: auto;
      }
    }
  `,
})
export class TextoRico {
  readonly texto = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);

  // El texto se escapa antes de formatear: solo quedan las etiquetas que genera aHtml.
  readonly html = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(aHtml(this.texto())),
  );
}
