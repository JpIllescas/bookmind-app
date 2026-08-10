import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Icono, NombreIcono } from '../../shared/icono/icono';

interface EntradaNav {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
}

const NAVEGACION: EntradaNav[] = [
  { ruta: '/biblioteca', etiqueta: 'Biblioteca', icono: 'biblioteca' },
  { ruta: '/subir', etiqueta: 'Subir documento', icono: 'subir' },
  { ruta: '/asistente', etiqueta: 'Asistente IA', icono: 'asistente' },
  { ruta: '/progreso', etiqueta: 'Mi progreso', icono: 'progreso' },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);

  readonly navegacion = NAVEGACION;
  readonly usuario = this.auth.usuario;

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.name ?? '';
    return (
      nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  });

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
