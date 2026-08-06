import { Routes } from '@angular/router';
import { roleGuard } from '@core/guards/role.guard';

// Conjuntos de roles reutilizables (deben coincidir con el backend):
//   MANAGER = Superadmin + Gerente (acceso total, incl. configuración/finanzas)
//   SALES   = MANAGER + Vendedor (ventas, devoluciones, cupones, gastos)
//   STAFF   = SALES + Bodeguero (inventario, productos, proveedores, categorías, marcas, etiquetas)
const MANAGER: any = ['SUPERADMIN', 'BRANCH_MANAGER'];
const SALES: any = ['SUPERADMIN', 'BRANCH_MANAGER', 'SALESPERSON'];
const STAFF: any = ['SUPERADMIN', 'BRANCH_MANAGER', 'SALESPERSON', 'WAREHOUSE'];

export const SUPERADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(STAFF)],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/admin-overview/admin-overview.component').then(m => m.AdminOverviewComponent),
      },
      {
        path: 'brands',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/brands-list/brands-list.component').then(m => m.BrandsListComponent),
      },
      {
        path: 'categories',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/categories-tree/categories-tree.component').then(m => m.CategoriesTreeComponent),
      },
      // Módulo antiguo de Productos eliminado: el catálogo se gestiona desde
      // Inventario. Se conserva 'products/:id' (editor usado por Inventario) y
      // se redirige el listado antiguo a Inventario por compatibilidad de enlaces.
      { path: 'products', pathMatch: 'full', redirectTo: 'inventory' },
      { path: 'products/new', pathMatch: 'full', redirectTo: 'inventory' },
      { path: 'products/import', pathMatch: 'full', redirectTo: 'inventory' },
      {
        path: 'products/:id',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/product-edit/product-edit.component').then(m => m.ProductEditComponent),
      },
      {
        path: 'labels',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/labels/labels.component').then(m => m.LabelsComponent),
      },
      {
        path: 'inventory',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/inventory-overview/inventory-overview.component').then(m => m.InventoryOverviewComponent),
      },
      {
        path: 'inventory/reception',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/reception/reception.component').then(m => m.ReceptionComponent),
      },
      {
        path: 'inventory/receptions',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/receptions-list/receptions-list.component').then(m => m.ReceptionsListComponent),
      },
      {
        path: 'inventory/suppliers',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/suppliers-list/suppliers-list.component').then(m => m.SuppliersListComponent),
      },
      {
        path: 'inventory/movements',
        canActivate: [roleGuard(STAFF)],
        loadComponent: () =>
          import('./pages/inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent),
      },
      {
        path: 'seller',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/seller-dashboard/seller-dashboard.component').then(m => m.SellerDashboardComponent),
      },
      {
        path: 'pos',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/pos/pos.component').then(m => m.PosComponent),
      },
      {
        path: 'sales',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/sales-list/sales-list.component').then(m => m.SalesListComponent),
      },
      {
        path: 'sales/:id',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/sale-detail/sale-detail.component').then(m => m.SaleDetailComponent),
      },
      { path: 'staff', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'staff/new',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'staff/:id',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/staff-form/staff-form.component').then(m => m.StaffFormComponent),
      },
      {
        path: 'schedules',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/schedule-editor/schedule-editor.component').then(m => m.ScheduleEditorComponent),
      },
      {
        path: 'customers',
        pathMatch: 'full',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/customers-list/customers-list.component').then(m => m.CustomersListComponent),
      },
      {
        path: 'customers/:id',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
      },
      {
        path: 'coupons',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/coupons-list/coupons-list.component').then(m => m.CouponsListComponent),
      },
      {
        path: 'reports',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/reports-dashboard/reports-dashboard.component').then(m => m.ReportsDashboardComponent),
      },
      {
        path: 'reviews',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/reviews-moderation/reviews-moderation.component').then(m => m.ReviewsModerationComponent),
      },
      {
        path: 'returns',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/returns-list/returns-list.component').then(m => m.ReturnsListComponent),
      },
      {
        path: 'shipments',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/shipments-list/shipments-list.component').then(m => m.ShipmentsListComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard(MANAGER)],
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
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/tenants-list/tenants-list.component').then(m => m.TenantsListComponent),
      },
      {
        path: 'tenants/:slug/branches',
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/tenant-branches/tenant-branches.component').then(m => m.TenantBranchesComponent),
      },
      {
        path: 'branches/:id/catalog',
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/branch-catalog/branch-catalog.component').then(m => m.BranchCatalogComponent),
      },
      {
        path: 'affiliates',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/affiliates-admin/affiliates-admin.component').then(m => m.AffiliatesAdminComponent),
      },
      {
        path: 'affiliates/reporte',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/affiliate-report/affiliate-report.component').then(m => m.AffiliateReportComponent),
      },
      {
        path: 'subscribers',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/newsletter-subscribers/newsletter-subscribers.component').then(m => m.NewsletterSubscribersComponent),
      },
      {
        path: 'messages',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/contact-messages/contact-messages.component').then(m => m.ContactMessagesComponent),
      },
      {
        path: 'finanzas',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/finanzas-resumen/finanzas-resumen.component').then(m => m.FinanzasResumenComponent),
      },
      {
        path: 'gastos',
        canActivate: [roleGuard(SALES)],
        loadComponent: () =>
          import('./pages/gastos-list/gastos-list.component').then(m => m.GastosListComponent),
      },
      {
        path: 'payroll',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/payroll-list/payroll-list.component').then(m => m.PayrollListComponent),
      },
      {
        path: 'payroll/reporte',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/payroll-report/payroll-report.component').then(m => m.PayrollReportComponent),
      },
      {
        path: 'payroll/:id',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/payroll-detail/payroll-detail.component').then(m => m.PayrollDetailComponent),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['SUPERADMIN'])],
        loadComponent: () =>
          import('./pages/platform-settings/platform-settings.component').then(m => m.PlatformSettingsComponent),
      },
      {
        path: 'store-config',
        canActivate: [roleGuard(MANAGER)],
        loadComponent: () =>
          import('./pages/store-config/store-config.component').then(m => m.StoreConfigComponent),
      },
    ],
  },
];
