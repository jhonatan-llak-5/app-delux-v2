import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InventoryService, ReceptionResult } from '@features/superadmin/services/inventory.service';
import { BrandingService } from '@core/services/branding.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { code128BSvg } from '@shared/utils/code128';
import { environment } from '@env/environment';

@Component({
  selector: 'dlx-receptions-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Historial de recepciones</h1>
        <p class="text-slate-500 text-sm mt-1">Todas las recepciones de mercadería confirmadas.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-sm" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
        <a routerLink="/app/admin/inventory/reception" class="eg-btn-primary text-sm"><i class="fa-solid fa-plus"></i> Nueva recepción</a>
      </div>
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (receptions().length === 0) {
      <div class="card p-10 text-center">
        <div class="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-slate-100 dark:bg-white/5 text-slate-400">
          <i class="fa-solid fa-truck-ramp-box text-xl"></i>
        </div>
        <p class="text-slate-500 mb-4">Aún no hay recepciones registradas.</p>
        <a routerLink="/app/admin/inventory/reception" class="eg-btn-primary"><i class="fa-solid fa-plus"></i> Registrar la primera</a>
      </div>
    } @else {
      <!-- Tabla desktop -->
      <div class="card overflow-hidden hidden md:block">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
              <tr class="text-left">
                <th class="px-4 py-3 font-semibold">Código</th>
                <th class="px-4 py-3 font-semibold">Fecha</th>
                <th class="px-4 py-3 font-semibold">Proveedor</th>
                <th class="px-4 py-3 font-semibold">Sucursal</th>
                <th class="px-4 py-3 font-semibold text-center">Productos</th>
                <th class="px-4 py-3 font-semibold text-center">Unidades</th>
                <th class="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (r of receptions(); track r.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-2.5 font-mono text-xs font-semibold">{{ r.code }}</td>
                  <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td class="px-4 py-2.5">{{ r.supplier_name || '—' }}</td>
                  <td class="px-4 py-2.5">{{ r.branch_name }}</td>
                  <td class="px-4 py-2.5 text-center">{{ r.items_count ?? r.items.length }}</td>
                  <td class="px-4 py-2.5 text-center font-semibold">{{ r.total_units }}</td>
                  <td class="px-4 py-2.5 text-right whitespace-nowrap">
                    <button class="text-slate-400 hover:text-[var(--dash-primary)] mr-3" (click)="openDetail(r)" title="Ver detalle">
                      <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                    <button class="text-slate-400 hover:text-[var(--dash-primary)]" (click)="printLabels(r)" title="Reimprimir etiquetas">
                      <i class="fa-solid fa-print text-xs"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Cards móvil -->
      <div class="md:hidden space-y-2">
        @for (r of receptions(); track r.id) {
          <div class="card p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-mono text-xs font-semibold">{{ r.code }}</p>
                <p class="text-xs text-slate-400">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }}</p>
                <p class="text-sm mt-1">{{ r.supplier_name || 'Sin proveedor' }} · {{ r.branch_name }}</p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <button (click)="openDetail(r)" class="text-slate-400"><i class="fa-solid fa-eye text-xs"></i></button>
                <button (click)="printLabels(r)" class="text-slate-400"><i class="fa-solid fa-print text-xs"></i></button>
              </div>
            </div>
            <div class="text-xs text-slate-500 mt-2">{{ r.items_count ?? r.items.length }} productos · <span class="font-semibold">{{ r.total_units }}</span> uds</div>
          </div>
        }
      </div>
    }

    <!-- Detalle -->
    @if (detail(); as r) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl max-h-[88vh] overflow-y-auto"
             (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <div>
              <h2 class="font-bold text-lg">{{ r.code }}</h2>
              <p class="text-xs text-slate-400">{{ (r.committed_at || r.created_at) | date:'dd/MM/yyyy HH:mm' }} · {{ r.branch_name }}</p>
            </div>
            <button class="text-slate-400 hover:text-slate-600" (click)="detail.set(null)"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="p-5 space-y-3">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Proveedor</p><p class="font-semibold truncate">{{ r.supplier_name || '—' }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Productos</p><p class="font-semibold">{{ r.items.length }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Unidades</p><p class="font-semibold">{{ r.total_units }}</p></div>
              <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3"><p class="text-[11px] uppercase tracking-wide text-slate-400">Registró</p><p class="font-semibold truncate">{{ r.created_by_name || '—' }}</p></div>
            </div>
            @if (r.note) { <p class="text-sm text-slate-500"><i class="fa-solid fa-note-sticky"></i> {{ r.note }}</p> }

            <div class="rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 dark:bg-white/5 text-slate-500">
                  <tr class="text-left">
                    <th class="px-3 py-2 font-semibold">Producto</th>
                    <th class="px-3 py-2 font-semibold">Talla/Color</th>
                    <th class="px-3 py-2 font-semibold">Código</th>
                    <th class="px-3 py-2 font-semibold text-right">Costo</th>
                    <th class="px-3 py-2 font-semibold text-center">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  @for (it of r.items; track it.id) {
                    <tr class="border-t border-slate-100 dark:border-white/5">
                      <td class="px-3 py-2">{{ it.product_name }}</td>
                      <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ it.size || '—' }} / {{ it.color || '—' }}</td>
                      <td class="px-3 py-2 font-mono text-xs">{{ it.variant_sku }}</td>
                      <td class="px-3 py-2 text-right">{{ money(it.unit_cost) }}</td>
                      <td class="px-3 py-2 text-center font-semibold">{{ it.quantity }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div class="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-white/10">
            <button class="btn-secondary" (click)="detail.set(null)">Cerrar</button>
            <button class="eg-btn-primary" (click)="printLabels(r)"><i class="fa-solid fa-print"></i> Reimprimir etiquetas</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReceptionsListComponent implements OnInit {
  private inv = inject(InventoryService);
  private branding = inject(BrandingService);
  private notify = inject(NotifyService);

  receptions = signal<ReceptionResult[]>([]);
  loading = signal(true);
  detail = signal<ReceptionResult | null>(null);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.inv.listReceptions().subscribe({
      next: r => { this.receptions.set(r.results); this.loading.set(false); },
      error: e => { this.loading.set(false); this.notify.error(parseApiError(e).message || 'No se pudieron cargar las recepciones.'); },
    });
  }

  openDetail(r: ReceptionResult): void { this.detail.set(r); }
  money(v: any): string { return '$' + (Math.round((+v || 0) * 100) / 100).toFixed(2); }

  printLabels(r: ReceptionResult): void {
    if (typeof window === 'undefined') return;
    const store = (this.branding.siteName() || 'DELUX').toUpperCase();
    let html = '';
    for (const it of r.items) {
      const copies = Math.max(1, it.quantity);
      const finalP = (+it.price || 0) * (1 + (this.branding.taxRate() || 0) / 100);
      const price = '$' + (Math.round(finalP * 100) / 100).toFixed(2);
      const bc = code128BSvg(it.variant_sku, { height: 50, moduleWidth: 1.5, margin: 4 });
      const sizeTxt = it.size ? ('Talla ' + it.size) : '';
      const kioskUrl = window.location.origin + '/kiosko?code=' + encodeURIComponent(it.variant_sku);
      const qrUrl = `${environment.apiUrl}/kiosk/qr/?data=${encodeURIComponent(kioskUrl)}`;
      for (let i = 0; i < copies; i++) {
        html += `<div class="lbl">
          <div class="row"><span class="store">${store}</span><span class="price">${price}</span></div>
          <div class="mid"><div class="bc">${bc}</div><img class="qr" src="${qrUrl}" alt="QR"/></div>
          <div class="code">${it.variant_sku}</div>
          <div class="name">${it.product_name}${sizeTxt ? ' · ' + sizeTxt : ''}</div>
        </div>`;
      }
    }
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) { this.notify.error('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${r.code}</title>
      <style>
        @page { size: 50mm 30mm; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .lbl { width: 50mm; height: 30mm; padding: 1.5mm 2mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; }
        .row { display: flex; justify-content: space-between; align-items: center; }
        .store { font-weight: 800; font-size: 9pt; letter-spacing: .5px; }
        .price { font-weight: 800; font-size: 11pt; background: #000; color: #fff; padding: 0 4px; border-radius: 2px; }
        .mid { display: flex; align-items: center; gap: 2mm; }
        .bc { flex: 1; height: 11mm; min-width: 0; }
        .bc svg { height: 100%; width: 100%; }
        .qr { height: 11mm; width: 11mm; flex-shrink: 0; }
        .code { font-size: 7pt; text-align: center; letter-spacing: 1px; margin-top: -1mm; }
        .name { font-size: 7.5pt; text-align: center; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>${html}
      <scr`+`ipt>
        window.onload=function(){
          var imgs=document.images, left=imgs.length;
          if(!left){ window.print(); return; }
          function done(){ if(--left<=0) window.print(); }
          for(var i=0;i<imgs.length;i++){ if(imgs[i].complete) done(); else { imgs[i].onload=done; imgs[i].onerror=done; } }
        };
      </scr`+`ipt></body></html>`);
    w.document.close();
  }
}
