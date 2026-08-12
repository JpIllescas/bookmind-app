import { Routes } from '@angular/router';

import { authGuard, invitadoGuard } from './core/guards/auth.guard';

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
        path: 'biblioteca',
        title: 'Biblioteca · BookMind AI',
        loadComponent: () =>
          import('./features/biblioteca/biblioteca').then((m) => m.Biblioteca),
      },
      {
        path: 'subir',
        title: 'Subir documento · BookMind AI',
        loadComponent: () => import('./features/subir/subir').then((m) => m.Subir),
      },
      {
        path: 'lector/:id',
        title: 'Lector · BookMind AI',
        loadComponent: () => import('./features/lector/lector').then((m) => m.Lector),
      },
      {
        path: 'asistente',
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
        title: 'Mi progreso · BookMind AI',
        loadComponent: () =>
          import('./features/pendiente/pendiente').then((m) => m.Pendiente),
        data: {
          titulo: 'Mi progreso',
          descripcion: 'Requiere persistir el avance de lectura por documento.',
        },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
