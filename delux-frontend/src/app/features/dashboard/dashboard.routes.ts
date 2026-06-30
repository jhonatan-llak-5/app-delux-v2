import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'admin/overview' },
      {
        path: 'profile',
        loadComponent: () =>
          import('@features/profile/profile.component').then(m => m.ProfileComponent),
      },
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

      // Cuenta del cliente dentro del mismo layout de administración.
      {
        path: 'account',
        canActivate: [roleGuard(['CUSTOMER'])],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'profile' },
          { path: 'profile',   loadComponent: () => import('@features/account/pages/profile-tab/profile-tab.component').then(m => m.ProfileTabComponent) },
          { path: 'addresses', loadComponent: () => import('@features/account/pages/addresses-tab/addresses-tab.component').then(m => m.AddressesTabComponent) },
          { path: 'orders',    loadComponent: () => import('@features/account/pages/orders-tab/orders-tab.component').then(m => m.OrdersTabComponent) },
          { path: 'wishlist',  loadComponent: () => import('@features/account/pages/wishlist-tab/wishlist-tab.component').then(m => m.WishlistTabComponent) },
        ],
      },
    ]
  }
];
