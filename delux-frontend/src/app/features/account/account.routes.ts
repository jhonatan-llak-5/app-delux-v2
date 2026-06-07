import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/account-shell/account-shell.component').then(m => m.AccountShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile-tab/profile-tab.component').then(m => m.ProfileTabComponent),
      },
      {
        path: 'addresses',
        loadComponent: () =>
          import('./pages/addresses-tab/addresses-tab.component').then(m => m.AddressesTabComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/orders-tab/orders-tab.component').then(m => m.OrdersTabComponent),
      },
      {
        path: 'wishlist',
        loadComponent: () =>
          import('./pages/wishlist-tab/wishlist-tab.component').then(m => m.WishlistTabComponent),
      },
    ],
  },
];
