import type { GeneratedType, OrigenMaterial } from '../../../core/services/content.service';

const ETIQUETA_ORIGEN: Record<OrigenMaterial, string> = {
  motor: 'Motor propio · sin IA externa',
  gemini: 'Motor propio · redactado con Gemini',
};

/** Los mapas no pasan por el motor: decir "Motor propio" sería atribuirle lo que hizo Gemini. */
const SOLO_GEMINI: GeneratedType[] = ['mind_map', 'concept_map'];

export function etiquetaDeOrigen(tipo: GeneratedType, origen: OrigenMaterial | null): string | null {
  if (!origen) return null;
  if (origen === 'gemini' && SOLO_GEMINI.includes(tipo)) return 'Hecho con Gemini';
  return ETIQUETA_ORIGEN[origen];
}
