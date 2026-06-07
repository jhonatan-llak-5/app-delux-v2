import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  // Landing + shop + product + contact (públicos, layout dark premium)
  {
    path: '',
    loadComponent: () =>
      import('./core/layouts/public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES),
      },
      {
        path: 'shop',
        loadChildren: () =>
          import('./features/shop/shop.routes').then(m => m.SHOP_ROUTES),
      },
      {
        path: 'product',
        loadChildren: () =>
          import('./features/product/product.routes').then(m => m.PRODUCT_ROUTES),
      },
      {
        path: 'contact',
        loadChildren: () =>
          import('./features/contact/contact.routes').then(m => m.CONTACT_ROUTES),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/checkout/pages/cart-page/cart-page.component').then(m => m.CartPageComponent),
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./features/checkout/pages/checkout-page/checkout-page.component').then(m => m.CheckoutPageComponent),
      },
      {
        path: 'checkout/payphone/sandbox',
        loadComponent: () =>
          import('./features/checkout/pages/payphone-sandbox/payphone-sandbox.component').then(m => m.PayPhoneSandboxComponent),
      },
      {
        path: 'checkout/result',
        loadComponent: () =>
          import('./features/checkout/pages/checkout-result/checkout-result.component').then(m => m.CheckoutResultComponent),
      },
      {
        path: 'account',
        loadChildren: () =>
          import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
      },
      {
        path: 'tracking',
        loadComponent: () =>
          import('./features/checkout/pages/tracking-page/tracking-page.component').then(m => m.TrackingPageComponent),
      },
      {
        path: 'tracking/:code',
        loadComponent: () =>
          import('./features/checkout/pages/tracking-page/tracking-page.component').then(m => m.TrackingPageComponent),
      },
    ],
  },

  // Dashboard administrativo
  {
    path: 'app',
    loadComponent: () =>
      import('./core/layouts/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
  },

  // Auth
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  { path: '**', redirectTo: '' },
];
