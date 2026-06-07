import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/shop-list/shop-list.component').then(m => m.ShopListComponent)
  }
];
