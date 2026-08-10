import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Manda al login a quien no tenga sesión. */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.estaAutenticado()) return true;

  // Se guarda el destino para volver ahí tras iniciar sesión.
  return router.createUrlTree(['/entrar'], {
    queryParams: { destino: estado.url },
  });
};

/** Evita que alguien ya autenticado vuelva a la pantalla de login. */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.estaAutenticado() ? router.createUrlTree(['/biblioteca']) : true;
};
