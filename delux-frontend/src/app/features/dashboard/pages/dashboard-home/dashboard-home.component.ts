import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiKpiCardComponent } from '@shared/components/ui-kpi-card/ui-kpi-card.component';

interface Row {
  id: string;
  customer: string;
  product: string;
  branch: string;
  total: number;
  status: 'Pagado' | 'Pendiente' | 'Enviado' | 'Cancelado';
}

@Component({
  selector: 'dlx-dashboard-home',
  standalone: true,
  imports: [CommonModule, UiKpiCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-end justify-between mb-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Hola, Yessenia 👋</h1>
        <p class="text-slate-500 text-sm mt-1">Resumen de la operación de hoy — Delux multi-sucursal.</p>
      </div>
      <div class="hidden md:flex gap-2">
        <button class="btn-secondary">Exportar</button>
        <button class="btn-primary">Nuevo producto</button>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <dlx-ui-kpi-card label="Ventas hoy"       value="$12,480" [delta]="12.4"
                       icon="fa-dollar-sign"   iconBg="bg-emerald-100 text-emerald-600" />
      <dlx-ui-kpi-card label="Pedidos"          value="184"     [delta]="6.1"
                       icon="fa-cart-shopping" iconBg="bg-sky-100 text-sky-600" />
      <dlx-ui-kpi-card label="Clientes nuevos"  value="42"      [delta]="-2.3"
                       icon="fa-users"         iconBg="bg-violet-100 text-violet-600" />
      <dlx-ui-kpi-card label="SKUs bajos stock" value="9"       [delta]="3.0"
                       icon="fa-box"           iconBg="bg-amber-100 text-amber-600" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="card p-5 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold">Ventas últimos 30 días</h3>
            <p class="text-sm text-slate-500">Web + POS · Todas las sucursales</p>
          </div>
          <button class="text-slate-400 hover:text-slate-600" aria-label="Más opciones">
            <i class="fa-solid fa-ellipsis"></i>
          </button>
        </div>
        <div class="h-64 rounded-xl bg-gradient-to-tr from-slate-50 to-slate-100 grid place-items-center text-slate-400">
          <div class="text-center">
            <i class="fa-solid fa-arrow-trend-up text-3xl opacity-50"></i>
            <p class="text-xs mt-2">Gráfico de área con Chart.js</p>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <h3 class="font-semibold mb-1">Top sucursales</h3>
        <p class="text-sm text-slate-500 mb-4">Ventas del mes</p>
        <ul class="space-y-3">
          @for (b of topBranches; track b.name) {
            <li class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center text-xs font-bold">{{ b.code }}</div>
              <div class="flex-1">
                <p class="text-sm font-medium">{{ b.name }}</p>
                <div class="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div class="h-full bg-ink-900" [style.width.%]="b.percent"></div>
                </div>
              </div>
              <span class="text-sm font-semibold">\${{ b.amount }}</span>
            </li>
          }
        </ul>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="p-5 flex items-center justify-between border-b border-slate-200">
        <div>
          <h3 class="font-semibold">Últimos pedidos</h3>
          <p class="text-sm text-slate-500">Pedidos web y POS de las últimas 24h.</p>
        </div>
        <button class="btn-secondary text-sm">Ver todos</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr class="text-left">
              <th class="px-5 py-3 font-semibold">Pedido</th>
              <th class="px-5 py-3 font-semibold">Cliente</th>
              <th class="px-5 py-3 font-semibold">Producto</th>
              <th class="px-5 py-3 font-semibold">Sucursal</th>
              <th class="px-5 py-3 font-semibold text-right">Total</th>
              <th class="px-5 py-3 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (r of orders; track r.id) {
              <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 font-mono text-xs text-slate-500">#{{ r.id }}</td>
                <td class="px-5 py-3">{{ r.customer }}</td>
                <td class="px-5 py-3 text-slate-600">{{ r.product }}</td>
                <td class="px-5 py-3 text-slate-600">{{ r.branch }}</td>
                <td class="px-5 py-3 text-right font-semibold">\${{ r.total }}</td>
                <td class="px-5 py-3">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-700': r.status === 'Pagado',
                          'bg-amber-100 text-amber-700':     r.status === 'Pendiente',
                          'bg-sky-100 text-sky-700':         r.status === 'Enviado',
                          'bg-rose-100 text-rose-700':       r.status === 'Cancelado'
                        }">
                    {{ r.status }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class DashboardHomeComponent {
  readonly topBranches = [
    { code: 'NO', name: 'Delux Norte (Quito)',    amount: '32,180', percent: 100 },
    { code: 'GY', name: 'Delux Mall (Guayaquil)', amount: '28,540', percent: 88 },
    { code: 'CE', name: 'Delux Centro (Quito)',   amount: '21,300', percent: 66 },
    { code: 'CU', name: 'Delux Cuenca',           amount: '12,940', percent: 40 },
  ];

  readonly orders: Row[] = [
    { id: '10422', customer: 'María Solís', product: 'Ultra Boost Light 42', branch: 'Norte',  total: 200, status: 'Pagado' },
    { id: '10421', customer: 'Carlos Vera', product: 'Air Max Plus 41',      branch: 'Mall',   total: 220, status: 'Enviado' },
    { id: '10420', customer: 'Ana Pérez',   product: 'Samba OG 38',          branch: 'Centro', total: 160, status: 'Pendiente' },
    { id: '10419', customer: 'Luis Morán',  product: 'Hoodie Tech Fleece',   branch: 'Cuenca', total:  95, status: 'Pagado' },
    { id: '10418', customer: 'Sofía Ron',   product: 'Forum Low 40',         branch: 'Outlet', total: 140, status: 'Cancelado' },
    { id: '10417', customer: 'Diego Mejía', product: 'Mochila Tech Pack',    branch: 'Norte',  total:  75, status: 'Pagado' },
  ];
}
