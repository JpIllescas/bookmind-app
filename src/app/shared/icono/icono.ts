import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

/** Íconos de Lucide en línea; `lucide-angular` no soporta esta versión. */
export type NombreIcono =
  | 'biblioteca'
  | 'subir'
  | 'asistente'
  | 'progreso'
  | 'buscar'
  | 'mas'
  | 'flecha-izquierda'
  | 'flecha-arriba'
  | 'chevron-izquierda'
  | 'chevron-derecha'
  | 'zoom-mas'
  | 'zoom-menos'
  | 'check'
  | 'libro'
  | 'salir'
  | 'documento';

const TRAZOS: Record<NombreIcono, string> = {
  // lucide: library
  biblioteca: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  // lucide: upload
  subir:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  // lucide: sparkles
  asistente:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  // lucide: trending-up
  progreso:
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  // lucide: search
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  // lucide: plus
  mas: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  // lucide: arrow-left
  'flecha-izquierda': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  // lucide: arrow-up
  'flecha-arriba': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  // lucide: chevron-left
  'chevron-izquierda': '<path d="m15 18-6-6 6-6"/>',
  // lucide: chevron-right
  'chevron-derecha': '<path d="m9 18 6-6-6-6"/>',
  // lucide: zoom-in
  'zoom-mas':
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  // lucide: zoom-out
  'zoom-menos':
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/>',
  // lucide: check
  check: '<path d="M20 6 9 17l-5-5"/>',
  // lucide: book-open
  libro:
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  // lucide: log-out
  salir:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  // lucide: file-text
  documento:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
};

@Component({
  selector: 'app-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Decorativo por defecto: el texto que lo acompaña ya dice qué es.
    '[attr.aria-hidden]': 'etiqueta() ? null : "true"',
    '[attr.role]': 'etiqueta() ? "img" : null',
    '[attr.aria-label]': 'etiqueta()',
  },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="tamano()"
      [attr.height]="tamano()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="grosor()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [innerHTML]="trazos()"
    ></svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
  readonly tamano = input(18);
  readonly grosor = input(2);
  /** Solo si el ícono dice algo que el texto no. */
  readonly etiqueta = input<string>();

  private readonly sanitizer = inject(DomSanitizer);

  // Los trazos son constantes del código, nunca entrada del usuario.
  readonly trazos = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(TRAZOS[this.nombre()]),
  );
}
