import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards/role.guard';

export const SUPERADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'SALESPERSON'])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/admin-overview/admin-overview.component').then(m => m.AdminOverviewComponent),
      },
      {
        path: 'brands',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
        loadComponent: () =>
          import('./pages/brands-list/brands-list.component').then(m => m.BrandsListComponent),
      },
      {
        path: 'categories',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
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
        path: 'products/import',
        loadComponent: () =>
          import('./pages/products-import/products-import.component').then(m => m.ProductsImportComponent),
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
        path: 'inventory/reception',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/reception/reception.component').then(m => m.ReceptionComponent),
      },
      {
        path: 'inventory/receptions',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/receptions-list/receptions-list.component').then(m => m.ReceptionsListComponent),
      },
      {
        path: 'inventory/suppliers',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/suppliers-list/suppliers-list.component').then(m => m.SuppliersListComponent),
      },
      {
        path: 'inventory/movements',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
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
        path: 'sales/:id/voucher',
        loadComponent: () =>
          import('./pages/voucher-preview/voucher-preview.component').then(m => m.VoucherPreviewComponent),
      },
      { path: 'staff', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'staff/new',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'staff/:id',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'schedules',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/schedule-editor/schedule-editor.component').then(m => m.ScheduleEditorComponent),
      },
      { path: 'customers', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./pages/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
      },
      {
        path: 'coupons',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
        loadComponent: () =>
          import('./pages/coupons-list/coupons-list.component').then(m => m.CouponsListComponent),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
      },
      {
        path: 'reviews',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/reviews-moderation/reviews-moderation.component').then(m => m.ReviewsModerationComponent),
      },
      {
        path: 'returns',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/returns-list/returns-list.component').then(m => m.ReturnsListComponent),
      },
      {
        path: 'shipments',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/shipments-list/shipments-list.component').then(m => m.ShipmentsListComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'])],
        loadComponent: () =>
          import('./pages/users-hub/users-hub.component').then(m => m.UsersHubComponent),
      },
      {
        path: 'sucursales',
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/tenant-branches/tenant-branches.component').then(m => m.TenantBranchesComponent),
      },
      {
        path: 'tenants',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
        loadComponent: () =>
          import('./pages/tenants-list/tenants-list.component').then(m => m.TenantsListComponent),
      },
      {
        path: 'tenants/:slug/branches',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
        loadComponent: () =>
          import('./pages/tenant-branches/tenant-branches.component').then(m => m.TenantBranchesComponent),
      },
      {
        path: 'branches/:id/catalog',
        canActivate: [roleGuard(['SUPERADMIN', 'TENANT_ADMIN'])],
        loadComponent: () =>
          import('./pages/branch-catalog/branch-catalog.component').then(m => m.BranchCatalogComponent),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/platform-settings/platform-settings.component').then(m => m.PlatformSettingsComponent),
      },
    ],
  },
];
