import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  GeneratedContent,
  IntentoQuiz,
  OrigenMaterial,
} from '../../../core/services/content.service';
import { TextoRico } from '../../../shared/texto-rico/texto-rico';

export interface Tarjeta {
  pregunta: string;
  respuesta: string;
  pagina: number | null;
}

export interface PreguntaQuiz {
  pregunta: string;
  opciones: string[];
  correcta: number;
  pagina: number | null;
}

export interface PuntoResumen {
  texto: string;
  pagina: number | null;
}

export interface SeccionResumen {
  titulo: string;
  paginaInicio: number | null;
  paginaFin: number | null;
  puntos: PuntoResumen[];
}

export interface Termino {
  termino: string;
  definicion: string;
  pagina: number | null;
  esDefinicion: boolean;
}

export interface Evento {
  fecha: string;
  texto: string;
  pagina: number | null;
}

const ETIQUETAS = {
  summary: 'Resumen',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  glossary: 'Glosario',
  timeline: 'Línea de tiempo',
};

/** Lee tanto la forma nueva como la de los materiales generados antes. */
function comoLista(contenido: unknown, clave: string): any[] {
  if (Array.isArray(contenido)) return contenido;

  const dentro = (contenido as Record<string, unknown> | null)?.[clave];

  return Array.isArray(dentro) ? dentro : [];
}

function comoPagina(valor: unknown): number | null {
  return typeof valor === 'number' && valor > 0 ? valor : null;
}

@Component({
  selector: 'app-material',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextoRico],
  templateUrl: './material.html',
  styleUrl: './material.scss',
})
export class Material {
  readonly material = input.required<GeneratedContent>();

  /** Dentro del Studio la tarjeta ya tiene cabecera: se muestra solo el contenido. */
  readonly embebido = input(false);

  /** Sin visor (EPUB) las páginas se muestran pero no se puede saltar a ellas. */
  readonly puedeSaltar = input(true);

  readonly borrar = output<void>();
  /** Se emite una sola vez, al contestar la última pregunta del quiz. */
  readonly resuelto = output<IntentoQuiz>();
  /** Página que el estudiante quiere ver en el libro. */
  readonly pagina = output<number>();

  /** Abierto de entrada: en el hilo, el material es la respuesta a lo pedido. */
  readonly abierto = signal(true);
  /** Tarjetas cuya respuesta ya se destapó. */
  readonly reveladas = signal<Set<number>>(new Set());
  /** Opción elegida por pregunta del quiz. */
  readonly elegidas = signal<Record<number, number>>({});

  readonly etiqueta = computed(() => ETIQUETAS[this.material().type] ?? 'Material');

  readonly origen = computed<OrigenMaterial | null>(() => {
    const valor = (this.material().content as { origen?: unknown } | null)?.origen;
    return valor === 'motor' || valor === 'gemini' ? valor : null;
  });

  readonly resumen = computed(() => {
    const contenido = this.material().content;

    if (typeof contenido === 'string') return contenido;

    const texto = (contenido as { texto?: unknown } | null)?.texto;

    return typeof texto === 'string' ? texto : '';
  });

  /** Puntos del resumen extractivo; solo se listan cuando no hay prosa de Gemini que los cubra. */
  readonly puntos = computed<PuntoResumen[]>(() =>
    comoLista(this.material().content, 'puntos')
      .map((item) => ({ texto: String(item?.texto ?? ''), pagina: comoPagina(item?.pagina) }))
      .filter((punto) => punto.texto),
  );

  /** Tramos del libro con sus ideas; solo los trae el resumen por capítulos. */
  readonly secciones = computed<SeccionResumen[]>(() =>
    comoLista(this.material().content, 'secciones')
      .map((s) => ({
        titulo: String(s?.titulo ?? ''),
        paginaInicio: comoPagina(s?.paginaInicio),
        paginaFin: comoPagina(s?.paginaFin),
        puntos: (Array.isArray(s?.puntos) ? s.puntos : [])
          .map((p: any) => ({ texto: String(p?.texto ?? ''), pagina: comoPagina(p?.pagina) }))
          .filter((p: PuntoResumen) => p.texto),
      }))
      .filter((s) => s.puntos.length > 0),
  );

  readonly muestraPuntos = computed(
    () => this.origen() === 'motor' && this.puntos().length > 0,
  );

  readonly muestraSecciones = computed(
    () => this.muestraPuntos() && this.secciones().length > 1,
  );

  readonly tarjetas = computed<Tarjeta[]>(() =>
    comoLista(this.material().content, 'tarjetas')
      .map((item) => ({
        pregunta: String(item?.pregunta ?? item?.question ?? ''),
        respuesta: String(item?.respuesta ?? item?.answer ?? ''),
        pagina: comoPagina(item?.pagina),
      }))
      .filter((tarjeta) => tarjeta.pregunta),
  );

