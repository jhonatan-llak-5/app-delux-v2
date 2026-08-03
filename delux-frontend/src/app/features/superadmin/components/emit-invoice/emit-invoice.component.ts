import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnInit,
  Output, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertComponent } from '@shared/components/alert/alert.component';
import { Order, OrderService } from '@features/superadmin/services/order.service';
import { NotifyService } from '@shared/services/notify.service';
import { CustomerService, Customer } from '@features/superadmin/services/customer.service';
import { DlxDocTypeSelectComponent } from '@shared/ui/doc-type-select.component';
import { DlxProvinceSelectComponent } from '@shared/ui/province-select.component';
import { DlxPhoneInputComponent } from '@shared/ui/phone-input.component';
import { Subject, debounceTime } from 'rxjs';

/**
 * dlx-emit-invoice — Modal reutilizable para EMITIR la factura electrónica de una venta.
 *
 * Renderízalo condicionalmente (se crea/destruye al abrir/cerrar) y prefilllea
 * con los datos del cliente del pedido:
 *
 *   @if (emitOpen()) {
 *     <dlx-emit-invoice [order]="o" [cfMax]="cfMax()"
 *                       (emitted)="onInvoiceEmitted($event)"
 *                       (closed)="emitOpen.set(false)" />
 *   }
 *
 * Reglas SRI: si el total es >= cfMax y la identificación queda vacía o es
 * '9999999999999' (Consumidor Final), no se puede emitir (aviso + botón bloqueado).
 */
