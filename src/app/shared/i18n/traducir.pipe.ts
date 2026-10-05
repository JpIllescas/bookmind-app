import { ChangeDetectorRef, Pipe, PipeTransform, inject } from '@angular/core';

import { IdiomaService } from '../../core/services/idioma.service';

@Pipe({ name: 'traducir', standalone: true, pure: false })
export class TraducirPipe implements PipeTransform {
  private readonly idioma = inject(IdiomaService);
  private readonly detector = inject(ChangeDetectorRef);

  transform(clave: string): string {
    this.idioma.idioma();
    this.detector.markForCheck();
    return this.idioma.traducir(clave);
  }
}