  readonly preguntas = computed<PreguntaQuiz[]>(() =>
    comoLista(this.material().content, 'preguntas')
      .map((item) => {
        const opciones: string[] = (item?.opciones ?? item?.options ?? []).map(String);
        const valor = item?.correcta ?? item?.answer;

        // Sin índice resoluble la pregunta se oculta: dar por buena la opción 0 corregía mal.
        const correcta =
          typeof valor === 'number'
            ? valor
            : opciones.findIndex((o) => o.toLowerCase() === String(valor).toLowerCase());

        return {
          pregunta: String(item?.pregunta ?? item?.question ?? ''),
          opciones,
          correcta,
          pagina: comoPagina(item?.pagina),
        };
      })
      .filter((p) => p.pregunta && p.correcta >= 0 && p.correcta < p.opciones.length),
  );

  readonly terminos = computed<Termino[]>(() =>
    comoLista(this.material().content, 'terminos')
      .map((item) => ({
        termino: String(item?.termino ?? ''),
        definicion: String(item?.definicion ?? ''),
        pagina: comoPagina(item?.pagina),
        esDefinicion: Boolean(item?.esDefinicion),
      }))
      .filter((termino) => termino.termino && termino.definicion),
  );

  readonly eventos = computed<Evento[]>(() =>
    comoLista(this.material().content, 'eventos')
      .map((item) => ({
        fecha: String(item?.fecha ?? ''),
        texto: String(item?.texto ?? ''),
        pagina: comoPagina(item?.pagina),
      }))
      .filter((evento) => evento.fecha && evento.texto),
  );

  /** Ítems que el verificador quitó por no apoyarse en el libro. */
  readonly descartadas = computed(() => {
    const valor = (this.material().content as { descartadas?: unknown } | null)?.descartadas;

    return typeof valor === 'number' && valor > 0 ? valor : 0;
  });

  readonly aciertos = computed(() => {
    const elegidas = this.elegidas();

    return this.preguntas().filter(
      (pregunta, indice) => elegidas[indice] === pregunta.correcta,
    ).length;
  });

  readonly respondidas = computed(() => Object.keys(this.elegidas()).length);

  /** El motor buscó y no encontró: distinto de un formato que no se puede leer. */
  readonly vacio = computed(() => {
    const tipo = this.material().type;

    if (tipo === 'glossary') return this.terminos().length === 0;
    if (tipo === 'timeline') return this.eventos().length === 0;

    return false;
  });

  /** Cuando el material llegó en un formato que no se pudo interpretar. */
  readonly ilegible = computed(() => {
    const tipo = this.material().type;

    if (tipo === 'summary') return this.resumen().trim() === '' && this.puntos().length === 0;
    if (tipo === 'flashcards') return this.tarjetas().length === 0;
    if (tipo === 'quiz') return this.preguntas().length === 0;

    return false;
  });

  alternar(): void {
    this.abierto.update((abierto) => !abierto);
  }

  revelar(indice: number): void {
    this.reveladas.update((actuales) => {
      const copia = new Set(actuales);
      copia.has(indice) ? copia.delete(indice) : copia.add(indice);
      return copia;
    });
  }

  estaRevelada(indice: number): boolean {
    return this.reveladas().has(indice);
  }

  responder(pregunta: number, opcion: number): void {
    // La primera respuesta cuenta: después solo se muestra el resultado.
    if (this.elegidas()[pregunta] !== undefined) return;

    this.elegidas.update((actuales) => ({ ...actuales, [pregunta]: opcion }));

    if (this.respondidas() === this.preguntas().length) this.resuelto.emit(this.intento());
  }

  /** Cita dentro de la prosa del resumen: ya viene sin evento que detener. */
  saltarA(pagina: number): void {
    if (this.puedeSaltar()) this.pagina.emit(pagina);
  }

  irAPagina(evento: Event, pagina: number | null): void {
    // El chip vive dentro de la tarjeta, que también es un botón.
    evento.stopPropagation();
    if (pagina && this.puedeSaltar()) this.pagina.emit(pagina);
  }

  /** Resultado del quiz completo; sin esto la evidencia se perdía al recargar. */
  private intento(): IntentoQuiz {
    const elegidas = this.elegidas();

    const falladas = this.preguntas()
      .map((pregunta, indice) => ({ pregunta, elegida: elegidas[indice] }))
      .filter(({ pregunta, elegida }) => elegida !== pregunta.correcta)
      .map(({ pregunta, elegida }) => ({
        pregunta: pregunta.pregunta,
        elegida: pregunta.opciones[elegida] ?? '',
        correcta: pregunta.opciones[pregunta.correcta] ?? '',
      }));

    return { aciertos: this.aciertos(), total: this.preguntas().length, falladas };
  }

  claseOpcion(pregunta: PreguntaQuiz, indice: number, numero: number): string {
    const elegida = this.elegidas()[numero];

    if (elegida === undefined) return '';
    if (indice === pregunta.correcta) return 'opcion--correcta';

    return elegida === indice ? 'opcion--fallo' : '';
  }
}
