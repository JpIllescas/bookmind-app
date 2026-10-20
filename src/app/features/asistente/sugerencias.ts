import type { Documento } from '../../core/models/documento.model';

const LARGO_TITULO = 40;

function titulo(libro: Documento): string {
  const limpio = libro.title.replace(/\s+/g, ' ').trim();
  return limpio.length > LARGO_TITULO ? `${limpio.slice(0, LARGO_TITULO - 1).trimEnd()}…` : limpio;
}

/** Preguntas de arranque con los libros reales del estudiante, no con temas que quizá no tenga. */
export function sugerenciasDe(listos: Documento[]): string[] {
  const [primero, segundo] = listos;
  if (!primero) return [];
  if (!segundo) {
    return [
      `¿De qué trata «${titulo(primero)}»?`,
      `¿Cuáles son las ideas principales de «${titulo(primero)}»?`,
      `Hazme un repaso rápido de «${titulo(primero)}»`,
    ];
  }
  return [
    `¿De qué trata «${titulo(primero)}»?`,
    `¿Qué tienen en común «${titulo(primero)}» y «${titulo(segundo)}»?`,
    'Hazme un repaso rápido de lo que tengo',
  ];
}
