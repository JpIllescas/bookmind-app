import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PreferenciasEstudio } from '../../core/models/documento.model';

type Campo = keyof PreferenciasEstudio;
interface Opcion { valor: string; titulo: string; descripcion: string; }

const PREGUNTAS: { campo: Campo; pregunta: string; ayuda: string; opciones: Opcion[] }[] = [
  { campo: 'estilo', pregunta: '¿Qué estilo tienes para estudiar?', ayuda: 'Elige la forma que más te ayuda a entender.', opciones: [
    { valor: 'visual', titulo: 'Visual', descripcion: 'Esquemas, colores y mapas mentales' },
    { valor: 'practico', titulo: 'Práctico', descripcion: 'Ejercicios y ejemplos paso a paso' },
    { valor: 'lectura', titulo: 'Lectura', descripcion: 'Explicaciones, textos y resúmenes' },
    { valor: 'mixto', titulo: 'Un poco de todo', descripcion: 'Combino distintas formas' },
  ]},
  { campo: 'duracion', pregunta: '¿Cuánto tiempo prefieres estudiar?', ayuda: 'Adaptaremos cada sesión a tu disponibilidad.', opciones: [
    { valor: 'corta', titulo: '15–25 minutos', descripcion: 'Sesiones breves y enfocadas' },
    { valor: 'media', titulo: '25–45 minutos', descripcion: 'Un ritmo equilibrado' },
    { valor: 'larga', titulo: '45–60 minutos', descripcion: 'Sesiones profundas' },
  ]},
  { campo: 'objetivo', pregunta: '¿Qué quieres conseguir?', ayuda: 'Así priorizamos el tipo de actividades.', opciones: [
    { valor: 'comprender', titulo: 'Comprender', descripcion: 'Entender conceptos y conexiones' },
    { valor: 'memorizar', titulo: 'Memorizar', descripcion: 'Recordar datos y definiciones' },
    { valor: 'examen', titulo: 'Preparar un examen', descripcion: 'Practicar y detectar errores' },
    { valor: 'repasar', titulo: 'Repasar', descripcion: 'Reforzar lo que ya aprendí' },
  ]},
  { campo: 'ritmo', pregunta: '¿A qué ritmo quieres avanzar?', ayuda: 'Podrás cambiarlo cuando quieras.', opciones: [
    { valor: 'tranquilo', titulo: 'Tranquilo', descripcion: 'Poco contenido nuevo y más repasos' },
    { valor: 'equilibrado', titulo: 'Equilibrado', descripcion: 'Contenido nuevo y práctica' },
    { valor: 'intensivo', titulo: 'Intensivo', descripcion: 'Avanzar rápido hacia mi meta' },
  ]},
];

@Component({
  selector: 'app-preferencias', changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferencias.html', styleUrl: './preferencias.scss',
})
export class Preferencias {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly preguntas = PREGUNTAS;
  readonly paso = signal(0);
  readonly respuestas = signal<Partial<PreferenciasEstudio>>({});
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.auth.obtenerPreferencias().subscribe({
      next: (preferencias) => {
        if (preferencias) this.respuestas.set(preferencias);
      },
    });
  }

  seleccionar(valor: string): void {
    const pregunta = this.preguntas[this.paso()];
    this.respuestas.update((actual) => ({ ...actual, [pregunta.campo]: valor }));
  }

  siguiente(): void {
    if (!this.seleccionActual()) return;
    if (this.paso() < this.preguntas.length - 1) this.paso.update((paso) => paso + 1);
    else this.guardar();
  }

  anterior(): void { if (this.paso() > 0) this.paso.update((paso) => paso - 1); }

  seleccionActual(): string | undefined {
    return this.respuestas()[this.preguntas[this.paso()].campo] as string | undefined;
  }

  guardar(): void {
    if (this.guardando()) return;
    this.guardando.set(true); this.error.set(null);
    this.auth.guardarPreferencias(this.respuestas() as PreferenciasEstudio).subscribe({
      next: () => void this.router.navigate(['/biblioteca']),
      error: () => { this.error.set('No pudimos guardar tus preferencias. Intenta de nuevo.'); this.guardando.set(false); },
    });
  }
}
