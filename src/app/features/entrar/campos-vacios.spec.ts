import { describe, expect, it } from 'vitest';

import { mensajeDeCamposVacios } from './campos-vacios';

describe('mensajeDeCamposVacios', () => {
  it('con el formulario vacío pide los dos datos, no habla del formato del correo', () => {
    expect(mensajeDeCamposVacios('entrar', { email: '', password: '', nombre: '' })).toBe('Escribe tu correo y tu contraseña.');
  });

  it('dice cuál falta', () => {
    expect(mensajeDeCamposVacios('entrar', { email: 'a@b.com', password: '', nombre: '' })).toBe('Escribe tu contraseña.');
    expect(mensajeDeCamposVacios('entrar', { email: '  ', password: 'x', nombre: '' })).toBe('Escribe tu correo.');
  });

  it('al registrarse también pide el nombre', () => {
    expect(mensajeDeCamposVacios('registrar', { email: 'a@b.com', password: 'x', nombre: ' ' })).toBe(
      'Escribe tu nombre para crear la cuenta.',
    );
  });

  it('completo, no hay nada que avisar', () => {
    expect(mensajeDeCamposVacios('entrar', { email: 'a@b.com', password: 'x', nombre: '' })).toBeNull();
  });
});
