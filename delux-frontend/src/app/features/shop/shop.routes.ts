import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/shop-list/shop-list.component').then(m => m.ShopListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/product/pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
  }
];
