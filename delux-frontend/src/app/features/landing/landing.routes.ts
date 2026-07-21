import { Routes } from '@angular/router';

export const LANDING_ROUTES: Routes = [
  {
    path: '',
    data: { section: 'inicio' },
    loadComponent: () =>
      import('./pages/landing-home/landing-home.component').then(m => m.LandingHomeComponent),
  },
  {
    path: 'nosotros',
    data: { section: 'nosotros' },
    loadComponent: () =>
      import('./pages/landing-home/landing-home.component').then(m => m.LandingHomeComponent),
  },
  {
    path: 'ventas',
    data: { section: 'ventas' },
    loadComponent: () =>
      import('./pages/landing-home/landing-home.component').then(m => m.LandingHomeComponent),
  },
];
