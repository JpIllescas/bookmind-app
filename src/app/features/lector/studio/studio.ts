import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  GeneratedContent,
  GeneratedType,
  IntentoQuiz,
  OrigenMaterial,
} from '../../../core/services/content.service';
import { Icono, NombreIcono } from '../../../shared/icono/icono';
import { Material } from '../material/material';

interface TarjetaStudio {
  tipo: GeneratedType;
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
}

/** Qué se puede generar; el orden es el de estudio: entender, nombrar, repasar, comprobar. */
const TARJETAS: TarjetaStudio[] = [
  { tipo: 'summary', titulo: 'Resumen', descripcion: 'Por capítulos, con la página de cada idea.', icono: 'documento' },
  { tipo: 'glossary', titulo: 'Glosario', descripcion: 'Conceptos que el libro repite o define.', icono: 'libro' },
  { tipo: 'flashcards', titulo: 'Flashcards', descripcion: 'Para repasar de memoria.', icono: 'tarjetas' },
  { tipo: 'quiz', titulo: 'Quiz', descripcion: 'Opción múltiple con su página.', icono: 'check' },
  { tipo: 'timeline', titulo: 'Línea de tiempo', descripcion: 'Fechas y hechos en orden.', icono: 'reloj' },
];

const ETIQUETA_ORIGEN: Record<OrigenMaterial, string> = {
  motor: 'Motor propio · sin IA externa',
  gemini: 'Motor propio · redactado con Gemini',
};

@Component({
  selector: 'app-studio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Icono, Material],
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
})
export class Studio {
  readonly materiales = input.required<GeneratedContent[]>();
  readonly generando = input<GeneratedType | null>(null);
  /** El libro aún se prepara o no tiene texto: no se puede generar nada. */
  readonly bloqueado = input(false);
  readonly puedeSaltar = input(true);

  readonly generar = output<GeneratedType>();
  readonly borrar = output<GeneratedContent>();
  readonly pagina = output<number>();
  readonly resuelto = output<{ material: GeneratedContent; intento: IntentoQuiz }>();

  readonly tarjetas = TARJETAS;

  /** Tarjeta desplegada; una a la vez para que el panel no se vuelva un rollo. */
  readonly abierta = signal<GeneratedType | null>(null);

  /** El material más reciente de cada tipo; la lista llega del más nuevo al más viejo. */
  readonly ultimoPorTipo = computed(() => {
    const porTipo = new Map<GeneratedType, GeneratedContent>();

    for (const material of this.materiales()) {
      if (!porTipo.has(material.type)) porTipo.set(material.type, material);
    }

    return porTipo;
  });

  readonly listos = computed(() => this.ultimoPorTipo().size);

  readonly progreso = computed(() => Math.round((this.listos() / TARJETAS.length) * 100));

  materialDe(tipo: GeneratedType): GeneratedContent | null {
    return this.ultimoPorTipo().get(tipo) ?? null;
  }

  origenDe(material: GeneratedContent | null): OrigenMaterial | null {
    const origen = (material?.content as { origen?: unknown } | null)?.origen;

    return origen === 'motor' || origen === 'gemini' ? origen : null;
  }

  etiquetaOrigen(material: GeneratedContent | null): string | null {
    const origen = this.origenDe(material);
    return origen ? ETIQUETA_ORIGEN[origen] : null;
  }

  /** "10 tarjetas", "5 preguntas"…: lo que hay dentro sin abrir la tarjeta. */
  cuentaDe(material: GeneratedContent | null): string | null {
    if (!material) return null;

    const contenido = material.content as Record<string, unknown> | null;
    const cuenta = (clave: string) =>
      Array.isArray(contenido?.[clave]) ? (contenido?.[clave] as unknown[]).length : 0;

    switch (material.type) {
      case 'flashcards':
        return `${cuenta('tarjetas')} tarjetas`;
      case 'quiz':
        return `${cuenta('preguntas')} preguntas`;
      case 'glossary':
        return `${cuenta('terminos')} términos`;
      case 'timeline':
        return `${cuenta('eventos')} hechos`;
      default: {
        const secciones = cuenta('secciones');
        if (secciones > 1) return `${secciones} secciones · ${cuenta('puntos')} ideas`;
        return cuenta('puntos') > 0 ? `${cuenta('puntos')} ideas clave` : 'Listo';
      }
    }
  }

  alternar(tipo: GeneratedType): void {
    this.abierta.update((actual) => (actual === tipo ? null : tipo));
  }

  /** Al generar se abre la tarjeta: el estudiante ve aparecer lo que pidió. */
  pedir(tipo: GeneratedType, evento?: Event): void {
    evento?.stopPropagation();
    this.abierta.set(tipo);
    this.generar.emit(tipo);
  }
}
