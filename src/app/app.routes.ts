import { Routes } from '@angular/router';

import { authGuard, invitadoGuard, preferenciasGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'entrar',
    canActivate: [invitadoGuard],
    title: 'Entrar · BookMind AI',
    loadComponent: () => import('./features/entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'biblioteca' },
      {
        path: 'preferencias',
        title: 'Tu plan de estudio · BookMind AI',
        loadComponent: () => import('./features/preferencias/preferencias').then((m) => m.Preferencias),
      },
      {
        path: 'biblioteca',
        canActivate: [preferenciasGuard],
        title: 'Biblioteca · BookMind AI',
        loadComponent: () =>
          import('./features/biblioteca/biblioteca').then((m) => m.Biblioteca),
      },
      {
        path: 'subir',
        canActivate: [preferenciasGuard],
        title: 'Subir documento · BookMind AI',
        loadComponent: () => import('./features/subir/subir').then((m) => m.Subir),
      },
      {
        path: 'lector/:id',
        canActivate: [preferenciasGuard],
        title: 'Lector · BookMind AI',
        loadComponent: () => import('./features/lector/lector').then((m) => m.Lector),
      },
      {
        path: 'asistente',
        canActivate: [preferenciasGuard],
        title: 'Asistente · BookMind AI',
        loadComponent: () =>
          import('./features/pendiente/pendiente').then((m) => m.Pendiente),
        data: {
          titulo: 'Asistente IA',
          descripcion:
            'El motor conversacional todavía no está conectado. La decisión ' +
            'entre Gemini y Ollama sigue abierta.',
        },
      },
      {
        path: 'progreso',
        canActivate: [preferenciasGuard],
        title: 'Mi progreso · BookMind AI',
        loadComponent: () =>
          import('./features/progreso/progreso').then((m) => m.Progreso),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
