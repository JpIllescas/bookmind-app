import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/services/auth.service';
import { Entrar } from './entrar';

type ConGoogle = { google?: unknown };

describe('Entrar con Google', () => {
  let alElegirCuenta: (respuesta: { credential: string }) => void;
  let loginConGoogle: ReturnType<typeof vi.fn>;
  let login: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    (window as ConGoogle).google = {
      accounts: {
        id: {
          initialize: (opciones: { callback: typeof alElegirCuenta }) => (alElegirCuenta = opciones.callback),
          renderButton: () => undefined,
        },
      },
    };
    loginConGoogle = vi.fn(() => of({}));
    login = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { loginConGoogle, login, usuario: () => ({ preferenceCompleted: true }) },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    delete (window as ConGoogle).google;
  });

  it('entra con la cuenta elegida aunque el correo y la contraseña estén vacíos', async () => {
    const fixture = TestBed.createComponent(Entrar);
    await fixture.whenStable();

    alElegirCuenta({ credential: 'token-de-google' });

    expect(loginConGoogle).toHaveBeenCalledWith('token-de-google');
    expect(fixture.componentInstance.error()).toBeNull();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/biblioteca');
  });

  it('el formulario vacío sigue pidiendo el correo y la contraseña', async () => {
    const fixture = TestBed.createComponent(Entrar);
    await fixture.whenStable();

    fixture.componentInstance.enviar();

    expect(login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toBe('Escribe tu correo y tu contraseña.');
  });
});
