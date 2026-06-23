import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Order, OrderService } from '@features/superadmin/services/order.service';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';

@Component({
  selector: 'dlx-voucher-preview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Barra de acciones (no se imprime) -->
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <a routerLink="/app/admin/sales" class="hover:text-ink-950">Ventas</a>
          <i class="fa-solid fa-chevron-right text-[10px]"></i>
          <span class="uppercase tracking-widest font-semibold">Voucher</span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
          Vista previa del recibo
        </h1>
        <p class="text-slate-500 text-sm mt-0.5">Así se imprimirá. Puedes imprimir directo o descargarlo en PDF.</p>
      </div>
      <div class="flex items-center gap-2">
        <button (click)="download()" [disabled]="!order()"
                class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#334155]
                       text-slate-700 dark:text-slate-200 text-sm font-semibold
                       hover:bg-slate-100 dark:hover:bg-[#1e293b] transition inline-flex items-center gap-2 disabled:opacity-40">
          <i class="fa-solid fa-download"></i> Descargar PDF
        </button>
        <button (click)="print()" [disabled]="!order()"
                class="px-5 py-2.5 rounded-lg bg-[#1e40af] text-white text-sm font-semibold
                       hover:bg-[#1d4ed8] transition inline-flex items-center gap-2 disabled:opacity-40">
          <i class="fa-solid fa-print"></i> Imprimir
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="text-center py-20 text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    } @else if (!order()) {
      <div class="text-center py-20 text-slate-400">No se encontró la venta.</div>
    } @else {
      <!-- Preview centrado, estilo papel térmico -->
      <div class="flex justify-center">
        <div class="bg-white shadow-xl rounded-lg p-6" style="width: 340px;">
          <div [innerHTML]="receiptSafe()"></div>
        </div>
      </div>
    }
  `,
})
export class VoucherPreviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(OrderService);
  private sanitizer = inject(DomSanitizer);

  order = signal<Order | null>(null);
  loading = signal(true);

  receiptHtml = computed(() => this.order() ? this.buildReceipt(this.order()!) : '');
  receiptSafe = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.receiptHtml()));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.svc.get(+id).subscribe({
      next: o => { this.order.set(o); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  download(): void {
    if (this.order()) generateVoucherPDF(this.order()!);
  }

  /** Imprime SOLO el recibo en un iframe oculto (sin descargar, sin el panel). */
  print(): void {
    if (!this.order()) return;
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Voucher ${this.order()!.code}</title>
      <style>@page{margin:6mm} body{margin:0}</style></head>
      <body onload="window.print()">${this.receiptHtml()}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
    // Limpia el iframe tras imprimir.
    setTimeout(() => iframe.remove(), 60000);
  }

  private money(v: string | number): string {
    return '$' + Number(v).toFixed(2);
  }

  private buildReceipt(o: Order): string {
    const date = new Date(o.created_at).toLocaleString('es-EC');
    const fulfillment = o.fulfillment === 'PICKUP' ? 'Retiro en tienda' : 'Envío a domicilio';
    const rows = o.items.map(it => `
      <tr>
        <td style="padding:2px 0;vertical-align:top">
          ${it.product_name}<br>
          <span style="color:#555;font-size:11px">${it.quantity} x ${this.money(it.unit_price)}${it.size || it.color ? ' · ' + [it.size, it.color].filter(Boolean).join('/') : ''}</span>
        </td>
        <td style="padding:2px 0;text-align:right;vertical-align:top;white-space:nowrap">${this.money(it.subtotal)}</td>
      </tr>`).join('');

    const discountRow = Number(o.discount) > 0
      ? `<div style="display:flex;justify-content:space-between"><span>Descuento</span><span>- ${this.money(o.discount)}</span></div>` : '';
    const couponRow = o.coupon_code
      ? `<div style="display:flex;justify-content:space-between;color:#555"><span>Cupón</span><span>${o.coupon_code}</span></div>` : '';
    const sellerRow = o.seller_name
      ? `<div>Vendedor: ${o.seller_name}</div>` : '';

    return `
    <div style="width:300px;margin:0 auto;font-family:'Courier New',monospace;color:#000;font-size:12.5px;line-height:1.45">
      <div style="text-align:center;margin-bottom:6px">
        <div style="font-weight:800;font-size:22px;letter-spacing:2px">DELUX</div>
        <div>${o.branch_name || 'Sucursal'}</div>
        <div style="color:#555;font-size:11px">Sneakers, ropa y más</div>
      </div>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <div>Voucher #${o.code}</div>
      <div>Fecha: ${date}</div>
      ${o.customer_name ? `<div>Cliente: ${o.customer_name}</div>` : ''}
      ${sellerRow}
      <div>Entrega: ${fulfillment}</div>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${this.money(o.subtotal)}</span></div>
      ${discountRow}
      ${couponRow}
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:15px;margin-top:4px">
        <span>TOTAL</span><span>${this.money(o.total)}</span>
      </div>
      <div style="border-top:1px dashed #000;margin:6px 0"></div>
      <div style="text-align:center;color:#555;font-size:11px;margin-top:6px">
        ¡Gracias por tu compra!<br>Delux · Ecuador
      </div>
    </div>`;
  }
}
