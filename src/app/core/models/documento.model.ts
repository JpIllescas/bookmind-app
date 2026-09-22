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
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  processingError: string | null;
  /** `sin_texto` es un escaneo: se puede leer, pero el asistente no puede usarlo. */
  textLayer: 'ok' | 'sin_texto';
  tieneArchivo: boolean;
  fileSize: number | null;
}

/** Estructura del libro, detectada del índice del archivo o de sus encabezados. */
export interface Capitulo {
  id: string;
  orden: number;
  titulo: string;
  paginaInicio: number;
  paginaFin: number;
}

export interface DocumentoDetalle extends Documento {
  /** Solo llega en los EPUB; el PDF se lee desde su archivo original. */
  extractedText: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  name: string;
  preferenceCompleted: boolean;
}

export type EstiloEstudio = 'visual' | 'practico' | 'lectura' | 'mixto';
export type DuracionSesion = 'corta' | 'media' | 'larga';
export type ObjetivoEstudio = 'comprender' | 'memorizar' | 'examen' | 'repasar';
export type RitmoEstudio = 'tranquilo' | 'equilibrado' | 'intensivo';

export interface PreferenciasEstudio {
  estilo: EstiloEstudio;
  duracion: DuracionSesion;
  objetivo: ObjetivoEstudio;
  ritmo: RitmoEstudio;
}

export interface RespuestaAuth {
  token: string;
  user: Usuario;
}

export interface StudyTask {
  title: string;
  description?: string;
  session?: number;
  dueDate?: string;
  completed?: boolean;
}

export interface StudyPlan {
  id: string;
  title: string;
  targetDate: string | null;
  tasks: StudyTask[];
  active: boolean;
}

/** Señales de un libro que no salen de las páginas leídas. */
export interface SenalesLibro {
  /** Aciertos del último quiz, en porcentaje. Null si nunca resolvió uno. */
  comprension: number | null;
  quizzes: number;
  /** Preguntas falladas en ese último intento. */
  aRepasar: string[];
  /** Cuánto de lo que respondió el asistente estaba respaldado por el libro. */
  anclaje: number | null;
}

export interface ProgressSummary {
  documents: (Documento & SenalesLibro)[];
  total: number;
  completed: number;
  /** Empezados pero sin terminar. */
  started: number;
  average: number;
  /** Comprensión media sobre los libros con quiz resuelto. */
  comprension: number | null;
  librosEvaluados: number;
}