@Component({
  selector: 'dlx-emit-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent, DlxDocTypeSelectComponent, DlxProvinceSelectComponent, DlxPhoneInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
         (click)="close()">
      <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121826] shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 max-h-[90vh] flex flex-col"
           (click)="$event.stopPropagation()">

        <!-- Cabecera -->
        <div class="px-6 pt-6 pb-4 flex items-start gap-3">
          <div class="w-11 h-11 rounded-full bg-[var(--dash-primary)]/15 text-[var(--dash-primary)] grid place-items-center shrink-0">
            <i class="fa-solid fa-file-invoice text-lg"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-bold tracking-tight">Emitir factura electrónica</h3>
            <p class="text-slate-500 text-sm mt-0.5">
              Venta {{ order.code }} · Total <span class="font-semibold">\${{ order.total }}</span>
            </p>
          </div>
          <button type="button" (click)="close()" aria-label="Cerrar"
                  class="w-8 h-8 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition shrink-0">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Cuerpo (scroll) -->
        <div class="px-6 pb-2 space-y-4 overflow-y-auto">
          @if (cfBlocked()) {
            <dlx-alert variant="warning" [emphasis]="true"
                       title="Identificación obligatoria"
                       [message]="cfMessage()" />
          }

          <!-- Interruptor rápido: emitir como Consumidor Final -->
          <label class="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 cursor-pointer hover:border-[var(--dash-primary)]/50 transition">
            <input type="checkbox" [ngModel]="isConsumidorFinal()" (ngModelChange)="toggleConsumidorFinal($event)"
                   class="mt-0.5 w-4 h-4 rounded accent-[var(--dash-primary)]" />
            <span>
              <span class="font-semibold text-sm">Emitir como Consumidor Final</span>
              <span class="block text-[11px] text-slate-500 dark:text-white/50">Sin datos del cliente (ID 9999999999999). Permitido en ventas menores a \${{ cfMax }}.</span>
            </span>
          </label>

          @if (!isConsumidorFinal()) {
            <!-- Buscar cliente: facturar a otros datos; si no existe se crea al emitir -->
            <div class="relative">
              <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Buscar cliente</label>
              <input type="text" [ngModel]="custQuery()" (ngModelChange)="onCustQuery($event)" (blur)="closeCustSoon()"
                     placeholder="Nombre, cédula/RUC o correo…"
                     class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              @if (custOpen() && custResults().length) {
                <div class="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121826] shadow-xl max-h-56 overflow-y-auto">
                  @for (c of custResults(); track c.id) {
                    <button type="button" (click)="pickCustomer(c)"
                            class="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-sm border-b border-slate-100 dark:border-white/5 last:border-0">
                      <span class="font-semibold">{{ c.full_name }}</span>
                      <span class="text-slate-400"> · {{ c.document_id || 'sin ID' }}</span>
                    </button>
                  }
                </div>
              }
              <p class="text-[10px] text-slate-400 mt-1">Si el cliente no existe, se guardará al emitir con los datos que ingreses.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Identificación SRI</label>
                <dlx-doc-type-select [ngModel]="documentType()" (ngModelChange)="onDocType($event)"
                                     [excludeConsumerFinal]="true" class="block mt-1" />
              </div>
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Número de identificación</label>
                <input type="text" [ngModel]="identification()" (ngModelChange)="identification.set($event)"
                       placeholder="Cédula / RUC / Pasaporte"
                       class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Nombre / Razón social</label>
                <input type="text" [ngModel]="name()" (ngModelChange)="name.set($event)"
                       placeholder="Nombre del cliente"
                       class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              </div>
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Nombre comercial</label>
                <input type="text" [ngModel]="businessName()" (ngModelChange)="businessName.set($event)"
                       placeholder="Opcional"
                       class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Correo</label>
                <input type="email" [ngModel]="email()" (ngModelChange)="email.set($event)"
                       placeholder="correo@ejemplo.com"
                       class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              </div>
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Teléfono</label>
                <dlx-phone-input [ngModel]="phone()" (ngModelChange)="phone.set($event)" class="block mt-1" />
              </div>
            </div>

            <div>
              <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Dirección</label>
              <input type="text" [ngModel]="address()" (ngModelChange)="address.set($event)"
                     placeholder="Dirección del cliente (opcional)"
                     class="eg-input mt-1 w-full text-sm" autocomplete="off" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Ciudad</label>
                <input type="text" [ngModel]="city()" (ngModelChange)="city.set($event)"
                       placeholder="Ciudad (opcional)"
                       class="eg-input mt-1 w-full text-sm" autocomplete="off" />
              </div>
              <div>
                <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Provincia</label>
                <dlx-province-select [ngModel]="province()" (ngModelChange)="province.set($event)" class="block mt-1" />
              </div>
            </div>
          } @else {
            <p class="text-xs text-slate-500 dark:text-white/50">
              <i class="fa-solid fa-circle-info"></i>
              Se emitirá como <span class="font-semibold">Consumidor Final</span> (identificación 9999999999999). No se requieren más datos.
            </p>
          }

          <!-- Forma de pago (opcional, colapsable) -->
          <div class="rounded-xl border border-slate-200 dark:border-white/10">
            <button type="button" (click)="paymentOpen.set(!paymentOpen())"
                    class="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold">
              <span class="flex items-center gap-2">
                <i class="fa-solid fa-money-bill-wave text-slate-400"></i> Forma de pago (opcional)
              </span>
              <i class="fa-solid text-slate-400" [ngClass]="paymentOpen() ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            @if (paymentOpen()) {
              <div class="px-4 pb-4 space-y-3">
                <div>
                  <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Método</label>
                  <select [ngModel]="paymentForm()" (ngModelChange)="setPaymentForm($event)"
                          class="eg-input mt-1 w-full text-sm">
                    @for (pf of paymentForms; track pf.v) {
                      <option [value]="pf.v">{{ pf.label }}</option>
                    }
                  </select>
                </div>
                @if (creditAllowed()) {
                  <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" [ngModel]="aCredito()" (ngModelChange)="aCredito.set($event)" class="rounded" />
                    Venta a crédito
                  </label>
                  @if (aCredito()) {
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Plazo</label>
                        <input type="number" min="1" [ngModel]="plazo()" (ngModelChange)="plazo.set(+$event)"
                               class="eg-input mt-1 w-full text-sm" />
                      </div>
                      <div>
                        <label class="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Unidad</label>
                        <select [ngModel]="unidad()" (ngModelChange)="unidad.set($event)"
                                class="eg-input mt-1 w-full text-sm">
                          <option value="meses">Meses</option>
                          <option value="dias">Días</option>
                        </select>
                      </div>
                    </div>
                  }
                }
              </div>
            }
          </div>
        </div>

        <!-- Pie -->
        <div class="p-5 flex gap-2 justify-end border-t border-slate-100 dark:border-white/10 mt-2">
          <button type="button" (click)="close()" [disabled]="saving()"
                  class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold transition disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" (click)="emit()" [disabled]="!canEmit()"
                  class="px-5 py-2.5 rounded-xl bg-[var(--dash-primary)] hover:opacity-90 text-white text-sm font-bold transition disabled:opacity-40 flex items-center gap-2">
            @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> }
            @else { <i class="fa-solid fa-paper-plane"></i> }
            Emitir factura
          </button>
        </div>
      </div>
    </div>
  `,
})
export class EmitInvoiceComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private notify = inject(NotifyService);
  private custSvc = inject(CustomerService);

  @Input({ required: true }) order!: Order;
  /** Tope $ para poder facturar como Consumidor Final. */
  @Input() cfMax = 50;

  /** Emite el Order actualizado (invoice_status → PROCESSING) al éxito. */
  @Output() emitted = new EventEmitter<Order>();
  /** Se cierra el modal (X / click fuera / Escape / Cancelar). */
  @Output() closed = new EventEmitter<void>();

  // Códigos SRI de identificación.
  readonly docTypes = [
    { v: '05', label: 'Cédula' },
    { v: '04', label: 'RUC' },
    { v: '06', label: 'Pasaporte' },
    { v: '07', label: 'Consumidor Final' },
  ];
  // Códigos SRI de forma de pago (igual que el POS).
  readonly paymentForms = [
    { v: '01', label: 'Efectivo' },
    { v: '16', label: 'Tarjeta de débito' },
    { v: '19', label: 'Tarjeta de crédito' },
    { v: '20', label: 'Transferencia' },
  ];

  identification = signal('');
  documentType = signal('05');
  name = signal('');
  businessName = signal('');
  email = signal('');
  address = signal('');
  city = signal('');
  province = signal('');
  phone = signal('');

  // Búsqueda de cliente (facturar a otro cliente / crear si no existe).
  custQuery = signal('');
  custResults = signal<Customer[]>([]);
  custOpen = signal(false);
  private cust$ = new Subject<string>();

  paymentOpen = signal(false);
  paymentForm = signal('01');
  aCredito = signal(false);
  plazo = signal(1);
  unidad = signal<'meses' | 'dias'>('meses');

  saving = signal(false);

  /** Tipo de documento = Consumidor Final (oculta datos del cliente). */
  isConsumidorFinal = computed(() => this.documentType() === '07');

  /** "A crédito" solo aplica a Tarjeta de crédito (19); el resto es contado. */
  creditAllowed = computed(() => this.paymentForm() === '19');
  setPaymentForm(v: string) {
    this.paymentForm.set(v);
    if (v !== '19') this.aCredito.set(false);  // efectivo/débito/transferencia = contado
  }

  /** ¿La venta va como Consumidor Final (sin identificación real)? */
  private isCF = computed(() => {
    const id = this.identification().trim();
    return !id || id === '9999999999999';
  });
  /** Bloqueo SRI: CF con total >= cfMax no se puede facturar. */
  cfBlocked = computed(() => this.isCF() && this.orderTotal() >= this.cfMax);
  cfMessage = computed(() =>
    `No puedes emitir como Consumidor Final una venta de $${this.cfMax.toFixed(2)} o más. ` +
    `Ingresa la identificación (cédula o RUC) del cliente.`);

  canEmit = computed(() => !this.saving() && !this.cfBlocked() && this.name().trim().length > 0);

  private orderTotal(): number { return +(this.order?.total || 0); }

  ngOnInit() {
    // Prefill rápido desde los datos planos del pedido.
    this.identification.set((this.order.customer_document || '').trim());
    this.name.set((this.order.customer_name || '').trim());
    this.email.set((this.order.customer_email || '').trim());
    this.phone.set((this.order.customer_phone || '').trim());
    this.deduceDocType();
    // Si la venta tiene cliente, trae sus DATOS DE FACTURACIÓN por defecto
    // (razón social, dirección, ciudad, provincia, tipo de documento).
    if (this.order.customer) {
      this.custSvc.get(this.order.customer).subscribe({
        next: c => this.applyCustomer(c, false),
        error: () => {},
      });
    }
    // Buscador de clientes con debounce.
    this.cust$.pipe(debounceTime(250)).subscribe(q => this.runCustSearch(q));
  }

  private deduceDocType() {
    const id = this.identification();
    if (id === '9999999999999') { this.documentType.set('07'); return; }
    if (id.length === 13) this.documentType.set('04');
    else if (id.length === 10) this.documentType.set('05');
  }

  /** Carga los datos de un cliente en el formulario. */
  private applyCustomer(c: Customer, overwriteName = true) {
    if (c.document_id) this.identification.set(c.document_id);
    if (c.document_type) this.documentType.set(c.document_type);
    if (overwriteName || !this.name().trim()) this.name.set(c.full_name || this.name());
    this.businessName.set(c.business_name || '');
    if (c.email) this.email.set(c.email);
    this.address.set(c.address || '');
    this.city.set(c.city || '');
    this.province.set(c.province || '');
    if (c.phone) this.phone.set(c.phone);
    this.deduceDocType();
  }

  // ── Búsqueda de cliente para facturar a otros datos ──
  onCustQuery(q: string) { this.custQuery.set(q); this.custOpen.set(true); this.cust$.next(q); }
  private runCustSearch(q: string) {
    const term = (q || '').trim();
    if (term.length < 2) { this.custResults.set([]); return; }
    this.custSvc.list({ search: term, page_size: 8 }).subscribe({
      next: r => this.custResults.set(r.results || []),
      error: () => this.custResults.set([]),
    });
  }
  pickCustomer(c: Customer) {
    this.applyCustomer(c, true);
    this.custOpen.set(false);
    this.custQuery.set('');
    this.custResults.set([]);
  }
  closeCustSoon() { setTimeout(() => this.custOpen.set(false), 150); }

  /** Respaldo de la identificación/nombre/tipo REALES antes de pasar a CF,
   *  para poder restaurarlos si el usuario vuelve a desmarcar Consumidor Final. */
  private prevReal = { identification: '', name: '', documentType: '05' };

  onDocType(v: string) {
    const prev = this.documentType();
    if (v === '07') {
      // Al entrar a CF, guarda los datos reales actuales (una sola vez).
      if (prev !== '07') {
        this.prevReal = {
          identification: this.identification(),
          name: this.name(),
          documentType: prev || '05',
        };
      }
      this.documentType.set('07');
      this.identification.set('9999999999999');
      this.name.set('CONSUMIDOR FINAL');
    } else {
      this.documentType.set(v);
      if (prev === '07') {
        // Volvió de CF: restaura lo que había antes en vez de limpiarlo.
        this.identification.set(this.prevReal.identification);
        this.name.set(this.prevReal.name);
      } else {
        // Cambio entre tipos reales: solo limpia placeholders CF si quedaron.
        if (this.identification().trim() === '9999999999999') this.identification.set('');
        if (this.name().trim() === 'CONSUMIDOR FINAL') this.name.set('');
      }
    }
  }

  /** Interruptor rápido: emitir como Consumidor Final o pedir datos del cliente. */
  toggleConsumidorFinal(on: boolean) {
    // Al desmarcar, restaura el tipo de documento real previo (o cédula).
    this.onDocType(on ? '07' : (this.prevReal.documentType || '05'));
  }

  emit() {
    if (!this.canEmit()) return;
    this.saving.set(true);
    const body = {
      customer_data: {
        identification: this.identification().trim(),
        document_type: this.documentType(),
        name: this.name().trim(),
        business_name: this.businessName().trim() || undefined,
        email: this.email().trim() || undefined,
        address: this.address().trim() || undefined,
        city: this.city().trim() || undefined,
        province: this.province().trim() || undefined,
        phone: this.phone().trim() || undefined,
      },
      payment_form: this.paymentForm(),
      payment_plazo: this.aCredito() ? +this.plazo() : 0,
      payment_unidad: this.unidad(),
    };
    this.orderSvc.emitInvoice(this.order.id, body).subscribe({
      next: updated => {
        this.saving.set(false);
        this.notify.success('Factura enviada al SRI. El resultado llegará en unos momentos.');
        this.emitted.emit(updated);
        this.closed.emit();
      },
      error: e => {
        this.saving.set(false);
        this.notify.fromServerError(e, 'No se pudo emitir la factura.');
      },
    });
  }

  close() {
    if (this.saving()) return;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.close(); }
}
