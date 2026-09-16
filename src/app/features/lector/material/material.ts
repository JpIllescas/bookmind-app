import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { GeneratedContent, IntentoQuiz } from '../../../core/services/content.service';
import { TextoRico } from '../../../shared/texto-rico/texto-rico';

export interface Tarjeta {
  pregunta: string;
  respuesta: string;
}

export interface PreguntaQuiz {
  pregunta: string;
  opciones: string[];
  correcta: number;
}

const ETIQUETAS = {
  summary: 'Resumen',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
};

/** Lee tanto la forma nueva como la de los materiales generados antes. */
function comoLista(contenido: unknown, clave: string): any[] {
  if (Array.isArray(contenido)) return contenido;

  const dentro = (contenido as Record<string, unknown> | null)?.[clave];

  return Array.isArray(dentro) ? dentro : [];
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

  readonly borrar = output<void>();
  /** Se emite una sola vez, al contestar la última pregunta del quiz. */
  readonly resuelto = output<IntentoQuiz>();

  /** Abierto de entrada: en el hilo, el material es la respuesta a lo pedido. */
  readonly abierto = signal(true);
  /** Tarjetas cuya respuesta ya se destapó. */
  readonly reveladas = signal<Set<number>>(new Set());
  /** Opción elegida por pregunta del quiz. */
  readonly elegidas = signal<Record<number, number>>({});

  readonly etiqueta = computed(() => ETIQUETAS[this.material().type]);

  readonly resumen = computed(() => {
    const contenido = this.material().content;

    if (typeof contenido === 'string') return contenido;

    const texto = (contenido as { texto?: unknown } | null)?.texto;

    return typeof texto === 'string' ? texto : '';
  });

  readonly tarjetas = computed<Tarjeta[]>(() =>
    comoLista(this.material().content, 'tarjetas')
      .map((item) => ({
        pregunta: String(item?.pregunta ?? item?.question ?? ''),
        respuesta: String(item?.respuesta ?? item?.answer ?? ''),
      }))
      .filter((tarjeta) => tarjeta.pregunta),
  );

  readonly preguntas = computed<PreguntaQuiz[]>(() =>
    comoLista(this.material().content, 'preguntas')
      .map((item) => {
        const opciones: string[] = (item?.opciones ?? item?.options ?? []).map(String);
        const valor = item?.correcta ?? item?.answer;

        const correcta =
          typeof valor === 'number'
            ? valor
            : Math.max(
                opciones.findIndex(
                  (o) => o.toLowerCase() === String(valor).toLowerCase(),
                ),
                0,
              );

        return {
          pregunta: String(item?.pregunta ?? item?.question ?? ''),
          opciones,
          correcta,
        };
      })
      .filter((p) => p.pregunta && p.opciones.length > 0),
  );

  readonly aciertos = computed(() => {
    const elegidas = this.elegidas();

    return this.preguntas().filter(
      (pregunta, indice) => elegidas[indice] === pregunta.correcta,
    ).length;
  });

  readonly respondidas = computed(() => Object.keys(this.elegidas()).length);

  /** Cuando el material llegó en un formato que no se pudo interpretar. */
  readonly ilegible = computed(() => {
    const tipo = this.material().type;

    if (tipo === 'summary') return this.resumen().trim() === '';
    if (tipo === 'flashcards') return this.tarjetas().length === 0;

    return this.preguntas().length === 0;
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
