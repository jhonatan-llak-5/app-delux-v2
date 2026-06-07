import { Routes } from '@angular/router';

export const LANDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing-home/landing-home.component').then(m => m.LandingHomeComponent)
  }
];
