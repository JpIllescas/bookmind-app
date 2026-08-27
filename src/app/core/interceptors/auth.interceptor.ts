import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { NotificacionesService } from '../services/notificaciones.service';

/** Adjunta el JWT y cierra la sesión si el backend lo rechaza. */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);
  const notificaciones = inject(NotificacionesService);
  const token = auth.token;

  const conCredenciales = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(conCredenciales).pipe(
    catchError((error: HttpErrorResponse) => {
      // Sin token, un 401 es "credenciales malas", no "sesión vencida".
      if (error.status === 401 && token) {
        auth.cerrarSesion();
      }
      if (error.status !== 401) {
        const mensaje = typeof error.error?.message === 'string'
          ? error.error.message
          : 'Ocurrió un error. Intenta de nuevo.';
        notificaciones.error(mensaje);
      }
      return throwError(() => error);
    }),
  );
};
