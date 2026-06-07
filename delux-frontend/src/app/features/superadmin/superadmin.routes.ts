import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards/role.guard';

export const SUPERADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(['SUPERADMIN'])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/admin-overview/admin-overview.component').then(m => m.AdminOverviewComponent),
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./pages/brands-list/brands-list.component').then(m => m.BrandsListComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/categories-tree/categories-tree.component').then(m => m.CategoriesTreeComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/products-list/products-list.component').then(m => m.ProductsListComponent),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./pages/inventory-overview/inventory-overview.component').then(m => m.InventoryOverviewComponent),
      },
      {
        path: 'inventory/movements',
        loadComponent: () =>
          import('./pages/inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./pages/pos/pos.component').then(m => m.PosComponent),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./pages/sales-list/sales-list.component').then(m => m.SalesListComponent),
      },
      {
        path: 'sales/:id',
        loadComponent: () =>
          import('./pages/sale-detail/sale-detail.component').then(m => m.SaleDetailComponent),
      },
      {
        path: 'staff',
        loadComponent: () =>
          import('./pages/staff-list/staff-list.component').then(m => m.StaffListComponent),
      },
      {
        path: 'staff/new',
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'staff/:id',
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'schedules',
        loadComponent: () =>
          import('./pages/schedule-editor/schedule-editor.component').then(m => m.ScheduleEditorComponent),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./pages/customers-list/customers-list.component').then(m => m.CustomersListComponent),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./pages/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./pages/coupons-list/coupons-list.component').then(m => m.CouponsListComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./pages/reviews-moderation/reviews-moderation.component').then(m => m.ReviewsModerationComponent),
      },
      {
        path: 'returns',
        loadComponent: () =>
          import('./pages/returns-list/returns-list.component').then(m => m.ReturnsListComponent),
      },
      {
        path: 'shipments',
        loadComponent: () =>
          import('./pages/shipments-list/shipments-list.component').then(m => m.ShipmentsListComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/users-list/users-list.component').then(m => m.UsersListComponent),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./pages/tenants-list/tenants-list.component').then(m => m.TenantsListComponent),
      },
      {
        path: 'tenants/:slug/branches',
        loadComponent: () =>
          import('./pages/tenant-branches/tenant-branches.component').then(m => m.TenantBranchesComponent),
      },
      {
        path: 'branches/:id/catalog',
        loadComponent: () =>
          import('./pages/branch-catalog/branch-catalog.component').then(m => m.BranchCatalogComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/platform-settings/platform-settings.component').then(m => m.PlatformSettingsComponent),
      },
    ],
  },
];
