import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // `withComponentInputBinding`: el `data` de la ruta llega como input.
    provideRouter(routes, withComponentInputBinding()),

    // XHR y no fetch (el predeterminado de Angular 22): fetch no informa el avance de una subida.
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
  ],
};
