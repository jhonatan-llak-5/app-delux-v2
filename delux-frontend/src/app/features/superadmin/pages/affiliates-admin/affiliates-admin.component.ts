import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { DlxSearchInputComponent } from '@shared/ui/search-input.component';
import { NotifyService } from '@shared/services/notify.service';
import { BrandingService } from '@core/services/branding.service';
import { parseApiError } from '@shared/utils/api-error.util';
import {
  AffiliateService, AffiliateAdminRow, CommissionRow, PayoutRow,
} from '@features/affiliate/affiliate.service';

@Component({
  selector: 'dlx-affiliates-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DlxSearchInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Afiliados</h1>
        <p class="text-slate-500 text-sm mt-1">Vendedores afiliados, sus comisiones y registro de pagos.</p>
      </div>
      <button class="btn-secondary text-sm" (click)="reload()"><i class="fa-solid fa-arrows-rotate"></i> Recargar</button>
    </div>

    <div class="card p-3 mb-4">
      <dlx-search-input [fluid]="true" [value]="search" (valueChange)="search = $event; search$.next($event)"
        placeholder="Buscar por nombre, correo o código…" class="max-w-md" />
    </div>

    @if (loading()) {
      <div class="card p-10 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl"></i></div>
    } @else if (rows().length === 0) {
      <div class="card p-10 text-center text-slate-400">
        <i class="fa-solid fa-hand-holding-dollar text-3xl mb-3"></i>
        <p>No hay afiliados registrados todavía.</p>
      </div>
    } @else {
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-white/5 text-slate-500 text-left">
              <tr>
                <th class="px-4 py-3 font-semibold">Afiliado</th>
                <th class="px-4 py-3 font-semibold">Código</th>
                <th class="px-4 py-3 font-semibold text-center">Ventas</th>
                <th class="px-4 py-3 font-semibold text-right">Por pagar</th>
                <th class="px-4 py-3 font-semibold text-right">Pagado</th>
                <th class="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (a of rows(); track a.id) {
                <tr class="border-t border-slate-100 dark:border-white/5">
                  <td class="px-4 py-3">
                    <p class="font-semibold">{{ a.full_name }}</p>
                    <p class="text-xs text-slate-400">{{ a.email }}</p>
                  </td>
                  <td class="px-4 py-3"><span class="font-mono font-semibold text-[#1e40af] dark:text-[#7aa2ff]">{{ a.ref_code || '—' }}</span></td>
                  <td class="px-4 py-3 text-center">{{ a.sales_count }}</td>
                  <td class="px-4 py-3 text-right font-bold text-amber-600">{{ money(a.commission_pending) }}</td>
                  <td class="px-4 py-3 text-right text-emerald-600">{{ money(a.commission_paid) }}</td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <button class="text-slate-500 hover:text-[#1e40af] mr-3" title="Ver detalle" (click)="openDetail(a)">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="eg-btn-primary text-xs" [disabled]="!canPay(a)" (click)="askPay(a)"
                            [title]="payHint(a)">
                      <i class="fa-solid fa-money-bill-wave"></i> Pagar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    <!-- Panel de detalle (comisiones + historial de pagos) -->
    @if (detail(); as d) {
      <div class="fixed inset-0 z-50 flex justify-end bg-black/40" (click)="closeDetail()">
        <div class="w-full max-w-xl h-full bg-white dark:bg-[#0f1420] shadow-2xl overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="sticky top-0 bg-white dark:bg-[#0f1420] border-b border-slate-100 dark:border-white/10 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 class="font-bold text-lg">{{ d.full_name }}</h2>
              <p class="text-xs text-slate-400 font-mono">{{ d.ref_code }}</p>
            </div>
            <button class="text-slate-400 hover:text-slate-600" (click)="closeDetail()"><i class="fa-solid fa-xmark text-xl"></i></button>
          </div>

          <div class="p-5 space-y-5">
            <div class="grid grid-cols-2 gap-3">
              <div class="card p-4">
                <p class="text-[11px] uppercase tracking-widest text-amber-600 font-semibold">Por pagar</p>
                <p class="text-2xl font-black mt-1 text-amber-600">{{ money(d.commission_pending) }}</p>
              </div>
              <div class="card p-4">
                <p class="text-[11px] uppercase tracking-widest text-emerald-600 font-semibold">Pagado</p>
                <p class="text-2xl font-black mt-1 text-emerald-600">{{ money(d.commission_paid) }}</p>
              </div>
            </div>

            <button class="eg-btn-primary w-full" [disabled]="!canPay(d)" (click)="askPay(d)" [title]="payHint(d)">
              <i class="fa-solid fa-money-bill-wave"></i> Registrar pago de comisiones
            </button>
            @if (branding.affiliateMinPayout() > 0 && d.commission_pending > 0 && d.commission_pending < branding.affiliateMinPayout()) {
              <p class="text-[12px] text-amber-600 -mt-3">Mínimo para pagar: {{ money(branding.affiliateMinPayout()) }}. Aún no alcanza.</p>
            }

            <div>
              <h3 class="font-bold mb-2 text-sm uppercase tracking-wide text-slate-500">Comisiones</h3>
              @if (detailLoading()) {
                <div class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i></div>
              } @else if (comm().length === 0) {
                <p class="text-sm text-slate-400 py-4">Sin comisiones.</p>
              } @else {
                <div class="space-y-2">
                  @for (c of comm(); track c.id) {
                    <div class="flex items-center justify-between text-sm border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2">
                      <div>
                        <span class="font-mono font-semibold">{{ c.order_code }}</span>
                        <span class="text-xs text-slate-400 ml-2">{{ c.created_at | date:'dd/MM/yy' }}</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="font-bold">{{ money(c.amount) }}</span>
                        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" [ngClass]="badge(c.status)">{{ label(c.status) }}</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div>
              <h3 class="font-bold mb-2 text-sm uppercase tracking-wide text-slate-500">Historial de pagos</h3>
              @if (payouts().length === 0) {
                <p class="text-sm text-slate-400 py-4">Aún no se han registrado pagos.</p>
              } @else {
                <div class="space-y-2">
                  @for (p of payouts(); track p.id) {
                    <div class="flex items-center justify-between text-sm border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2">
                      <div>
                        <p class="font-semibold">{{ money2(p.amount) }} <span class="text-xs font-normal text-slate-400">· {{ p.method_label }}</span></p>
                        <p class="text-xs text-slate-400">{{ p.created_at | date:'dd/MM/yy HH:mm' }} · {{ p.commissions_count }} comisión(es){{ p.reference ? ' · ' + p.reference : '' }}</p>
                      </div>
                      <i class="fa-solid fa-circle-check text-emerald-500"></i>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Modal de registro de pago -->
    @if (paying(); as p) {
      <div class="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" (click)="paying.set(null)">
        <div class="card w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-bold mb-1">Registrar pago</h2>
          <p class="text-sm text-slate-500 mb-4">
            Pago total a <strong>{{ p.full_name }}</strong> por <strong class="text-amber-600">{{ money(p.commission_pending) }}</strong>.
            Se marcarán todas sus comisiones por pagar como pagadas.
          </p>

          <label class="block text-sm font-semibold mb-1">Método</label>
          <select class="eg-input mb-3" [(ngModel)]="payMethod">
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
          </select>

          <label class="block text-sm font-semibold mb-1">Referencia / nota <span class="text-slate-400 font-normal">(opcional)</span></label>
          <input class="eg-input mb-4" [(ngModel)]="payReference" maxlength="160" placeholder="N° de comprobante, caja, observación…" />

          <div class="flex justify-end gap-2">
            <button class="btn-secondary" (click)="paying.set(null)" [disabled]="saving()">Cancelar</button>
            <button class="eg-btn-primary" (click)="confirmPay()" [disabled]="saving()">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else { <i class="fa-solid fa-check"></i> }
              Confirmar pago
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AffiliatesAdminComponent implements OnInit {
  private svc = inject(AffiliateService);
  private notify = inject(NotifyService);
  branding = inject(BrandingService);

  rows = signal<AffiliateAdminRow[]>([]);
  loading = signal(true);
  search = '';
  search$ = new Subject<string>();

  detail = signal<AffiliateAdminRow | null>(null);
  detailLoading = signal(false);
  comm = signal<CommissionRow[]>([]);
  payouts = signal<PayoutRow[]>([]);

  paying = signal<AffiliateAdminRow | null>(null);
  payMethod: 'CASH' | 'TRANSFER' = 'CASH';
  payReference = '';
  saving = signal(false);

  ngOnInit(): void {
    this.load();
    this.search$.pipe(debounceTime(300)).subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.svc.adminAffiliates(this.search).subscribe({
      next: r => { this.rows.set(r || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  reload(): void { this.search = ''; this.load(); }

  openDetail(a: AffiliateAdminRow): void {
    this.detail.set(a);
    this.detailLoading.set(true);
    this.svc.adminCommissions(a.id).subscribe({
      next: r => { this.comm.set(r.results || []); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
    this.svc.adminPayouts(a.id).subscribe({ next: r => this.payouts.set(r.results || []) });
  }
  closeDetail(): void { this.detail.set(null); this.comm.set([]); this.payouts.set([]); }

  askPay(a: AffiliateAdminRow): void {
    this.payMethod = 'CASH';
    this.payReference = '';
    this.paying.set(a);
  }

  confirmPay(): void {
    const a = this.paying();
    if (!a) return;
    this.saving.set(true);
    this.svc.createPayout({ affiliate: a.id, method: this.payMethod, reference: this.payReference.trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.paying.set(null);
        this.notify.success('Pago registrado', { description: `Se pagaron las comisiones de ${a.full_name}.` });
        this.load();
        if (this.detail()?.id === a.id) this.openDetail({ ...a, commission_pending: 0 });
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(parseApiError(e).message || 'No se pudo registrar el pago.');
      },
    });
  }

  canPay(a: AffiliateAdminRow): boolean {
    const min = this.branding.affiliateMinPayout();
    return a.commission_pending > 0 && (min <= 0 || a.commission_pending >= min);
  }
  payHint(a: AffiliateAdminRow): string {
    if (a.commission_pending <= 0) return 'Sin comisiones por pagar';
    const min = this.branding.affiliateMinPayout();
    if (min > 0 && a.commission_pending < min) return `Mínimo para pagar: ${this.money(min)}`;
    return 'Registrar pago';
  }
  money(v: number | string | null | undefined): string { return '$' + (Math.round((+(v ?? 0) || 0) * 100) / 100).toFixed(2); }
  money2(v: string): string { return '$' + (Math.round((+v || 0) * 100) / 100).toFixed(2); }
  label(st: string): string { return st === 'PAID' ? 'Pagada' : st === 'CANCELLED' ? 'Anulada' : 'Por pagar'; }
  badge(st: string): string {
    if (st === 'PAID') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    if (st === 'CANCELLED') return 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/40';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
}
