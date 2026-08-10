// Los literales deben coincidir con los enums del backend y taxonomy.py.

export type Materia =
  | 'matematicas'
  | 'ciencias_naturales'
  | 'ciencias_sociales'
  | 'comunicacion_lenguaje'
  | 'ingles'
  | 'otro';

export type Nivel = 'primaria_baja' | 'primaria_alta' | 'basicos';

export type TipoDocumento = 'PDF' | 'EPUB';

export interface Documento {
  id: string;
  title: string;
  author: string | null;
  type: TipoDocumento;
  pages: number;
  progress: number;
  tintColor: string;
  createdAt: string;
  materia: Materia | null;
  nivel: Nivel | null;
  /** Ya armada: "Ciencias Naturales · Primaria alta". */
  etiqueta: string;
  classifierConfidence: number | null;
  /** Chips del chat, según la materia. */
  accionesRapidas: string[];
}

export interface DocumentoDetalle extends Documento {
  extractedText: string;
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
}

export interface RespuestaAuth {
  token: string;
  user: Usuario;
}
