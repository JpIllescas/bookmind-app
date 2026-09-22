/** Paletas de portada: cada libro recibe una fija según su título, así se reconoce de un vistazo. */
export interface PaletaPortada {
  nombre: string;
  /** Color principal y una variante más clara para el degradado. */
  base: string;
  claro: string;
  /** Sombra dura bajo la portada, más oscura que la base. */
  relieve: string;
}

export type MotivoPortada = 'anillos' | 'rayas' | 'puntos' | 'ondas' | 'arcos';

const PALETAS: PaletaPortada[] = [
  { nombre: 'terracota', base: '#b4552e', claro: '#e07a4f', relieve: '#7e3a1e' },
  { nombre: 'bosque', base: '#2f6b4f', claro: '#4f9a72', relieve: '#1f4a36' },
  { nombre: 'oceano', base: '#2f5f8f', claro: '#5a8fc4', relieve: '#1f4062' },
  { nombre: 'ciruela', base: '#6b3f8f', claro: '#9a6cc4', relieve: '#472a60' },
  { nombre: 'mostaza', base: '#b8860b', claro: '#e0ac2c', relieve: '#7d5b07' },
  { nombre: 'coral', base: '#c9503f', claro: '#ea7c6b', relieve: '#8a352a' },
  { nombre: 'pino', base: '#1f7a78', claro: '#3ea9a5', relieve: '#145251' },
  { nombre: 'tinta', base: '#3b3a5c', claro: '#66648f', relieve: '#26253d' },
];

const MOTIVOS: MotivoPortada[] = ['anillos', 'rayas', 'puntos', 'ondas', 'arcos'];

/** Hash FNV-1a: barato, estable y suficiente para repartir libros entre paletas. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function paletaDe(titulo: string): PaletaPortada {
  return PALETAS[hash(titulo.trim().toLowerCase()) % PALETAS.length];
}

export function motivoDe(titulo: string): MotivoPortada {
  // Se desplaza el hash para que paleta y motivo no vayan siempre emparejados.
  return MOTIVOS[(hash(titulo.trim().toLowerCase()) >>> 8) % MOTIVOS.length];
}
