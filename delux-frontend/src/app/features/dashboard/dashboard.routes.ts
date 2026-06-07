import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent)
      },
      // Stubs lazy — cada sprint los irá completando
      { path: 'orders',    loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'products',  loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'inventory', loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'coupons',   loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'branches',  loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'sales',     loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'customers', loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'reports',   loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'marketing', loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'settings',  loadComponent: () => import('./pages/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },

      // Superadmin (panel global multi-tenant)
      {
        path: 'admin',
        loadChildren: () =>
          import('@features/superadmin/superadmin.routes').then(m => m.SUPERADMIN_ROUTES),
      },
    ]
  }
];
