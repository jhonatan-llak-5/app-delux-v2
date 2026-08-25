import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { OrderStatusLabelPipe, OrderStatusClassPipe } from '@shared/ui/order-status.pipe';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, OrderService, Payment } from '@features/superadmin/services/order.service';
import { ShippingService, Shipment } from '@shared/services/shipping.service';
import { ConfirmService } from '@shared/components/confirm/confirm.service';
import { environment } from '@env/environment';
import { printVoucherPDF } from '@shared/utils/voucher-pdf.util';
import { AuthService } from '@core/services/auth.service';
import { NotifyService } from '@shared/services/notify.service';
import { StoreSettingsService } from '@features/superadmin/services/store-settings.service';
import { BrandingService } from '@core/services/branding.service';
import { EmitInvoiceComponent } from '@features/superadmin/components/emit-invoice/emit-invoice.component';
import { DlxCancelSaleModalComponent } from '@shared/ui/cancel-sale-modal.component';
import { DlxChangeSaleModalComponent } from '@shared/ui/change-sale-modal.component';

@Component({
  selector: 'dlx-sale-detail',
  standalone: true,
  imports: [OrderStatusLabelPipe, OrderStatusClassPipe, ImgFallbackDirective, CommonModule, FormsModule, RouterLink, EmitInvoiceComponent, DlxCancelSaleModalComponent, DlxChangeSaleModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-detail.component.html',
})
export class SaleDetailComponent implements OnInit, OnDestroy {
  private svc = inject(OrderService);
  private shipSvc = inject(ShippingService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private confirm = inject(ConfirmService);
  private storeSet = inject(StoreSettingsService);
  private branding = inject(BrandingService);
  einvoiceEnabled = signal(false);   // facturación electrónica activa
  cfMax = signal(50);                // tope $ para facturar como Consumidor Final
  emitOpen = signal(false);          // modal "Emitir factura"
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
  /** Gestión de pedido web, factura electrónica y validación de comprobantes:
   * solo gerente/superadmin (el backend también lo restringe así). */
  canManage() {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'BRANCH_MANAGER';
  }
  /** Acciones de venta (registrar cambio / cancelar): también el vendedor.
   * Las acciones de pedido web, factura SRI y comprobantes siguen en canManage. */
  canChange() {
    const r = this.auth.user()?.role;
    return r === 'SUPERADMIN' || r === 'BRANCH_MANAGER' || r === 'SALESPERSON';
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
  // Cancelar venta (modal reutilizable dlx-cancel-sale-modal).
  cancelOpen = signal(false);
  cancelling = signal(false);
  openCancel() { this.cancelOpen.set(true); }
  confirmCancel(ev: { reason: string; restoreStock: boolean }) {
    const o = this.order();
    if (!o || !ev.reason || this.cancelling()) return;
    this.cancelling.set(true);
    this.svc.cancel(o.id, ev.reason, ev.restoreStock).subscribe({
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

  // ── Registrar cambio producto-por-producto (modal reusable) ──
  changeOpen = signal(false);
  changeSaving = signal(false);

  /** Total de la venta. */
  orderTotalNum(): number { return +(this.order()?.total || 0); }

  // ── Desglose fiscal (mismo criterio que el comprobante impreso) ──
  /** Tasa de IVA vigente (global, desde configuración). */
  saleTaxRate(): number { return +this.branding.taxRate() || 0; }
  /** IVA de la venta: el declarado si existe, si no se extrae del total. */
  saleTax(): number {
    const o = this.order(); if (!o) return 0;
    const total = +o.total || 0;
    const declared = +o.tax || 0;
    if (declared > 0) return declared;
    const r = this.saleTaxRate();
    return r ? total - total / (1 + r / 100) : 0;
  }
  /** Subtotal sin IVA (neto) = total − IVA. Siempre cuadra: neto + IVA = total. */
  saleNet(): number { const o = this.order(); if (!o) return 0; return (+o.total || 0) - this.saleTax(); }
  /** Etiqueta legible de la forma de pago (código SRI tabla 24). */
  private readonly PAYMENT_LABELS: Record<string, string> = {
    '01': 'Efectivo', '16': 'Tarjeta de débito', '19': 'Tarjeta de crédito', '20': 'Transferencia',
  };
  paymentLabel(): string {
    const pf = this.order()?.payment_form || '';
    return this.PAYMENT_LABELS[pf] || 'Efectivo';
  }
  openChange() { this.changeOpen.set(true); }

  confirmChange(ev: {
    returned: { order_item_id: number; quantity: number }[];
    delivered: { variant_id: number; quantity: number }[];
    descripcion: string;
    change_date: string;
  }) {
    const o = this.order();
    if (!o) return;
    this.changeSaving.set(true);
    this.svc.registerChange(o.id, ev).subscribe({
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
    this.svc.get(id).subscribe(o => { this.order.set(o); this.maybePollInvoice(); });
    this.loadPayments(id);
    this.loadShipment(id);
    this.storeSet.getStoreOptions().subscribe({
      next: o => {
        this.einvoiceEnabled.set(!!o.einvoice_enabled);
        this.cfMax.set(Number(o.einvoice_consumidor_final_max) || 50);
      },
      error: () => {},
    });
  }

  paymentStatusClass(s: string) {
    return ({
      PENDING: 'bg-amber-100 text-amber-700',
      SUCCEEDED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-rose-100 text-rose-700',
      REFUNDED: 'bg-slate-100 text-slate-700',
    } as any)[s] || 'bg-slate-100 text-slate-700';
  }

  /** Imprime el comprobante de venta térmico (abre la vista de impresión). */
  print() {
    const o = this.order();
    if (o) printVoucherPDF(o, this.branding.receiptBusiness());
  }

  /**
   * ¿Se puede imprimir el comprobante? Con factura electrónica activa, solo
   * cuando está AUTORIZADA (ya tiene N° y clave de acceso). Sin factura
   * electrónica, se imprime como recibo simple de la venta.
   */
  canPrintReceipt(): boolean {
    const o = this.order();
    if (!o) return false;
    if (!this.einvoiceEnabled()) return true;
    return o.invoice_status === 'AUTHORIZED';
  }

  // ── Factura electrónica ──
  retryingInvoice = signal(false);
  invoiceLabel(s?: string): string {
    return ({
      NOT_ISSUED: 'No emitida', PROCESSING: 'Procesando',
      PENDING_SRI: 'En espera del SRI',
      AUTHORIZED: 'Autorizada', REJECTED: 'Rechazada',
      ANNULLED: 'Anulada', ERROR: 'Error',
    } as any)[s || ''] || 'No emitida';
  }
  invoiceClass(s?: string): string {
    return ({
      PROCESSING: 'bg-amber-100 text-amber-700',
      PENDING_SRI: 'bg-sky-100 text-sky-700',
      AUTHORIZED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
      ANNULLED: 'bg-slate-200 text-slate-600',
      ERROR: 'bg-rose-100 text-rose-700',
    } as any)[s || ''] || 'bg-slate-100 text-slate-600';
  }
  canRetryInvoice(): boolean {
    // PENDING_SRI y PROCESSING NO se reintentan a mano: el SRI/NovaFactura
    // resuelven solos. Solo rechazo/error/no emitida requieren acción.
    const s = this.order()?.invoice_status;
    return s === 'ERROR' || s === 'REJECTED' || s === 'NOT_ISSUED';
  }
  /** La factura aún no se ha emitido (estado inicial / no emitida). */
  invoiceNotIssued(): boolean {
    const s = this.order()?.invoice_status;
    return !s || s === 'NOT_ISSUED';
  }
  /** Éxito del modal de emisión: refleja el pedido actualizado (PROCESSING). */
  onInvoiceEmitted(updated: Order) {
    this.order.set(updated);
    this.emitOpen.set(false);
    this.maybePollInvoice();   // sigue el estado hasta que el SRI resuelva
  }

  // ── Seguimiento del estado de la factura (Procesando → Autorizada) ──
  private invPollTimer: any = null;
  /** Si la factura está en curso, consulta cada pocos segundos hasta que el SRI
   *  la resuelva (autorizada/rechazada/anulada), sin recargar la página. */
  private maybePollInvoice(): void {
    this.stopInvoicePolling();
    const st = this.order()?.invoice_status;
    if (st !== 'PROCESSING' && st !== 'PENDING_SRI') return;
    const id = this.order()!.id;
    let attempts = 0;
    this.invPollTimer = setInterval(() => {
      attempts++;
      this.svc.get(id).subscribe({
        next: o => {
          this.order.set(o);
          if (!['PROCESSING', 'PENDING_SRI'].includes(o.invoice_status || '')) {
            this.stopInvoicePolling();
          }
        },
        error: () => {},
      });
      if (attempts >= 30) this.stopInvoicePolling();   // hasta ~2 min
    }, 4000);
  }
  private stopInvoicePolling(): void {
    if (this.invPollTimer) { clearInterval(this.invPollTimer); this.invPollTimer = null; }
  }
  ngOnDestroy(): void { this.stopInvoicePolling(); }
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
