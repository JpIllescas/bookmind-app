import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProgressSummary, StudyPlan } from '../../core/models/documento.model';
import { StudyService } from '../../core/services/study.service';

@Component({ selector: 'app-progreso', changeDetection: ChangeDetectionStrategy.OnPush, imports: [FormsModule, RouterLink], templateUrl: './progreso.html', styleUrl: './progreso.scss' })
export class Progreso {
  private readonly api = inject(StudyService);
  readonly resumen = signal<ProgressSummary | null>(null); readonly planes = signal<StudyPlan[]>([]); readonly error = signal<string | null>(null);
  readonly nuevoTitulo = signal(''); readonly nuevaFecha = signal('');
  constructor() { this.cargar(); }
  cargar() { this.api.progreso().subscribe({ next: (v) => this.resumen.set(v), error: () => this.error.set('No se pudo cargar tu progreso.') }); this.api.planes().subscribe({ next: (v) => this.planes.set(v) }); }
  crearPlan() { const title = this.nuevoTitulo().trim(); if (!title) return; this.api.crearPlan(title, this.nuevaFecha() || undefined, []).subscribe({ next: (p) => { this.planes.update((v) => [p, ...v]); this.nuevoTitulo.set(''); this.nuevaFecha.set(''); } }); }
  completar(plan: StudyPlan, index: number) { this.api.completarTarea(plan.id, index).subscribe({ next: (p) => this.planes.update((v) => v.map((x) => x.id === p.id ? p : x)) }); }
  actualizarLibro(id: string, event: Event) { this.api.actualizarProgreso(id, Number((event.target as HTMLInputElement).value)).subscribe({ next: () => this.cargar() }); }
  generarPlan(documentId: string) { this.api.generarPlan(documentId).subscribe({ next: (plan) => this.planes.update((v) => [plan, ...v]), error: () => this.error.set('No se pudo generar el plan con IA.') }); }
  cambiarTitulo(e: Event) { this.nuevoTitulo.set((e.target as HTMLInputElement).value); }
  cambiarFecha(e: Event) { this.nuevaFecha.set((e.target as HTMLInputElement).value); }
}
