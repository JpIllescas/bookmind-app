/** Qué paneles del lector están abiertos en pantalla ancha. */
export interface PanelesVisibles {
  libro: boolean;
  chat: boolean;
  studio: boolean;
}

/**
 * Columnas "libro · separador · chat · studio", siempre las cuatro: cada panel tiene su área fija y
 * ocultar uno no corre a los demás. El separador (y el ancho ajustable) solo existe entre libro y chat;
 * sin chat, el libro se queda con el espacio libre.
 */
export function columnasDelLector({ libro, chat, studio }: PanelesVisibles): string {
  const libre = 'minmax(0, 1fr)';
  const columnaLibro = !libro ? '0px' : chat ? 'var(--ancho-libro)' : libre;
  const separador = libro && chat ? '6px' : '0px';
  const columnaChat = chat ? libre : '0px';
  const columnaStudio = !studio ? '0px' : libro || chat ? 'var(--ancho-studio)' : libre;

  return [columnaLibro, separador, columnaChat, columnaStudio].join(' ');
}

/** El último panel abierto no se puede cerrar: la pantalla quedaría vacía. */
export function esElUnicoAbierto(paneles: PanelesVisibles, panel: keyof PanelesVisibles): boolean {
  return paneles[panel] && Object.values(paneles).filter(Boolean).length === 1;
}
