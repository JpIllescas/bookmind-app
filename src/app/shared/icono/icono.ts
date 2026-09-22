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
  | 'documento'
  | 'sol'
  | 'luna'
  | 'panel-izquierdo'
  | 'panel-derecho'
  | 'copiar'
  | 'refrescar'
  | 'detener'
  | 'cerrar'
  | 'papelera'
  | 'chevron-abajo'
  | 'chevron-arriba'
  | 'lista'
  | 'reloj'
  | 'tarjetas'
  | 'escudo'
  | 'alerta'
  | 'nota'
  | 'flecha-derecha'
  | 'externo'
  | 'ajustes'
  | 'brillo'
  | 'candado'
  | 'corona'
  | 'llama'
  | 'estrella'
  | 'llama'
  | 'estrella';

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
  // lucide: sun
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  // lucide: moon
  luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  // lucide: panel-left
  'panel-izquierdo':
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  // lucide: panel-right
  'panel-derecho':
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  // lucide: copy
  copiar:
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  // lucide: refresh-cw
  refrescar:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  // lucide: square
  detener: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  // lucide: x
  cerrar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  // lucide: trash-2
  papelera:
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  // lucide: chevron-down
  'chevron-abajo': '<path d="m6 9 6 6 6-6"/>',
  // lucide: chevron-up
  'chevron-arriba': '<path d="m18 15-6-6-6 6"/>',
  // lucide: list
  lista:
    '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  // lucide: clock
  reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  // lucide: layers
  tarjetas:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  // lucide: shield-check
  escudo:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  // lucide: triangle-alert
  alerta:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  // lucide: sticky-note
  nota:
    '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
  // lucide: arrow-right
  'flecha-derecha': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  // lucide: external-link
  externo:
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  // lucide: settings-2
  ajustes:
    '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  // lucide: lock
  candado:
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  // lucide: crown
  corona:
    '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
  // lucide: flame
  llama:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  // lucide: star
  estrella:
    '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  // lucide: sparkle
  brillo:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
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
