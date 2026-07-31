import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, OrderService, Payment } from '@features/superadmin/services/order.service';
import { ShippingService, Shipment } from '@shared/services/shipping.service';
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
  private shipSvc = inject(ShippingService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  saving = signal(false);
  payments = signal<Payment[]>([]);
  validating = signal(false);
  shipment = signal<Shipment | null>(null);
  savingShip = signal(false);

  readonly shipStatuses = [
    { value: 'PREPARING',  label: 'Preparando' },
    { value: 'IN_TRANSIT', label: 'En tránsito' },
    { value: 'DELIVERED',  label: 'Entregado' },
  ];
  private shipLabels: Record<string, string> = {
    CREATED: 'Creado', PREPARING: 'Preparando', SHIPPED: 'Enviado',
    IN_TRANSIT: 'En tránsito', DELIVERED: 'Entregado', FAILED: 'Fallido', RETURNED: 'Devuelto',
  };
  /** Opciones del envío (Preparando/En tránsito/Entregado) + el estado actual si es antiguo. */
  shipStatusOptions(sh: { status: string }) {
    const opts = [...this.shipStatuses];
    if (!opts.some(x => x.value === sh.status)) {
      opts.unshift({ value: sh.status, label: this.shipLabels[sh.status] || sh.status });
    }
    return opts;
  }
  shipBadge(s: string) {
    return ({
      CREATED: 'bg-slate-100 text-slate-700', PREPARING: 'bg-amber-100 text-amber-700',
      SHIPPED: 'bg-sky-100 text-sky-700', IN_TRANSIT: 'bg-violet-100 text-violet-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700', FAILED: 'bg-rose-100 text-rose-700',
      RETURNED: 'bg-slate-200 text-slate-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }
  private loadShipment(orderId: number) {
    this.shipSvc.byOrder(orderId).subscribe({
      next: r => this.shipment.set((r.results && r.results[0]) || null),
      error: () => this.shipment.set(null),
    });
  }

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
    this.loadShipment(o.id);
  }
  private orderStatusLabels: Record<string, string> = {
    PENDING: 'Pendiente de pago', PAID: 'Pagado', PREPARING: 'Preparando',
    READY: 'Listo para retirar', SHIPPED: 'Enviado', DELIVERED: 'Entregado',
    CANCELLED: 'Cancelado', REFUNDED: 'Devuelto',
  };
  /**
   * Estados de "Información" para pedidos web: Pendiente de pago → (Listo para
   * retirar, solo retiro en tienda) → Pagado (cierra y bloquea la venta).
   * Cancelar/devolución/cambio se registran desde sus propias ventanas.
   */
  orderStatuses(o: { status: string; fulfillment?: string }) {
    const opts: { value: string; label: string }[] = [
      { value: 'PENDING', label: 'Pendiente de pago' },
    ];
    if (o.fulfillment === 'PICKUP') {
      opts.push({ value: 'READY', label: 'Listo para retirar' });
    }
    opts.push({ value: 'PAID', label: 'Pagado' });
    // Datos antiguos: si el estado actual no está en la lista, agrégalo para no dejar el select vacío.
    if (!opts.some(x => x.value === o.status)) {
      opts.unshift({ value: o.status, label: this.orderStatusLabels[o.status] || o.status });
    }
    return opts;
  }
  canManage() {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'TENANT_ADMIN' || r === 'BRANCH_MANAGER';
  }
  isFinal(s: string) { return s === 'CANCELLED' || s === 'REFUNDED'; }
  // Estados que cierran/bloquean el selector del pedido (venta cerrada).
  orderLocked(s: string) { return this.isFinal(s) || s === 'PAID'; }
  private revertOrderSelect() { const o = this.order(); if (o) this.order.set({ ...o }); }
  private revertShipSelect() { const sh = this.shipment(); if (sh) this.shipment.set({ ...sh }); }
  waLink(phone: string) {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    return 'https://wa.me/' + digits;
  }
  // Cancelar venta (motivo + opción de devolver stock).
  cancelOpen = signal(false);
  cancelReason = signal('');
  cancelRestore = signal(true);
  cancelling = signal(false);
  openCancel() { this.cancelReason.set(''); this.cancelRestore.set(true); this.cancelOpen.set(true); }
  confirmCancel() {
    const o = this.order();
    const reason = this.cancelReason().trim();
    if (!o || !reason) return;
    this.cancelling.set(true);
    this.svc.cancel(o.id, reason, this.cancelRestore()).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelOpen.set(false);
        this.notify.success('Venta cancelada');
        this.reload();
      },
      error: e => { this.cancelling.set(false); this.notify.fromServerError(e, 'No se pudo cancelar la venta.'); },
    });
  }

  // Modal de observaciones para estados "fallidos" (cancelado/devuelto).
  obsOpen = signal(false);
  obsText = '';
  private pendingStatus: string | null = null;

  // ── Registrar cambio (producto vuelve a stock, baja el total neto) ──
  changeOpen = signal(false);
  changeItemId = signal<number | null>(null);
  changeQty = signal(1);
  changeValue = signal(0);
  changeTipo = signal<'PARCIAL' | 'TOTAL'>('PARCIAL');
  changeDesc = signal('');
  changeSaving = signal(false);

  changeMaxQty(): number {
    const o = this.order();
    const it = o?.items.find(i => i.id === this.changeItemId());
    return it ? it.quantity : 1;
  }
  /** Total de la venta (tope del valor devuelto). */
  orderTotalNum(): number { return +(this.order()?.total || 0); }
  /** Tipo automático: Total si el valor devuelto iguala el total; Parcial si es menor. */
  changeTipoAuto(): 'TOTAL' | 'PARCIAL' { return this.changeValue() >= this.orderTotalNum() ? 'TOTAL' : 'PARCIAL'; }
  changeTipoAutoLabel(): string { return this.changeTipoAuto() === 'TOTAL' ? 'Total' : 'Parcial'; }
  /** Valida que el valor devuelto sea > 0 y ≤ total de la venta. */
  changeValueValid(): boolean { const v = this.changeValue(); return v > 0 && v <= this.orderTotalNum(); }

  openChange() {
    this.changeItemId.set(null);
    this.changeQty.set(1);
    this.changeValue.set(0);
    this.changeTipo.set('PARCIAL');
    this.changeDesc.set('');
    this.changeOpen.set(true);
  }

  cancelChange() { this.changeOpen.set(false); }

  onChangeItem(id: number) {
    const o = this.order();
    this.changeItemId.set(id);
    const it = o?.items.find(i => i.id === id);
    if (it) {
      const sub = +it.subtotal || (+it.unit_price * it.quantity);
      this.changeValue.set(sub);
      this.changeQty.set(1);
    }
  }

  confirmChange() {
    const o = this.order();
    const itemId = this.changeItemId();
    if (!o || itemId == null) return;
    const qty = this.changeQty();
    const value = this.changeValue();
    const desc = this.changeDesc().trim();
    if (qty < 1 || !this.changeValueValid()) return;
    this.changeSaving.set(true);
    this.svc.registerChange(o.id, {
      order_item_id: itemId,
      quantity: qty,
      valor_devuelto: value,
      tipo: this.changeTipoAuto(),
      descripcion: desc,
    }).subscribe({
      next: updated => {
        this.changeSaving.set(false);
        this.changeOpen.set(false);
        this.order.set(updated);
        this.notify.success('Cambio registrado');
        this.loadPayments(o.id);
        this.loadShipment(o.id);
      },
      error: e => { this.changeSaving.set(false); this.notify.fromServerError(e, 'No se pudo registrar el cambio.'); },
    });
  }

  async changeStatus(newStatus: string) {
    const o = this.order();
    if (!o || newStatus === o.status) return;
    // Cancelado / devuelto requieren un motivo → abrir modal.
    if (this.isFinal(newStatus)) {
      this.obsTarget = 'order';
      this.pendingStatus = newStatus;
      this.obsText = '';
      this.obsOpen.set(true);
      return;
    }
    // "Pagado" cierra la venta: pide confirmación explícita.
    if (newStatus === 'PAID') {
      const ok = await this.confirm.ask({
        title: 'Cerrar venta como pagada',
        message: 'Si marcas esta venta como PAGADA quedará cerrada y finalizada: se confirmará el cobro y se descontará el stock. El estado ya no se podrá modificar. ¿Continuar?',
        confirmText: 'Sí, cerrar venta',
      });
      if (!ok) { this.revertOrderSelect(); return; }
      this.applyStatus(newStatus);
      return;
    }
    this.applyStatus(newStatus);
  }

  // Destino del modal de observaciones: estado del pedido o del envío.
  private obsTarget: 'order' | 'shipment' = 'order';

  confirmObs() {
    const reason = this.obsText.trim();
    if (!reason || !this.pendingStatus) return;
    if (this.obsTarget === 'shipment') this.applyShipStatus(this.pendingStatus, reason);
    else this.applyStatus(this.pendingStatus, reason);
    this.obsOpen.set(false);
  }

  cancelObs() {
    this.obsOpen.set(false);
    this.pendingStatus = null;
    // Restaura los <select> al estado actual (revierte la selección visual).
    const o = this.order();
    if (o) this.order.set({ ...o });
    const sh = this.shipment();
    if (sh) this.shipment.set({ ...sh });
  }

  private applyStatus(newStatus: string, notes?: string) {
    const o = this.order();
    if (!o) return;
    this.saving.set(true);
    this.svc.setStatus(o.id, newStatus, notes).subscribe({
      next: updated => {
        this.order.set(updated);
        this.saving.set(false);
        this.notify.success(newStatus === 'PAID' ? 'Venta cerrada como pagada' : 'Estado actualizado');
        // Al cerrar como pagada, refresca el pago para que el KPI quede sincronizado.
        if (newStatus === 'PAID') this.loadPayments(o.id);
      },
      error: e => { this.saving.set(false); this.notify.fromServerError(e, 'No se pudo cambiar el estado.'); },
    });
  }

  // ---- Envío ----
  isShipFinal(s: string) { return s === 'FAILED' || s === 'RETURNED'; }
  // Estados que cierran/bloquean el selector del envío.
  shipLocked(s: string) { return this.isShipFinal(s) || s === 'DELIVERED'; }
  async changeShipStatus(newStatus: string) {
    const sh = this.shipment();
    if (!sh || newStatus === sh.status) return;
    if (this.isShipFinal(newStatus)) {
      this.obsTarget = 'shipment';
      this.pendingStatus = newStatus;
      this.obsText = '';
      this.obsOpen.set(true);
      return;
    }
    // "Entregado" cierra el envío: pide confirmación explícita.
    if (newStatus === 'DELIVERED') {
      const ok = await this.confirm.ask({
        title: 'Confirmar entrega',
        message: 'Vas a marcar este envío como ENTREGADO. El seguimiento quedará cerrado y no se podrá cambiar. ¿Confirmas la entrega?',
        confirmText: 'Sí, entregado',
      });
      if (!ok) { this.revertShipSelect(); return; }
      this.applyShipStatus(newStatus);
      return;
    }
    this.applyShipStatus(newStatus);
  }

  private applyShipStatus(newStatus: string, description?: string) {
    const sh = this.shipment();
    if (!sh) return;
    this.savingShip.set(true);
    this.shipSvc.updateStatus(sh.id, newStatus, description || '').subscribe({
      next: updated => { this.shipment.set(updated); this.savingShip.set(false); this.notify.success('Envío actualizado'); },
      error: e => { this.savingShip.set(false); this.notify.fromServerError(e, 'No se pudo actualizar el envío.'); },
    });
  }
  receiptUrl(code: string): string { return `${environment.apiUrl}/admin/checkout/receipt/${code}/`; }
  private route = inject(ActivatedRoute);

  order = signal<Order | null>(null);

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.svc.get(id).subscribe(o => this.order.set(o));
    this.loadPayments(id);
    this.loadShipment(id);
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

  // ── Factura electrónica ──
  retryingInvoice = signal(false);
  invoiceLabel(s?: string): string {
    return ({
      NOT_ISSUED: 'No emitida', PROCESSING: 'Procesando',
      AUTHORIZED: 'Autorizada', REJECTED: 'Rechazada', ERROR: 'Error',
    } as any)[s || ''] || 'No emitida';
  }
  invoiceClass(s?: string): string {
    return ({
      PROCESSING: 'bg-amber-100 text-amber-700',
      AUTHORIZED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
      ERROR: 'bg-rose-100 text-rose-700',
    } as any)[s || ''] || 'bg-slate-100 text-slate-600';
  }
  canRetryInvoice(): boolean {
    const s = this.order()?.invoice_status;
    return s === 'ERROR' || s === 'REJECTED' || s === 'NOT_ISSUED';
  }
  downloadingFile = signal<'pdf' | 'xml' | null>(null);
  /** Abre el RIDE/XML vía proxy autenticado (no expone la URL pública). */
  openInvoiceFile(kind: 'pdf' | 'xml') {
    const o = this.order();
    if (!o || this.downloadingFile()) return;
    this.downloadingFile.set(kind);
    this.svc.invoiceFile(o.id, kind).subscribe({
      next: blob => {
        this.downloadingFile.set(null);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: e => {
        this.downloadingFile.set(null);
        this.notify.fromServerError(e, 'No se pudo abrir el documento.');
      },
    });
  }
  async retryInvoice() {
    const o = this.order();
    if (!o) return;
    const ok = await this.confirm.ask({
      title: 'Reintentar factura',
      message: 'Se volverá a intentar emitir la factura electrónica de esta venta en NovaFactura. ¿Continuar?',
      confirmText: 'Reintentar',
    });
    if (!ok) return;
    this.retryingInvoice.set(true);
    this.svc.retryInvoice(o.id).subscribe({
      next: updated => { this.order.set(updated); this.retryingInvoice.set(false); this.notify.success('Reintento en proceso.'); },
      error: e => { this.retryingInvoice.set(false); this.notify.fromServerError(e, 'No se pudo reintentar la factura.'); },
    });
  }
}
