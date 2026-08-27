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
}

export interface DocumentoDetalle extends Documento {
  extractedText: string;
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

export interface StudyTask { title: string; dueDate?: string; completed?: boolean; }
export interface StudyPlan { id: string; title: string; targetDate: string | null; tasks: StudyTask[]; active: boolean; }
export interface ProgressSummary { documents: Documento[]; total: number; completed: number; average: number; }
