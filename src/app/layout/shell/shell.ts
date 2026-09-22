import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { DisposicionService } from '../../core/services/disposicion.service';
import { GamificacionService } from '../../core/services/gamificacion.service';
import { TemaService } from '../../core/services/tema.service';
import { Icono, NombreIcono } from '../../shared/icono/icono';

interface EntradaNav {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Cada sección tiene su color: se reconoce por el ícono antes que por el texto. */
  color: string;
}

const NAVEGACION: EntradaNav[] = [
  { ruta: '/biblioteca', etiqueta: 'Biblioteca', icono: 'biblioteca', color: 'var(--acento)' },
  { ruta: '/subir', etiqueta: 'Subir documento', icono: 'subir', color: 'var(--info)' },
  { ruta: '/asistente', etiqueta: 'Asistente IA', icono: 'asistente', color: 'var(--morado)' },
  { ruta: '/progreso', etiqueta: 'Mi progreso', icono: 'progreso', color: 'var(--exito)' },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '[class.shell--plegado]': 'plegada()',
  },
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly tema = inject(TemaService);
  private readonly disposicion = inject(DisposicionService);
  private readonly gamificacion = inject(GamificacionService);

  readonly navegacion = NAVEGACION;
  readonly usuario = this.auth.usuario;
  readonly esOscuro = this.tema.esOscuro;
  readonly plegada = this.disposicion.lateralPlegada;
  readonly racha = this.gamificacion.resumen;
  readonly progresoMeta = this.gamificacion.progresoMeta;
  readonly metaCumplida = this.gamificacion.metaCumplida;

  /** Menú del usuario (plan, tema, salir) abierto o no. */
  readonly menuAbierto = signal(false);

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

  readonly primerNombre = computed(() => this.usuario()?.name?.split(/\s+/)[0] ?? '');

  constructor() {
    this.gamificacion.cargar();
  }

  alternarLateral(): void {
    this.disposicion.alternarLateral();
    this.menuAbierto.set(false);
  }

  alternarTema(): void {
    this.tema.alternar();
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  cerrarSesion(): void {
    this.gamificacion.limpiar();
    this.auth.cerrarSesion();
  }
}
