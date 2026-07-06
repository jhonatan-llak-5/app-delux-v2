import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, OrderService, Payment } from '@features/superadmin/services/order.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { environment } from '@env/environment';
import { generateVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-sale-detail',
  standalone: true,
  imports: [OrderStatusLabelPipe, OrderStatusClassPipe, ImgFallbackDirective, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-detail.component.html',
})
export class SaleDetailComponent implements OnInit {
  private svc = inject(OrderService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  saving = signal(false);
  payments = signal<Payment[]>([]);
  validating = signal(false);

  private loadPayments(orderId: number) {
    this.svc.payments(orderId).subscribe({
      next: ps => this.payments.set(ps),
      error: () => {},
    });
  }

  async confirmPayment(p: Payment) {
    const ok = await this.confirm.ask({
      title: 'Validar comprobante',
      message: 'Confirmas que el pago fue recibido correctamente. El pedido pasará a PAGADO y se descontará el stock.',
      confirmText: 'Validar pago',
    });
    if (!ok) return;
    this.validating.set(true);
    this.svc.confirmPayment(p.id).subscribe({
      next: () => {
        this.validating.set(false);
        this.notify.success('Comprobante validado. Pedido marcado como pagado.');
        this.reload();
      },
      error: e => { this.validating.set(false); this.notify.fromServerError(e, 'No se pudo validar.'); },
    });
  }

  async rejectPayment(p: Payment) {
    const ok = await this.confirm.ask({
      title: 'Rechazar comprobante',
      message: '¿Rechazar este comprobante? El pedido se cancelará y se liberará el stock reservado.',
      variant: 'danger', confirmText: 'Rechazar',
    });
    if (!ok) return;
    this.validating.set(true);
    this.svc.rejectPayment(p.id).subscribe({
      next: () => {
        this.validating.set(false);
        this.notify.success('Comprobante rechazado. Pedido cancelado.');
        this.reload();
      },
      error: e => { this.validating.set(false); this.notify.fromServerError(e, 'No se pudo rechazar.'); },
    });
  }

  private reload() {
    const o = this.order();
    if (!o) return;
    this.svc.get(o.id).subscribe(u => this.order.set(u));
    this.loadPayments(o.id);
  }
  readonly statuses = [
    { value: 'PENDING',   label: 'Pendiente de pago' },
    { value: 'PAID',      label: 'Pagado' },
    { value: 'PREPARING', label: 'Preparando' },
    { value: 'READY',     label: 'Listo para retirar' },
    { value: 'SHIPPED',   label: 'Enviado' },
    { value: 'DELIVERED', label: 'Entregado' },
    { value: 'CANCELLED', label: 'Cancelado' },
    { value: 'REFUNDED',  label: 'Devuelto' },
  ];
  canManage() {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  }
  isFinal(s: string) { return s === 'CANCELLED' || s === 'REFUNDED'; }
  waLink(phone: string) {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    return 'https://wa.me/' + digits;
  }
  changeStatus(newStatus: string) {
    const o = this.order();
    if (!o || newStatus === o.status) return;
    this.saving.set(true);
    this.svc.setStatus(o.id, newStatus).subscribe({
      next: updated => { this.order.set(updated); this.saving.set(false); this.notify.success('Estado actualizado'); },
      error: e => { this.saving.set(false); this.notify.fromServerError(e, 'No se pudo cambiar el estado.'); },
    });
  }
  receiptUrl(code: string): string { return `${environment.apiUrl}/admin/checkout/receipt/${code}/`; }
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.svc.get(id).subscribe(o => this.order.set(o));
    this.loadPayments(id);
  }

  paymentStatusClass(s: string) {
    return ({
      PENDING: 'bg-amber-100 text-amber-700',
      SUCCEEDED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-rose-100 text-rose-700',
      REFUNDED: 'bg-slate-100 text-slate-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }

  print() { if (this.order()) generateVoucherPDF(this.order()!); }


}
