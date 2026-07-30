import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SRI_IVA_RATES } from '@shared/data/taxes';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import { NotifyService } from '@shared/services/notify.service';
import { BrandingService } from '@core/services/branding.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationsService } from '@shared/services/notifications.service';
import { DlxPasswordInputComponent } from '@shared/ui/password-input.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { ScheduleEditorComponent } from '@features/superadmin/pages/schedule-editor/schedule-editor.component';
import { ProductService, Product } from '@features/superadmin/services/product.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { StoreSettingsService, StorePayments, StoreOptions } from '@features/superadmin/services/store-settings.service';

type TabId = 'perfil' | 'tienda' | 'impuestos' | 'pagos' | 'notificaciones';

@Component({
  selector: 'dlx-store-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxPasswordInputComponent, ScheduleEditorComponent, DlxPriceInputComponent],
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
              <dlx-password-input [(ngModel)]="pwd.current" autocomplete="current-password" placeholder="••••••••" />
            </div>
            <div>
              <label class="eg-label">Nueva contraseña</label>
              <dlx-password-input [(ngModel)]="pwd.next" autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
            </div>
            <button type="button" (click)="savePassword()" [disabled]="savingPwd()"
                    class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
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
          @if (branchCtx.current() != null) {
            <p class="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
              <i class="fa-solid fa-store text-slate-400"></i>
              Catálogo de: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ branchCtx.currentName() }}</span>
            </p>
          }
        </div>

        <!-- Catálogo PDF -->
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Catálogo en PDF</h2>
          <p class="text-sm text-slate-500 mb-4">Genera un catálogo con diseño moderno de todos tus productos (foto, precio, tallas, colores y stock) para descargar o compartir.</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" (click)="downloadCatalog()" [disabled]="pdfLoading()"
                    class="px-5 h-11 rounded-xl bg-ink-950 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
              @if (pdfLoading()) { <i class="fa-solid fa-spinner fa-spin mr-1"></i> } @else { <i class="fa-solid fa-file-pdf mr-1"></i> }
              Descargar catálogo PDF
            </button>
            <button type="button" (click)="shareCatalog()"
                    class="px-5 h-11 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50">
              <i class="fa-solid fa-share-nodes mr-1"></i> Compartir enlace
            </button>
          </div>
        </div>

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

        <!-- Consumidor Final -->
        <div class="card p-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-bold tracking-tight">Cliente "Consumidor Final"</h2>
              <p class="text-sm text-slate-500 mt-0.5">
                Si está activo, las ventas sin cliente se asignan automáticamente a un cliente
                "Consumidor Final" (útil para facturación electrónica). Si está inactivo, esas ventas quedan sin cliente.
              </p>
            </div>
            <button type="button" (click)="store.consumidor_final_enabled = !store.consumidor_final_enabled"
                    class="w-12 h-7 rounded-full transition relative shrink-0"
                    [ngClass]="store.consumidor_final_enabled ? 'bg-emerald-500' : 'bg-slate-300'">
              <span class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                    [ngClass]="store.consumidor_final_enabled ? 'left-6' : 'left-1'"></span>
            </button>
          </div>
        </div>

        <!-- Horarios de atención (abre modal) -->
        <button type="button" (click)="schedulesOpen.set(true)"
           class="card p-5 w-full flex items-center justify-between hover:bg-slate-50 text-left">
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-clock text-slate-500"></i>
            <div>
              <p class="font-medium text-sm">Horarios de atención</p>
              <p class="text-[11px] text-slate-500">Define apertura y cierre por día en cada sucursal.</p>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-slate-400"></i>
        </button>

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
            <dlx-price-input [(ngModel)]="customDefault" (ngModelChange)="onCustomDefault($event)"
                             symbol="%" [nullable]="true" placeholder="IVA" extraClass="!h-10 w-28" />
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

    <!-- Modal ancho: Horarios de atención (reusa el editor existente) -->
    @if (schedulesOpen()) {
      <div class="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
        <div class="absolute inset-0 bg-black/40" (click)="schedulesOpen.set(false)"></div>
        <div class="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 my-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold">Horarios de atención</h2>
            <button type="button" (click)="schedulesOpen.set(false)"
                    class="w-8 h-8 grid place-items-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <dlx-schedule-editor />
        </div>
      </div>
    }
  `,
})
export class StoreConfigComponent implements OnInit {
  private productSvc = inject(ProductService);
  private adminSvc = inject(AdminService);
  private storeSvc = inject(StoreSettingsService);
  private branding = inject(BrandingService);
  protected branchCtx = inject(BranchContextService);
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
  presets = SRI_IVA_RATES;
  /** URL pública del catálogo. Incluye la sucursal del selector global si hay una activa. */
  get storeUrl(): string {
    const origin = (typeof window !== 'undefined' ? window.location.origin : '');
    const id = this.branchCtx.current();
    return id != null ? `${origin}/catalogo?sucursal=${id}` : `${origin}/catalogo`;
  }
  schedulesOpen = signal(false);
  pdfLoading = signal(false);

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
  store: StoreOptions = { pickup_enabled: true, delivery_enabled: true, out_of_stock_display: 'SHOW', consumidor_final_enabled: false };
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

  // ── Compartir ──
  async shareCatalog(): Promise<void> {
    const data = { title: this.branding.siteName(), text: 'Mira nuestro catálogo', url: this.storeUrl };
    const nav = navigator as any;
    if (nav.share) {
      try { await nav.share(data); } catch { /* el usuario canceló */ }
    } else {
      this.copyStoreUrl();
    }
  }

  // ── Catálogo PDF ──
  private trunc(s: string, n: number): string { s = s || ''; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  private loadImg(url: string, png = false): Promise<{ data: string; w: number; h: number } | null> {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d')!.drawImage(img, 0, 0);
          resolve({ data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85), w: img.naturalWidth, h: img.naturalHeight });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  private isPromo(p: Product): boolean {
    return !!p.compare_at_price && Number(p.compare_at_price) > Number(p.base_price);
  }
  private pdfCover(doc: jsPDF, store: string, tagline: string, logo: { data: string; w: number; h: number } | null, pageW: number, pageH: number, branchName = ''): void {
    const cx = pageW / 2;
    doc.setFillColor(9, 12, 20); doc.rect(0, 0, pageW, pageH, 'F');
    // Marco doble dorado
    doc.setDrawColor(198, 161, 74); doc.setLineWidth(0.7); doc.rect(9, 9, pageW - 18, pageH - 18, 'S');
    doc.setLineWidth(0.2); doc.rect(12.5, 12.5, pageW - 25, pageH - 25, 'S');
    // Etiqueta superior
    doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('C A T Á L O G O   O F I C I A L', cx, 42, { align: 'center' });
    // Título central
    doc.setTextColor(248, 248, 248); doc.setFont('times', 'normal'); doc.setFontSize(58);
    doc.text('Catálogo', cx, pageH / 2 - 6, { align: 'center' });
    doc.setTextColor(198, 161, 74); doc.setFont('times', 'italic'); doc.setFontSize(30);
    doc.text('de productos', cx, pageH / 2 + 13, { align: 'center' });
    doc.setDrawColor(198, 161, 74); doc.setLineWidth(0.5);
    doc.line(cx - 22, pageH / 2 + 23, cx + 22, pageH / 2 + 23);
    if (tagline) {
      doc.setTextColor(170, 175, 185); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      doc.text(this.trunc(tagline, 60), cx, pageH / 2 + 33, { align: 'center' });
    }
    // Pie: logo + nombre + año
    if (logo) {
      const h = 15; const w = Math.min(logo.w * (h / logo.h), 58);
      try { doc.addImage(logo.data, 'PNG', cx - w / 2, pageH - 58, w, h); } catch { /* usa texto */ }
    }
    doc.setTextColor(215, 215, 220); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(store, cx, pageH - 36, { align: 'center' });
    doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(String(new Date().getFullYear()), cx, pageH - 29, { align: 'center' });
    if (branchName) {
      doc.setTextColor(170, 175, 185); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text('Sucursal: ' + this.trunc(branchName, 40), cx, pageH - 22, { align: 'center' });
    }
  }
  private pdfContact(doc: jsPDF, store: string, logo: { data: string; w: number; h: number } | null, branches: AdminBranch[], pageW: number, pageH: number): void {
    const cx = pageW / 2, M = 22;
    doc.setFillColor(9, 12, 20); doc.rect(0, 0, pageW, pageH, 'F');
    doc.setDrawColor(198, 161, 74); doc.setLineWidth(0.7); doc.rect(9, 9, pageW - 18, pageH - 18, 'S');
    doc.setLineWidth(0.2); doc.rect(12.5, 12.5, pageW - 25, pageH - 25, 'S');
    // Encabezado
    doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('G U Í A   D E   C O M P R A', cx, 28, { align: 'center' });
    doc.setTextColor(248, 248, 248); doc.setFont('times', 'normal'); doc.setFontSize(26);
    doc.text('Cómo comprar', cx, 40, { align: 'center' });
    doc.setDrawColor(198, 161, 74); doc.setLineWidth(0.4); doc.line(cx - 18, 44, cx + 18, 44);

    let y = 58;
    const section = (t: string) => {
      doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(t.toUpperCase(), M, y);
      doc.setDrawColor(55, 61, 74); doc.setLineWidth(0.2); doc.line(M, y + 2.5, pageW - M, y + 2.5);
      y += 8.5;
    };
    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      if (label) { doc.setTextColor(150, 155, 165); doc.text(label, M, y); }
      doc.setTextColor(226, 226, 231); doc.setFontSize(10);
      doc.text(value, label ? M + 30 : M, y);
      y += 6.2;
    };
    const bullet = (value: string) => {
      doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text('•', M, y);
      doc.setTextColor(226, 226, 231); doc.setFont('helvetica', 'normal');
      doc.text(value, M + 5, y);
      y += 6.2;
    };

    // Contacto
    section('Contacto');
    if (this.branding.whatsappNumber()) row('Tel / WhatsApp', this.branding.whatsappNumber());
    if (this.branding.contactEmail()) row('Correo', this.branding.contactEmail());
    doc.setTextColor(160, 165, 175); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.text('Escríbenos y con gusto te ayudamos con tu pedido.', M, y); y += 9;

    // Métodos de pago
    section('Métodos de pago');
    let anyPay = false;
    if (this.branding.transferEnabled()) { bullet('Transferencia bancaria'); anyPay = true; }
    if (this.branding.deunaEnabled()) { bullet('DeUna (QR)'); anyPay = true; }
    if (this.branding.codEnabled()) { bullet('Pago contra entrega'); anyPay = true; }
    if (!anyPay) bullet('Consulta los métodos disponibles');
    y += 3;

    // Ubicaciones
    if (branches.length) {
      section('Visítanos');
      for (const b of branches.slice(0, 6)) {
        doc.setTextColor(198, 161, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(b.name + (b.city ? '  —  ' + b.city : ''), M, y); y += 5;
        const detail = [b.address, b.phone ? 'Tel: ' + b.phone : ''].filter(Boolean).join('   ·   ');
        if (detail) {
          doc.setTextColor(195, 200, 208); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          doc.text(this.trunc(detail, 92), M, y); y += 4.5;
        }
        y += 3;
      }
      y += 1;
    }

    // Compra en línea
    section('Compra en línea');
    const web = (typeof window !== 'undefined' ? window.location.origin : '');
    row('Sitio web', web + '/shop');

    // Pie
    if (logo) {
      const h = 13; const w = Math.min(logo.w * (h / logo.h), 46);
      try { doc.addImage(logo.data, 'PNG', cx - w / 2, pageH - 40, w, h); } catch { /* usa texto */ }
    }
    doc.setTextColor(170, 175, 185); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Gracias por tu preferencia  ·  ' + store, cx, pageH - 22, { align: 'center' });
  }

  async downloadCatalog(): Promise<void> {
    this.pdfLoading.set(true);
    try {
      const res: any = await new Promise((resolve, reject) =>
        this.productSvc.list({ page_size: 200, branch: this.branchCtx.current() ?? undefined }).subscribe({ next: resolve, error: reject }));
      const products: Product[] = res?.results || [];
      if (!products.length) { this.notifyToast.error('No hay productos para el catálogo.'); return; }

      // Sucursales (para la página de ubicaciones).
      let branches: AdminBranch[] = [];
      try {
        const br: any = await new Promise((resolve, reject) =>
          this.adminSvc.listBranches().subscribe({ next: resolve, error: reject }));
        branches = br?.results || br || [];
      } catch { /* sin sucursales */ }

      const store = this.branding.siteName();
      // Precarga: logo + imágenes de producto (para dibujar sin esperas).
      const logo = await this.loadImg(this.branding.logoUrl(), true);
      const imgs = new Map<number, { data: string; w: number; h: number } | null>();
      for (const p of products) { if (!imgs.has(p.id)) imgs.set(p.id, await this.loadImg(p.main_image_url)); }

      // Secciones: Promociones primero, luego por categoría (alfabético).
      const promos = products.filter(p => this.isPromo(p));
      const byCat = new Map<string, Product[]>();
      for (const p of products) {
        const k = p.category_name || 'Otros';
        (byCat.get(k) || byCat.set(k, []).get(k)!).push(p);
      }
      const sections: { title: string; items: Product[] }[] = [];
      if (promos.length) sections.push({ title: 'PROMOCIONES', items: promos });
      [...byCat.keys()].sort((a, b) => a.localeCompare(b)).forEach(k => sections.push({ title: k, items: byCat.get(k)! }));

      const bId = this.branchCtx.current();
      const branchName = bId != null ? this.branchCtx.currentName() : '';

      const doc = new jsPDF('p', 'mm', 'a4');
      // Interior tipo revista: márgenes amplios, mucho aire, 2 columnas.
      const pageW = 210, pageH = 297, margin = 18, cols = 2, gap = 12, bottom = 20;
      const cardW = (pageW - margin * 2 - gap * (cols - 1)) / cols;
      const photoH = 58, cardH = 92, rowGap = 8, contentTop = 27;

      const drawHeader = () => {
        doc.setFont('times', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 96, 106);
        doc.text(store.toUpperCase(), margin, 15);
        const right = branchName ? 'Catálogo · ' + this.trunc(branchName, 28) : 'Catálogo';
        doc.text(right, pageW - margin, 15, { align: 'right' });
        doc.setDrawColor(205, 208, 214); doc.setLineWidth(0.2);
        doc.line(margin, 19, pageW - margin, 19);
      };
      const drawFooter = (n: number) => {
        doc.setDrawColor(205, 208, 214); doc.setLineWidth(0.2);
        doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 155, 165);
        doc.text(store, margin, pageH - 10);
        doc.text(String(n), pageW - margin, pageH - 10, { align: 'right' });
      };

      const drawCard = (p: Product, x: number, y: number) => {
        // Recuadro de foto con línea fina (sin sombras "tipo web").
        doc.setFillColor(250, 249, 247); doc.rect(x, y, cardW, photoH, 'F');
        doc.setDrawColor(214, 210, 202); doc.setLineWidth(0.2); doc.rect(x, y, cardW, photoH, 'S');
        const pad = 5, bw = cardW - pad * 2, bh = photoH - pad * 2;
        const im = imgs.get(p.id);
        if (im) {
          const r = Math.min(bw / im.w, bh / im.h);
          const w = im.w * r, h = im.h * r;
          try { doc.addImage(im.data, 'JPEG', x + (cardW - w) / 2, y + (photoH - h) / 2, w, h); } catch { /* no válida */ }
        } else {
          doc.setTextColor(190, 190, 190); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
          doc.text('Sin imagen', x + cardW / 2, y + photoH / 2, { align: 'center' });
        }
        const promo = this.isPromo(p);
        if (promo) {
          doc.setFillColor(150, 32, 32); doc.rect(x, y, 22, 6, 'F');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
          doc.text('OFERTA', x + 11, y + 4, { align: 'center' });
        }

        let ty = y + photoH + 7;
        const meta = [p.brand_name, p.category_name].filter(Boolean).join('  ·  ');
        if (meta) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 152, 158);
          doc.text(this.trunc(meta.toUpperCase(), 44), x, ty);
          ty += 5;
        }
        doc.setFont('times', 'normal'); doc.setFontSize(13); doc.setTextColor(28, 30, 36);
        doc.text(this.trunc(p.name, 30), x, ty);

        ty += 7; doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 22, 28);
        const priceStr = '$ ' + Number(p.base_price).toFixed(2);
        doc.text(priceStr, x, ty);
        if (promo) {
          const nw = doc.getTextWidth(priceStr);
          const os = '$ ' + Number(p.compare_at_price).toFixed(2);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(160, 162, 168);
          doc.text(os, x + nw + 4, ty);
          const ow = doc.getTextWidth(os);
          doc.setDrawColor(160, 162, 168); doc.setLineWidth(0.3);
          doc.line(x + nw + 4, ty - 1.3, x + nw + 4 + ow, ty - 1.3);
        }

        const vd = p.variants_detail || [];
        const sizes = [...new Set(vd.map(v => (v.size || '').trim()).filter(Boolean))];
        const colors = [...new Set(vd.map(v => (v.color || '').trim()).filter(Boolean))];
        ty += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(115, 118, 126);
        if (sizes.length) { doc.text(this.trunc('Tallas: ' + sizes.join(', '), 48), x, ty); ty += 4; }
        if (colors.length) { doc.text(this.trunc('Colores: ' + colors.join(', '), 48), x, ty); ty += 4; }
        const stock = p.total_stock ?? 0;
        if (stock > 0) { doc.setTextColor(120, 124, 132); doc.text('Disponibles: ' + stock, x, ty); }
        else { doc.setTextColor(175, 70, 70); doc.text('Agotado', x, ty); }
      };

      // Portada elegante (se conserva).
      this.pdfCover(doc, store, this.branding.tagline(), logo, pageW, pageH, branchName);

      // Layout en flujo con encabezados de sección estilo revista.
      doc.addPage();
      let pageNum = 1;
      let y = contentTop;
      drawHeader(); drawFooter(pageNum);
      const ensure = (need: number) => {
        if (y + need > pageH - bottom) { doc.addPage(); pageNum++; drawHeader(); drawFooter(pageNum); y = contentTop; }
      };
      for (const sec of sections) {
        ensure(16 + cardH);
        const promoSec = sec.title === 'PROMOCIONES';
        doc.setFont('times', 'normal'); doc.setFontSize(16);
        doc.setTextColor(promoSec ? 150 : 30, promoSec ? 32 : 32, promoSec ? 32 : 38);
        doc.text(sec.title.charAt(0).toUpperCase() + sec.title.slice(1).toLowerCase(), margin, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 155, 165);
        doc.text(sec.items.length + (sec.items.length === 1 ? ' artículo' : ' artículos'), pageW - margin, y + 5, { align: 'right' });
        doc.setDrawColor(promoSec ? 150 : 205, promoSec ? 32 : 208, promoSec ? 32 : 214); doc.setLineWidth(0.3);
        doc.line(margin, y + 8.5, pageW - margin, y + 8.5);
        y += 15;
        for (let i = 0; i < sec.items.length; i += cols) {
          ensure(cardH + rowGap);
          drawCard(sec.items[i], margin, y);
          if (sec.items[i + 1]) drawCard(sec.items[i + 1], margin + cardW + gap, y);
          y += cardH + rowGap;
        }
        y += 5;
      }

      // Última página: guía de compra / contacto / ubicaciones
      doc.addPage();
      this.pdfContact(doc, store, logo, branches, pageW, pageH);

      doc.save('catalogo-' + store.toLowerCase().replace(/\s+/g, '-') + '.pdf');
      this.notifyToast.success('Catálogo generado.');
    } catch {
      this.notifyToast.error('No se pudo generar el catálogo.');
    } finally {
      this.pdfLoading.set(false);
    }
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
