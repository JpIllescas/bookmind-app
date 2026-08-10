import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RespuestaAuth, Usuario } from '../models/documento.model';

const CLAVE_TOKEN = 'bookmind.token';
const CLAVE_USUARIO = 'bookmind.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Desde localStorage para que recargar no cierre la sesión. */
  private readonly usuarioActual = signal<Usuario | null>(this.leerUsuarioGuardado());

  readonly usuario = this.usuarioActual.asReadonly();
  readonly estaAutenticado = computed(() => this.usuarioActual() !== null);

  get token(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  login(email: string, password: string): Observable<RespuestaAuth> {
    return this.http
      .post<RespuestaAuth>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((respuesta) => this.guardarSesion(respuesta)));
  }

  registrar(email: string, password: string, name: string): Observable<RespuestaAuth> {
    return this.http
      .post<RespuestaAuth>(`${environment.apiUrl}/auth/register`, {
        email,
        password,
        name,
      })
      .pipe(tap((respuesta) => this.guardarSesion(respuesta)));
  }

  cerrarSesion(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    this.usuarioActual.set(null);
    void this.router.navigate(['/entrar']);
  }

  private guardarSesion(respuesta: RespuestaAuth): void {
    localStorage.setItem(CLAVE_TOKEN, respuesta.token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(respuesta.user));
    this.usuarioActual.set(respuesta.user);
  }

  private leerUsuarioGuardado(): Usuario | null {
    const crudo = localStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return null;

    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      // Dato corrupto: se descarta en vez de romper el arranque.
      localStorage.removeItem(CLAVE_USUARIO);
      return null;
    }
  }
}
