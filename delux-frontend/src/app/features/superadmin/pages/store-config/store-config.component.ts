import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotifyService } from '@shared/services/notify.service';
import { BrandingService } from '@core/services/branding.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationsService } from '@shared/services/notifications.service';
import { ProductService, Product } from '@features/superadmin/services/product.service';
import { StoreSettingsService, StorePayments, StoreOptions } from '@features/superadmin/services/store-settings.service';

type TabId = 'perfil' | 'tienda' | 'impuestos' | 'pagos' | 'notificaciones';

@Component({
  selector: 'dlx-store-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
      <i class="fa-solid fa-gear"></i>
      <span class="uppercase tracking-widest font-semibold">Configuración</span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-1">Configuración</h1>
    <p class="text-slate-500 text-sm mb-5">Perfil, impuestos, pagos y notificaciones de tu negocio.</p>

    <!-- Tabs (mismo estilo que superadmin) -->
    <nav class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#334155] mb-6" aria-label="Configuración">
      @for (t of tabs; track t.id) {
        <button type="button" (click)="tab.set(t.id)"
                class="px-4 py-2.5 text-sm font-semibold transition flex items-center gap-2"
                [class.border-b-2]="tab() === t.id"
                [class.border-[var(--dash-primary)]]="tab() === t.id"
                [class.text-[var(--dash-primary-d)]]="tab() === t.id"
                [class.dark:text-blue-300]="tab() === t.id"
                [class.dark:border-blue-500]="tab() === t.id"
                [class.text-slate-500]="tab() !== t.id"
                [class.dark:text-slate-400]="tab() !== t.id"
                [class.hover:text-slate-700]="tab() !== t.id">
          <i class="fa-solid {{ t.icon }} text-[12px]"></i>
          {{ t.label }}
        </button>
      }
    </nav>

    <!-- ══════════ PERFIL ══════════ -->
    @if (tab() === 'perfil') {
      <div class="grid lg:grid-cols-2 gap-6 max-w-4xl">
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-4">Perfil personal</h2>
          <div class="space-y-4">
            <div>
              <label class="eg-label">Nombre completo</label>
              <input [(ngModel)]="prof.full_name" class="eg-input" placeholder="Tu nombre" />
            </div>
            <div>
              <label class="eg-label">Teléfono</label>
              <input [(ngModel)]="prof.phone" class="eg-input" placeholder="09..." />
            </div>
            <div>
              <label class="eg-label">Correo electrónico</label>
              <input [value]="auth.user()?.email || ''" disabled class="eg-input bg-slate-50 text-slate-500" />
              <p class="text-[11px] text-slate-400 mt-1">El correo lo cambia un administrador.</p>
            </div>
            <button type="button" (click)="saveProfile()" [disabled]="savingProfile()"
                    class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
              @if (savingProfile()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
              Guardar cambios
            </button>
          </div>
        </div>

        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-4">Cambiar contraseña</h2>
          <div class="space-y-4">
            <div>
              <label class="eg-label">Contraseña actual</label>
              <input type="password" [(ngModel)]="pwd.current" class="eg-input" autocomplete="current-password" />
            </div>
            <div>
              <label class="eg-label">Nueva contraseña</label>
              <input type="password" [(ngModel)]="pwd.next" class="eg-input" autocomplete="new-password" />
            </div>
            <button type="button" (click)="savePassword()" [disabled]="savingPwd()"
                    class="px-5 h-11 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              @if (savingPwd()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
              Actualizar contraseña
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════ TIENDA ══════════ -->
    @if (tab() === 'tienda') {
      <div class="max-w-3xl space-y-6">
        <!-- Métodos de entrega -->
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Métodos de entrega</h2>
          <p class="text-sm text-slate-500 mb-4">Activa cómo tus clientes pueden recibir sus pedidos en la tienda en línea.</p>

          <div class="flex items-center justify-between border border-slate-200 rounded-xl p-4 mb-3">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-truck text-slate-500"></i>
              <div>
                <p class="font-medium text-sm">Envío a domicilio</p>
                <p class="text-[11px] text-slate-500">El pedido se lleva al cliente.</p>
              </div>
            </div>
            <button type="button" (click)="store.delivery_enabled = !store.delivery_enabled"
                    class="w-12 h-7 rounded-full transition relative shrink-0"
                    [ngClass]="store.delivery_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                    [ngClass]="store.delivery_enabled ? 'left-6' : 'left-1'"></span>
            </button>
          </div>

          <div class="flex items-center justify-between border border-slate-200 rounded-xl p-4">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-store text-slate-500"></i>
              <div>
                <p class="font-medium text-sm">Retiro en tienda</p>
                <p class="text-[11px] text-slate-500">El cliente recoge su pedido en tu negocio.</p>
              </div>
            </div>
            <button type="button" (click)="store.pickup_enabled = !store.pickup_enabled"
                    class="w-12 h-7 rounded-full transition relative shrink-0"
                    [ngClass]="store.pickup_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                    [ngClass]="store.pickup_enabled ? 'left-6' : 'left-1'"></span>
            </button>
          </div>
        </div>

        <!-- Mostrar productos sin stock -->
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">¿Cómo se muestran los productos sin stock?</h2>
          <p class="text-sm text-slate-500 mb-4">Define qué ve el cliente cuando un producto se queda sin unidades.</p>
          <div class="space-y-2">
            @for (o of oosOptions; track o.id) {
              <label class="flex items-start gap-3 border rounded-xl p-4 cursor-pointer"
                     [ngClass]="store.out_of_stock_display === o.id ? 'border-violet-500 bg-violet-50/40' : 'border-slate-200 hover:bg-slate-50'">
                <input type="radio" name="oos" [value]="o.id" [(ngModel)]="store.out_of_stock_display"
                       class="mt-1 w-4 h-4 accent-violet-500" />
                <div>
                  <p class="font-medium text-sm">
                    {{ o.title }}
                    @if (o.rec) { <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Recomendado</span> }
                  </p>
                  <p class="text-[11px] text-slate-500">{{ o.desc }}</p>
                </div>
              </label>
            }
          </div>
        </div>

        <!-- Horarios de atención (ya existe) -->
        <a routerLink="/app/admin/schedules"
           class="card p-5 flex items-center justify-between hover:bg-slate-50">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-clock text-slate-500"></i>
            <div>
              <p class="font-medium text-sm">Horarios de atención</p>
              <p class="text-[11px] text-slate-500">Define apertura y cierre por día en cada sucursal.</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-slate-400"></i>
        </a>

        <button type="button" (click)="saveStore()" [disabled]="savingStore()"
                class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
          @if (savingStore()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
          Guardar cambios
        </button>
      </div>
    }

    <!-- ══════════ IMPUESTOS ══════════ -->
    @if (tab() === 'impuestos') {
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">IVA por defecto</h2>
          <p class="text-sm text-slate-500 mb-4">
            Se aplica a los productos nuevos que no tengan un IVA específico. También es el que
            muestra el selector de IVA en Inventario y en el formulario de producto.
          </p>
          <div class="flex flex-wrap gap-2 mb-3">
            @for (r of presets; track r) {
              <button type="button" (click)="defaultIva.set(r)"
                      class="px-4 h-10 rounded-xl border text-sm font-semibold"
                      [ngClass]="defaultIva() === r ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 hover:bg-slate-50'">
                {{ r }}%
              </button>
            }
          </div>
          <div class="flex items-center gap-2 mb-4">
            <label class="text-sm text-slate-500">Personalizado:</label>
            <input type="number" min="0" max="100" step="0.5" [(ngModel)]="customDefault"
                   (ngModelChange)="onCustomDefault($event)"
                   class="eg-input !h-10 w-28" placeholder="%" />
          </div>
          <button type="button" (click)="saveDefault()" [disabled]="savingDefault()"
                  class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
            @if (savingDefault()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
            Guardar IVA por defecto
          </button>
        </div>

        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Aplicar IVA a productos</h2>
          <p class="text-sm text-slate-500 mb-4">
            Asigna un IVA a productos específicos (omite el IVA por defecto). Puedes aplicarlo a los
            seleccionados o a todo el catálogo.
          </p>

          <label class="eg-label">IVA a aplicar</label>
          <div class="flex flex-wrap gap-2 mb-4">
            <button type="button" (click)="applyRate.set(null)"
                    class="px-3 h-9 rounded-lg border text-sm font-semibold"
                    [ngClass]="applyRate() === null ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 hover:bg-slate-50'">
              Global ({{ defaultIva() }}%)
            </button>
            @for (r of presets; track r) {
              <button type="button" (click)="applyRate.set(r)"
                      class="px-3 h-9 rounded-lg border text-sm font-semibold"
                      [ngClass]="applyRate() === r ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 hover:bg-slate-50'">
                {{ r }}%
              </button>
            }
          </div>

          <div class="relative mb-3">
            <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input [(ngModel)]="search" (ngModelChange)="onSearch()"
                   class="eg-input has-icon-left" placeholder="Buscar producto…" />
          </div>

          <div class="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
            <button type="button" (click)="toggleAllVisible()" class="font-semibold text-violet-600 hover:text-violet-800">
              {{ allVisibleSelected() ? 'Quitar selección' : 'Seleccionar todos (visibles)' }}
            </button>
            <span>{{ selected().size }} seleccionados</span>
          </div>

          <div class="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
            @if (loading()) {
              <div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i></div>
            } @else if (products().length === 0) {
              <div class="p-8 text-center text-slate-400 text-sm">No hay productos.</div>
            } @else {
              @for (p of products(); track p.id) {
                <label class="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" [checked]="selected().has(p.id)" (change)="toggle(p.id)"
                         class="w-4 h-4 accent-violet-500" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ p.name }}</p>
                    <p class="text-[11px] text-slate-500">$ {{ +p.base_price | number:'1.2-2' }}</p>
                  </div>
                  <span class="text-[11px] px-2 py-0.5 rounded-full"
                        [ngClass]="p.tax_rate != null ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'">
                    {{ ivaLabel(p) }}
                  </span>
                </label>
              }
            }
          </div>

          <div class="flex flex-wrap gap-2 mt-4">
            <button type="button" (click)="applyToSelected()"
                    [disabled]="applying() || selected().size === 0"
                    class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
              @if (applying()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
              Aplicar a seleccionados
            </button>
            <button type="button" (click)="applyToAll()" [disabled]="applying()"
                    class="px-5 h-11 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              Aplicar a todos
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════ PAGOS ══════════ -->
    @if (tab() === 'pagos') {
      <div class="max-w-3xl space-y-6">
        <!-- Enlace de la tienda -->
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Tu tienda en línea</h2>
          <p class="text-sm text-slate-500 mb-3">Comparte este enlace con tus clientes para que vean tu catálogo.</p>
          <div class="flex gap-2">
            <input [value]="storeUrl" readonly class="eg-input font-mono text-sm" />
            <button type="button" (click)="copyStoreUrl()"
                    class="shrink-0 px-4 h-11 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">
              <i class="fa-solid fa-copy mr-1"></i> Copiar
            </button>
          </div>
        </div>

        <!-- Transferencia bancaria -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-bold tracking-tight">Transferencia bancaria</h2>
              <p class="text-sm text-slate-500">Datos de cuenta que verá el cliente al pagar.</p>
            </div>
            <button type="button" (click)="pay.transfer_enabled = !pay.transfer_enabled"
                    class="w-12 h-7 rounded-full transition relative shrink-0"
                    [ngClass]="pay.transfer_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                    [ngClass]="pay.transfer_enabled ? 'left-6' : 'left-1'"></span>
            </button>
          </div>
          <div class="grid sm:grid-cols-2 gap-4" [class.opacity-50]="!pay.transfer_enabled" [class.pointer-events-none]="!pay.transfer_enabled">
            <div><label class="eg-label">Banco</label><input [(ngModel)]="pay.bank_name" class="eg-input" /></div>
            <div>
              <label class="eg-label">Tipo de cuenta</label>
              <select [(ngModel)]="pay.bank_account_type" class="eg-input">
                <option value="Ahorros">Ahorros</option>
                <option value="Corriente">Corriente</option>
              </select>
            </div>
            <div><label class="eg-label">Titular</label><input [(ngModel)]="pay.bank_account_holder" class="eg-input" /></div>
            <div><label class="eg-label">Número de cuenta</label><input [(ngModel)]="pay.bank_account_number" class="eg-input font-mono" /></div>
            <div><label class="eg-label">Cédula / RUC</label><input [(ngModel)]="pay.bank_account_document" class="eg-input" /></div>
            <div><label class="eg-label">Email de contacto</label><input [(ngModel)]="pay.bank_contact_email" class="eg-input" /></div>
            <div><label class="eg-label">WhatsApp de contacto</label><input [(ngModel)]="pay.bank_contact_whatsapp" class="eg-input" /></div>
            <div class="sm:col-span-2">
              <label class="eg-label">Instrucciones</label>
              <textarea [(ngModel)]="pay.transfer_instructions" rows="2" class="eg-input" placeholder="Ej. Envía el comprobante por WhatsApp."></textarea>
            </div>
          </div>
        </div>

        <!-- DeUna QR -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-bold tracking-tight">DE UNA (QR)</h2>
              <p class="text-sm text-slate-500">Sube el QR para que el cliente pague escaneando.</p>
            </div>
            <button type="button" (click)="pay.deuna_enabled = !pay.deuna_enabled"
                    class="w-12 h-7 rounded-full transition relative shrink-0"
                    [ngClass]="pay.deuna_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                    [ngClass]="pay.deuna_enabled ? 'left-6' : 'left-1'"></span>
            </button>
          </div>
          <div class="flex flex-wrap items-start gap-5" [class.opacity-50]="!pay.deuna_enabled" [class.pointer-events-none]="!pay.deuna_enabled">
            <div class="w-40 h-40 rounded-xl border-2 border-dashed border-slate-200 grid place-items-center overflow-hidden bg-slate-50 shrink-0">
              @if (qrPreview() || pay.deuna_qr_url) {
                <img [src]="qrPreview() || pay.deuna_qr_url" alt="QR DeUna" class="w-full h-full object-contain" />
              } @else {
                <span class="text-slate-400 text-xs text-center px-2"><i class="fa-solid fa-qrcode text-2xl block mb-1"></i>Sin QR</span>
              }
            </div>
            <div class="flex-1 min-w-[220px] space-y-3">
              <label class="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 cursor-pointer">
                <i class="fa-solid fa-upload"></i> Subir QR
                <input type="file" accept="image/*" class="hidden" (change)="onQrSelected($event)" />
              </label>
              <div>
                <label class="eg-label">Instrucciones</label>
                <textarea [(ngModel)]="pay.deuna_instructions" rows="2" class="eg-input" placeholder="Ej. Escanea el QR y envía el comprobante."></textarea>
              </div>
            </div>
          </div>
        </div>

        <button type="button" (click)="savePayments()" [disabled]="savingPay()"
                class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
          @if (savingPay()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> }
          Guardar datos de pago
        </button>
      </div>
    }

    <!-- ══════════ NOTIFICACIONES ══════════ -->
    @if (tab() === 'notificaciones') {
      <div class="card p-6 max-w-2xl">
        <h2 class="font-bold tracking-tight mb-1">Notificaciones</h2>
        <p class="text-sm text-slate-500 mb-5">Controla los avisos y sonidos del sistema.</p>

        <div class="flex items-center justify-between border border-slate-200 rounded-xl p-4 mb-3">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-volume-high text-slate-500"></i>
            <div>
              <p class="font-medium text-sm">Sonido al recibir avisos</p>
              <p class="text-[11px] text-slate-500">Reproduce un sonido cuando llega una notificación.</p>
            </div>
          </div>
          <button type="button" (click)="toggleSound()"
                  class="w-12 h-7 rounded-full transition relative"
                  [ngClass]="notif.prefs().sound_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
            <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                  [ngClass]="notif.prefs().sound_enabled ? 'left-6' : 'left-1'"></span>
          </button>
        </div>

        <a routerLink="/app/notifications"
           class="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:bg-slate-50">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-sliders text-slate-500"></i>
            <div>
              <p class="font-medium text-sm">Más opciones de notificaciones</p>
              <p class="text-[11px] text-slate-500">No molestar por horario y avisos por tipo, en el centro de notificaciones.</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-slate-400"></i>
        </a>
      </div>
    }
  `,
})
export class StoreConfigComponent implements OnInit {
  private productSvc = inject(ProductService);
  private storeSvc = inject(StoreSettingsService);
  private branding = inject(BrandingService);
  private notifyToast = inject(NotifyService);
  protected auth = inject(AuthService);
  protected notif = inject(NotificationsService);

  tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'perfil',         label: 'Perfil',        icon: 'fa-id-card' },
    { id: 'tienda',         label: 'Tienda',        icon: 'fa-store' },
    { id: 'impuestos',      label: 'Impuestos',     icon: 'fa-percent' },
    { id: 'pagos',          label: 'Pagos',         icon: 'fa-credit-card' },
    { id: 'notificaciones', label: 'Notificaciones', icon: 'fa-bell' },
  ];
  tab = signal<TabId>('perfil');
  presets = [0, 5, 12, 15];
  storeUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Perfil
  prof = { full_name: '', phone: '' };
  pwd = { current: '', next: '' };
  savingProfile = signal(false);
  savingPwd = signal(false);

  // Default IVA
  defaultIva = signal<number>(15);
  customDefault: number | null = null;
  savingDefault = signal(false);

  // Aplicar a productos
  applyRate = signal<number | null>(null);
  products = signal<Product[]>([]);
  selected = signal<Set<number>>(new Set());
  search = '';
  loading = signal(true);
  applying = signal(false);
  private searchTimer: any = null;

  // Pagos
  pay: StorePayments = {
    transfer_enabled: false, bank_name: '', bank_account_type: 'Ahorros', bank_account_holder: '',
    bank_account_number: '', bank_account_document: '', bank_contact_email: '', bank_contact_whatsapp: '',
    transfer_instructions: '', deuna_enabled: false, deuna_instructions: '', deuna_qr_url: '',
  };
  qrFile: File | null = null;
  qrPreview = signal<string>('');
  savingPay = signal(false);

  // Tienda
  store: StoreOptions = { pickup_enabled: true, delivery_enabled: true, out_of_stock_display: 'SHOW' };
  savingStore = signal(false);
  oosOptions: { id: StoreOptions['out_of_stock_display']; title: string; desc: string; rec?: boolean }[] = [
    { id: 'SHOW',     title: 'Mostrarlos como están', desc: 'El cliente los ve igual que cualquier otro.' },
    { id: 'HIDE',     title: 'Ocultarlos del catálogo', desc: 'No se muestran hasta que vuelvas a tener stock.', rec: true },
    { id: 'SOLD_OUT', title: 'Mostrarlos como agotados', desc: 'Siguen visibles con el aviso "Agotado". El cliente no puede añadirlos al carrito.' },
  ];

  allVisibleSelected = computed(() => {
    const list = this.products(); const sel = this.selected();
    return list.length > 0 && list.every(p => sel.has(p.id));
  });

  ngOnInit(): void {
    const u = this.auth.user();
    this.prof.full_name = u?.full_name || '';
    this.prof.phone = u?.phone || '';
    this.auth.me().subscribe(() => {
      const uu = this.auth.user();
      this.prof.full_name = uu?.full_name || '';
      this.prof.phone = uu?.phone || '';
    });

    this.storeSvc.getTax().subscribe({
      next: r => { this.defaultIva.set(+r.tax_rate); this.customDefault = +r.tax_rate; },
      error: () => {},
    });
    this.storeSvc.getPayments().subscribe({ next: p => this.pay = { ...this.pay, ...p }, error: () => {} });
    this.storeSvc.getStoreOptions().subscribe({ next: o => this.store = { ...this.store, ...o }, error: () => {} });
    this.notif.loadPreferences();
    this.loadProducts();
  }

  // ── Perfil ──
  saveProfile(): void {
    this.savingProfile.set(true);
    this.auth.updateProfile({ full_name: this.prof.full_name.trim(), phone: (this.prof.phone || '').trim() }).subscribe({
      next: () => { this.savingProfile.set(false); this.notifyToast.success('Perfil actualizado.'); },
      error: () => { this.savingProfile.set(false); this.notifyToast.error('No se pudo actualizar el perfil.'); },
    });
  }
  savePassword(): void {
    if (!this.pwd.current || !this.pwd.next) { this.notifyToast.error('Completa ambos campos.'); return; }
    this.savingPwd.set(true);
    this.auth.changePassword(this.pwd.current, this.pwd.next).subscribe({
      next: () => { this.savingPwd.set(false); this.pwd = { current: '', next: '' }; this.notifyToast.success('Contraseña actualizada.'); },
      error: () => { this.savingPwd.set(false); this.notifyToast.error('No se pudo cambiar la contraseña.'); },
    });
  }

  // ── Tienda ──
  copyStoreUrl(): void {
    navigator.clipboard?.writeText(this.storeUrl)
      .then(() => this.notifyToast.success('Enlace copiado.'))
      .catch(() => this.notifyToast.error('No se pudo copiar.'));
  }

  // ── Default IVA ──
  onCustomDefault(v: number): void { if (v != null && !isNaN(+v)) this.defaultIva.set(+v); }
  saveDefault(): void {
    const val = this.defaultIva();
    if (val < 0 || val > 100) { this.notifyToast.error('El IVA debe estar entre 0 y 100.'); return; }
    this.savingDefault.set(true);
    this.storeSvc.setTax(val).subscribe({
      next: r => {
        this.defaultIva.set(+r.tax_rate);
        this.branding.load();
        this.savingDefault.set(false);
        this.notifyToast.success('IVA por defecto guardado.');
      },
      error: () => { this.savingDefault.set(false); this.notifyToast.error('No se pudo guardar.'); },
    });
  }

  // ── Productos ──
  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadProducts(), 300);
  }
  loadProducts(): void {
    this.loading.set(true);
    this.productSvc.list({ search: this.search, page_size: 100 }).subscribe({
      next: r => { this.products.set(r.results); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
  ivaLabel(p: Product): string {
    return p.tax_rate != null ? `${+p.tax_rate}%` : `Global (${this.defaultIva()}%)`;
  }
  toggle(id: number): void {
    const s = new Set(this.selected());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selected.set(s);
  }
  toggleAllVisible(): void {
    if (this.allVisibleSelected()) { this.selected.set(new Set()); return; }
    this.selected.set(new Set(this.products().map(p => p.id)));
  }
  applyToSelected(): void {
    const ids = Array.from(this.selected());
    if (!ids.length) return;
    this.doApply({ tax_rate: this.applyRate(), product_ids: ids });
  }
  applyToAll(): void { this.doApply({ tax_rate: this.applyRate(), all: true }); }
  private doApply(body: { tax_rate: number | null; product_ids?: number[]; all?: boolean }): void {
    this.applying.set(true);
    this.productSvc.bulkTax(body).subscribe({
      next: r => {
        this.applying.set(false);
        this.selected.set(new Set());
        this.loadProducts();
        this.notifyToast.success(`IVA aplicado a ${r.updated} producto(s).`);
      },
      error: () => { this.applying.set(false); this.notifyToast.error('No se pudo aplicar el IVA.'); },
    });
  }

  // ── Pagos ──
  onQrSelected(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    this.qrFile = f;
    const reader = new FileReader();
    reader.onload = () => this.qrPreview.set(reader.result as string);
    reader.readAsDataURL(f);
  }
  savePayments(): void {
    this.savingPay.set(true);
    const fd = new FormData();
    fd.append('transfer_enabled', String(this.pay.transfer_enabled));
    fd.append('bank_name', this.pay.bank_name || '');
    fd.append('bank_account_type', this.pay.bank_account_type || '');
    fd.append('bank_account_holder', this.pay.bank_account_holder || '');
    fd.append('bank_account_number', this.pay.bank_account_number || '');
    fd.append('bank_account_document', this.pay.bank_account_document || '');
    fd.append('bank_contact_email', this.pay.bank_contact_email || '');
    fd.append('bank_contact_whatsapp', this.pay.bank_contact_whatsapp || '');
    fd.append('transfer_instructions', this.pay.transfer_instructions || '');
    fd.append('deuna_enabled', String(this.pay.deuna_enabled));
    fd.append('deuna_instructions', this.pay.deuna_instructions || '');
    if (this.qrFile) fd.append('deuna_qr', this.qrFile);
    this.storeSvc.savePayments(fd).subscribe({
      next: p => {
        this.pay = { ...this.pay, ...p };
        this.qrFile = null; this.qrPreview.set('');
        this.branding.load();
        this.savingPay.set(false);
        this.notifyToast.success('Datos de pago guardados.');
      },
      error: () => { this.savingPay.set(false); this.notifyToast.error('No se pudo guardar.'); },
    });
  }

  // ── Tienda ──
  saveStore(): void {
    if (!this.store.pickup_enabled && !this.store.delivery_enabled) {
      this.notifyToast.error('Deja al menos un método de entrega activo.');
      return;
    }
    this.savingStore.set(true);
    this.storeSvc.saveStoreOptions(this.store).subscribe({
      next: o => {
        this.store = { ...this.store, ...o };
        this.branding.load();   // refresca checkout/catálogo con los nuevos flags
        this.savingStore.set(false);
        this.notifyToast.success('Opciones de tienda guardadas.');
      },
      error: () => { this.savingStore.set(false); this.notifyToast.error('No se pudo guardar.'); },
    });
  }

  // ── Notificaciones ──
  toggleSound(): void {
    this.notif.savePreferences({ sound_enabled: !this.notif.prefs().sound_enabled });
  }
}
