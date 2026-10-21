import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Documento } from '../../../core/models/documento.model';
import { DocumentosService } from '../../../core/services/documentos.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { RenombrarLibro } from './renombrar-libro';

const LIBRO = { id: 'doc-1', title: 'DBS 01 09', author: null, progress: 59 } as Documento;

describe('Renombrar un libro', () => {
  let fixture: ComponentFixture<RenombrarLibro>;
  let renombrar: ReturnType<typeof vi.fn>;
  let notificaciones: { exito: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let guardado: Documento[];
  let cancelado: number;

  const campos = () => fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
  const escribir = (campo: HTMLInputElement, valor: string) => {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const enviar = () => fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

  beforeEach(() => {
    renombrar = vi.fn((_id: string, cambios: { titulo: string; autor: string | null }) =>
      of({ ...LIBRO, title: cambios.titulo, author: cambios.autor }),
    );
    notificaciones = { exito: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RenombrarLibro],
      providers: [
        { provide: DocumentosService, useValue: { renombrar } },
        { provide: NotificacionesService, useValue: notificaciones },
      ],
    });
    fixture = TestBed.createComponent(RenombrarLibro);
    fixture.componentRef.setInput('libro', LIBRO);
    guardado = [];
    cancelado = 0;
    fixture.componentInstance.guardado.subscribe((d) => guardado.push(d));
    fixture.componentInstance.cancelado.subscribe(() => cancelado++);
    fixture.detectChanges();
  });

  it('arranca con el nombre actual y guarda el nuevo con su autor', () => {
    const [titulo, autor] = campos();
    expect(titulo.value).toBe('DBS 01 09');

    escribir(titulo, '  Dragon Ball Super 1 ');
    escribir(autor, 'Akira Toriyama');
    enviar();

    expect(renombrar).toHaveBeenCalledWith('doc-1', { titulo: 'Dragon Ball Super 1', autor: 'Akira Toriyama' });
    expect(guardado[0]).toMatchObject({ id: 'doc-1', title: 'Dragon Ball Super 1', author: 'Akira Toriyama', progress: 59 });
  });

  it('no manda un título vacío y explica qué hacer', () => {
    escribir(campos()[0], '   ');
    enviar();

    expect(renombrar).not.toHaveBeenCalled();
    expect(notificaciones.error).toHaveBeenCalledWith(expect.stringContaining('no puede quedar vacío'));
  });

  it('sin cambios no llama al servidor: solo cierra', () => {
    enviar();

    expect(renombrar).not.toHaveBeenCalled();
    expect(cancelado).toBe(1);
  });

  it('Esc cancela', () => {
    fixture.nativeElement.querySelector('form').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelado).toBe(1);
  });

  it('si el servidor falla, el formulario sigue abierto y se avisa', () => {
    renombrar.mockReturnValue(throwError(() => new Error('sin red')));
    escribir(campos()[0], 'Otro nombre');
    enviar();

    expect(guardado).toEqual([]);
    expect(notificaciones.error).toHaveBeenCalledWith(expect.stringContaining('No se pudo cambiar el nombre'));
    expect(fixture.componentInstance.guardando()).toBe(false);
  });
});
