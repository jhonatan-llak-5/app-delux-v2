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

/** Imagen precargada para el PDF (dataURL + dimensiones naturales). */
type PdfImg = { data: string; w: number; h: number } | null;
/** Paleta deportiva navy + rojo del catálogo. */
interface PdfPalette {
  navy: number[]; red: number[]; white: number[]; near: number[];
  ink: number[]; gray: number[]; dot: number[]; grayLight: number[];
}

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
  // ═══════════ Catálogo deportivo (navy + rojo) — utilidades de dibujo ═══════════
  /** Color de acento: primary del branding si parece rojo, si no #E01B24. */
  private pdfRed(): number[] {
    const fallback = [224, 27, 36];
    try {
      if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
      const v = getComputedStyle(document.documentElement).getPropertyValue('--dash-primary');
      const rgb = this.pdfParseColor(v);
      // Solo se adopta si el canal rojo domina claramente (aspecto "rojo").
      if (rgb && rgb[0] > 120 && rgb[0] > rgb[1] * 1.35 && rgb[0] > rgb[2] * 1.35) return rgb;
    } catch { /* usa fallback */ }
    return fallback;
  }
  private pdfParseColor(v: string): number[] | null {
    if (!v) return null;
    v = v.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]; }
    m = /rgba?\(([^)]+)\)/i.exec(v);
    if (m) { const p = m[1].split(',').map(s => parseFloat(s)); if (p.length >= 3 && p.every(x => !isNaN(x))) return [p[0], p[1], p[2]]; }
    return null;
  }
  private pdfFill(doc: jsPDF, c: number[]): void { doc.setFillColor(c[0], c[1], c[2]); }
  private pdfDraw(doc: jsPDF, c: number[]): void { doc.setDrawColor(c[0], c[1], c[2]); }
  private pdfText(doc: jsPDF, c: number[]): void { doc.setTextColor(c[0], c[1], c[2]); }

  /** Dibuja el logo (si es un logo subido real) o el nombre en bold del color dado. */
  private pdfBrand(doc: jsPDF, logo: PdfImg, name: string, x: number, y: number, maxH: number,
                   color: number[], size: number, align: 'left' | 'center' = 'left'): void {
    if (logo) {
      const h = maxH; const w = Math.min(logo.w * (h / logo.h), 60);
      const dx = align === 'center' ? x - w / 2 : x;
      try { doc.addImage(logo.data, 'PNG', dx, y - h, w, h); return; } catch { /* cae a texto */ }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(size); this.pdfText(doc, color);
    doc.setCharSpace(0.6);
    doc.text(this.trunc(name.toUpperCase(), 24), x, y, align === 'center' ? { align: 'center' } : undefined);
    doc.setCharSpace(0);
  }

  /** Encabezado de páginas de producto: "CATÁLOGO" + año + línea fina. */
  private pdfProductHeader(doc: jsPDF, pal: PdfPalette, pageW: number, margin: number): void {
    const year = new Date().getFullYear();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); this.pdfText(doc, pal.ink);
    doc.setCharSpace(2.6); doc.text('CATÁLOGO', margin, 15); doc.setCharSpace(0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); this.pdfText(doc, pal.gray);
    doc.text(String(year), pageW - margin, 15, { align: 'right' });
    this.pdfDraw(doc, pal.dot); doc.setLineWidth(0.3); doc.line(margin, 19, pageW - margin, 19);
  }

  /** Pestaña angular roja con el número de página en blanco. */
  private pdfPageTab(doc: jsPDF, pageW: number, pageH: number, margin: number, n: number, pal: PdfPalette): void {
    const th = 11, tw = 20, slant = 5;
    const ty = pageH - 6 - th, rx = pageW - margin, lx = rx - tw;
    this.pdfFill(doc, pal.red);
    // Paralelogramo (dos triángulos) con corte diagonal a ambos lados.
    doc.triangle(lx + slant, ty, rx, ty, lx, ty + th, 'F');
    doc.triangle(rx, ty, rx - slant, ty + th, lx, ty + th, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); this.pdfText(doc, pal.white);
    doc.text(String(n), (lx + rx) / 2, ty + th / 2 + 1.9, { align: 'center' });
  }

  /** Pie de página: logo/nombre rojo, "EDICIÓN {año}" central y pestaña con número. */
  private pdfFooter(doc: jsPDF, logo: PdfImg, name: string, pal: PdfPalette,
                    pageW: number, pageH: number, margin: number, n: number, onNavy = false): void {
    const year = new Date().getFullYear();
    this.pdfDraw(doc, onNavy ? pal.gray : pal.dot); doc.setLineWidth(0.3);
    doc.line(margin, pageH - 18, pageW - margin, pageH - 18);
    this.pdfBrand(doc, logo, name, margin, pageH - 9, 6, pal.red, 11, 'left');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); this.pdfText(doc, onNavy ? pal.grayLight : pal.gray);
    doc.setCharSpace(2.4); doc.text('EDICIÓN ' + year, pageW / 2, pageH - 10, { align: 'center' }); doc.setCharSpace(0);
    this.pdfPageTab(doc, pageW, pageH, margin, n, pal);
  }

  /** Rejilla decorativa de puntos. */
  private pdfDotGrid(doc: jsPDF, x: number, y: number, cols: number, rows: number, step: number, r: number, color: number[]): void {
    this.pdfFill(doc, color);
    for (let c = 0; c < cols; c++) for (let rw = 0; rw < rows; rw++) doc.circle(x + c * step, y + rw * step, r, 'F');
  }

  /** Marca de feature: círculo rojo con check blanco. */
  private pdfFeatureMark(doc: jsPDF, x: number, y: number, pal: PdfPalette): void {
    this.pdfFill(doc, pal.red); doc.circle(x, y, 2.6, 'F');
    this.pdfDraw(doc, pal.white); doc.setLineWidth(0.6);
    doc.line(x - 1.2, y + 0.1, x - 0.3, y + 1.1); doc.line(x - 0.3, y + 1.1, x + 1.4, y - 1.2);
  }

  /** Trío de marcas-ícono simples (check · rombo · anillo) para cada producto. */
  private pdfTripleMark(doc: jsPDF, x: number, y: number, color: number[]): void {
    const g = 6.5;
    this.pdfDraw(doc, color); this.pdfFill(doc, color); doc.setLineWidth(0.5);
    // check
    doc.line(x, y, x + 1.1, y + 1.2); doc.line(x + 1.1, y + 1.2, x + 3.2, y - 1.6);
    // rombo
    const dx = x + g + 1.5;
    doc.triangle(dx, y - 1.8, dx + 1.7, y, dx - 1.7, y, 'F');
    doc.triangle(dx, y + 1.8, dx + 1.7, y, dx - 1.7, y, 'F');
    // anillo
    doc.circle(x + g * 2 + 1.5, y, 1.7, 'S');
  }

  /** Íconos vectoriales simples de contacto (teléfono, correo, web). */
  private pdfContactIcon(doc: jsPDF, kind: 'phone' | 'mail' | 'web', x: number, y: number, color: number[]): void {
    this.pdfDraw(doc, color); this.pdfFill(doc, color); doc.setLineWidth(0.5);
    if (kind === 'phone') {
      doc.roundedRect(x + 1, y - 4.2, 5, 8.4, 1, 1, 'S');
      doc.line(x + 2.4, y - 3, x + 4.6, y - 3);     // altavoz
      doc.circle(x + 3.5, y + 2.7, 0.5, 'F');        // botón
    } else if (kind === 'mail') {
      doc.rect(x, y - 3.2, 8, 6.4, 'S');
      doc.line(x, y - 3.2, x + 4, y + 0.4); doc.line(x + 8, y - 3.2, x + 4, y + 0.4);
    } else {
      doc.circle(x + 4, y, 4, 'S');
      doc.line(x, y, x + 8, y);
      doc.line(x + 4, y - 4, x + 4, y + 4);
      doc.line(x + 1.1, y - 2.4, x + 6.9, y - 2.4);
      doc.line(x + 1.1, y + 2.4, x + 6.9, y + 2.4);
    }
  }

  // ═══════════ Página 1 — Portada ═══════════
  private pdfCover(doc: jsPDF, store: string, tagline: string, logo: PdfImg, pal: PdfPalette,
                   pageW: number, pageH: number, hero: PdfImg): void {
    const M = 20, year = new Date().getFullYear();
    void hero; // La portada ya no usa imagen hero; queda solo con textos y branding.
    this.pdfFill(doc, pal.white); doc.rect(0, 0, pageW, pageH, 'F');

    // Composición angular superior izquierda: navy + rojo + franja blanca diagonal.
    this.pdfFill(doc, pal.navy); doc.triangle(0, 0, 98, 0, 0, 74, 'F');
    this.pdfFill(doc, pal.red);  doc.triangle(0, 0, 60, 0, 0, 44, 'F');
    this.pdfFill(doc, pal.white); // franja blanca en diagonal (dos triángulos)
    doc.triangle(52, 0, 70, 0, 0, 44, 'F');
    doc.triangle(70, 0, 0, 62, 0, 44, 'F');

    // Año grande + "EDICIÓN" (arriba derecha, siempre dentro del margen).
    doc.setFont('helvetica', 'bold'); doc.setFontSize(40); this.pdfText(doc, pal.ink);
    doc.text(String(year), pageW - M, 32, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); this.pdfText(doc, pal.gray);
    // El tracking agranda el ancho real: se mide y se posiciona a mano para no salir del margen.
    const edLabel = 'EDICIÓN', edCS = 3.2;
    doc.setCharSpace(edCS);
    const edW = doc.getTextWidth(edLabel) + edCS * (edLabel.length - 1);
    doc.text(edLabel, pageW - M - edW, 39);
    doc.setCharSpace(0);

    // Bloque de título (rebalanceado, sin imagen hero).
    doc.setFont('helvetica', 'bold'); doc.setFontSize(58); this.pdfText(doc, pal.ink);
    doc.text('CATÁLOGO', M, 110);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(16); this.pdfText(doc, pal.navy);
    doc.setCharSpace(6.5); doc.text('COLECCIÓN', M + 1.5, 124); doc.setCharSpace(0);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(14); this.pdfText(doc, pal.red);
    doc.text(this.trunc(tagline || 'Estilo que te acompaña', 46), M + 1.5, 135);

    // Barra roja + rejilla de puntos: rellenan de forma equilibrada el espacio antes ocupado por la imagen.
    this.pdfFill(doc, pal.red); doc.rect(M + 1.5, 145, 48, 3, 'F');
    this.pdfDotGrid(doc, M + 2, 168, 12, 6, 7, 1.1, pal.dot);
    // Encaje angular navy + rojo sobre la banda inferior (continuidad deportiva).
    this.pdfFill(doc, pal.navy); doc.triangle(M, 232, pageW - M, 232, pageW - M, 214, 'F');
    this.pdfFill(doc, pal.red);  doc.triangle(pageW - M, 214, pageW - M, 232, pageW - M - 26, 232, 'F');

    // Banda inferior navy con acentos rojos diagonales.
    const bandY = 244, bandH = pageH - bandY;
    this.pdfFill(doc, pal.navy); doc.rect(0, bandY, pageW, bandH, 'F');
    this.pdfFill(doc, pal.red);
    doc.triangle(pageW, bandY, pageW, pageH, pageW - 42, pageH, 'F');
    doc.triangle(pageW - 30, bandY, pageW, bandY, pageW, bandY + 16, 'F');

    // Logo/nombre en rojo + divisor + 3 features en blanco con tracking.
    this.pdfBrand(doc, logo, store, M, bandY + bandH / 2 + 2, 9, pal.red, 15, 'left');
    this.pdfDraw(doc, pal.grayLight); doc.setLineWidth(0.4);
    doc.line(M + 60, bandY + 8, M + 60, bandY + bandH - 8);
    const feats = ['CALIDAD PREMIUM', 'DISEÑO MODERNO', 'MÁXIMO CONFORT'];
    let fy = bandY + 15;
    for (const f of feats) {
      this.pdfFeatureMark(doc, M + 70, fy - 1, pal);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); this.pdfText(doc, pal.white);
      doc.setCharSpace(1.6); doc.text(f, M + 76, fy + 0.5); doc.setCharSpace(0);
      fy += 11;
    }
  }

  // ═══════════ Página final — Cierre (gracias + contacto, fondo navy) ═══════════
  private pdfClosing(doc: jsPDF, store: string, tagline: string, logo: PdfImg, branches: AdminBranch[],
                     pal: PdfPalette, pageW: number, pageH: number): void {
    const cx = pageW / 2;
    this.pdfFill(doc, pal.navy); doc.rect(0, 0, pageW, pageH, 'F');
    // Acentos angulares en esquinas opuestas (arriba-izq y abajo-der).
    this.pdfFill(doc, pal.red);   doc.triangle(0, 0, 66, 0, 0, 52, 'F');
    this.pdfFill(doc, pal.white); doc.triangle(0, 0, 30, 0, 0, 22, 'F');
    this.pdfFill(doc, pal.red);   doc.triangle(pageW, pageH, pageW - 66, pageH, pageW, pageH - 52, 'F');
    this.pdfFill(doc, pal.white); doc.triangle(pageW, pageH, pageW - 30, pageH, pageW, pageH - 22, 'F');

    // ── Encabezado de agradecimiento (compacto, arriba) ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(30); this.pdfText(doc, pal.white);
    doc.text('GRACIAS POR ELEGIR', cx, 52, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); this.pdfText(doc, pal.red);
    doc.setCharSpace(3.5);
    doc.text(this.trunc((tagline || 'CALIDAD QUE SE SIENTE').toUpperCase(), 40), cx, 64, { align: 'center' });
    doc.setCharSpace(0);

    // ── Bloque de contacto (centro/abajo) ──
    // Logo/nombre grande en rojo.
    this.pdfBrand(doc, logo, store, cx, 98, 13, pal.red, 26, 'center');

    // Encabezado "CONTÁCTANOS" + barra roja.
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); this.pdfText(doc, pal.white);
    doc.setCharSpace(4.5); doc.text('CONTÁCTANOS', cx, 122, { align: 'center' }); doc.setCharSpace(0);
    this.pdfFill(doc, pal.red); doc.rect(cx - 15, 126, 30, 2, 'F');

    // Líneas de contacto con íconos vectoriales (datos reales del branding).
    const bx = cx - 52;
    let y = 144;
    const web = (typeof window !== 'undefined' ? window.location.origin : '') + '/shop';
    const rows: { kind: 'phone' | 'mail' | 'web'; v: string }[] = [];
    if (this.branding.whatsappNumber()) rows.push({ kind: 'phone', v: this.branding.whatsappNumber() });
    if (this.branding.contactEmail()) rows.push({ kind: 'mail', v: this.branding.contactEmail() });
    rows.push({ kind: 'web', v: web });
    for (const r of rows) {
      this.pdfContactIcon(doc, r.kind, bx, y - 1, pal.red);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); this.pdfText(doc, pal.white);
      doc.text(this.trunc(r.v, 52), bx + 13, y + 1.5);
      y += 13;
    }

    // Ubicaciones (si existen sucursales).
    if (branches.length) {
      y += 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); this.pdfText(doc, pal.red);
      doc.setCharSpace(2.5); doc.text('VISÍTANOS', bx, y); doc.setCharSpace(0);
      y += 8;
      for (const b of branches.slice(0, 4)) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); this.pdfText(doc, pal.white);
        doc.text(this.trunc(b.name + (b.city ? '  ·  ' + b.city : ''), 48), bx, y); y += 5;
        const detail = [b.address, b.phone ? 'Tel: ' + b.phone : ''].filter(Boolean).join('   ·   ');
        if (detail) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); this.pdfText(doc, pal.grayLight);
          doc.text(this.trunc(detail, 70), bx, y); y += 5;
        }
        y += 3;
      }
    }
    doc.setCharSpace(0);
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
      // Imagen destacada para la portada (primer producto con foto disponible).
      const hero = [...imgs.values()].find(im => !!im) || null;

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

      const doc = new jsPDF('p', 'mm', 'a4');
      // Paleta deportiva navy + rojo.
      const pal: PdfPalette = {
        navy: [15, 27, 45], red: this.pdfRed(), white: [255, 255, 255], near: [246, 246, 246],
        ink: [20, 20, 20], gray: [138, 138, 138], dot: [210, 210, 214], grayLight: [188, 192, 200],
      };
      // Solo se dibuja como imagen el logo si es uno subido de verdad (no el asset por defecto).
      const logoUrl = this.branding.logoUrl();
      const brandLogo: PdfImg = (logo && !logoUrl.startsWith('assets/')) ? logo : null;

      const pageW = 210, pageH = 297, margin = 18, gap = 12, bottom = 26, contentTop = 30;
      const cellW = (pageW - margin * 2 - gap) / 2;
      const photoH = 58, textBlock = 34, cardH = photoH + textBlock, rowGap = 12;
      const bigPhotoH = 100, bigCardH = bigPhotoH + 42;

      const drawHeader = () => this.pdfProductHeader(doc, pal, pageW, margin);
      const drawFooter = (n: number) => this.pdfFooter(doc, brandLogo, store, pal, pageW, pageH, margin, n);

      // Producto: imagen limpia + nombre + precio rojo + descripción + trío de marcas.
      // Con `center` la imagen y todos los textos se centran en la página (secciones de un solo ítem).
      const drawCard = (p: Product, x: number, y: number, w: number, ph: number, big = false, center = false) => {
        const cx = x + w / 2;
        const im = imgs.get(p.id);
        if (im) {
          const boxW = center ? Math.min(w, 96) : w; // imagen elegante y no gigante cuando va centrada
          const r = Math.min(boxW / im.w, ph / im.h);
          const iw = im.w * r, ih = im.h * r;
          try { doc.addImage(im.data, 'JPEG', cx - iw / 2, y + (ph - ih), iw, ih); } catch { /* no válida */ }
        } else {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(10); this.pdfText(doc, pal.grayLight);
          doc.text('Sin imagen', cx, y + ph / 2, { align: 'center' });
        }
        const promo = this.isPromo(p);
        const tx = center ? cx : x;
        const opt: any = center ? { align: 'center' } : undefined;

        let ty = y + ph + (big ? 11 : 8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 16 : 12.5); this.pdfText(doc, pal.ink);
        doc.text(this.trunc(p.name, big ? 46 : 26), tx, ty, opt);

        ty += big ? 8.5 : 7;
        const priceStr = '$ ' + Number(p.base_price).toFixed(2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 15 : 12.5);
        const pw = doc.getTextWidth(priceStr);
        if (promo) {
          const os = '$ ' + Number(p.compare_at_price).toFixed(2);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
          const ow = doc.getTextWidth(os);
          const gapP = 5;
          const startX = center ? cx - (pw + gapP + ow) / 2 : x;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 15 : 12.5); this.pdfText(doc, pal.red);
          doc.text(priceStr, startX, ty);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); this.pdfText(doc, pal.gray);
          doc.text(os, startX + pw + gapP, ty);
          this.pdfDraw(doc, pal.gray); doc.setLineWidth(0.3);
          doc.line(startX + pw + gapP, ty - 1.3, startX + pw + gapP + ow, ty - 1.3);
        } else {
          this.pdfText(doc, pal.red);
          doc.text(priceStr, tx, ty, opt);
        }

        // Descripción corta en gris (short_description / description).
        const desc = (p.short_description || p.description || '').replace(/\s+/g, ' ').trim();
        ty += big ? 7 : 6;
        if (desc) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(big ? 9.5 : 8); this.pdfText(doc, pal.gray);
          doc.text(this.trunc(desc, big ? 96 : 42), tx, ty, opt);
        }

        // Trío de marcas-ícono simples (centrado cuando corresponde).
        ty += big ? 8 : 6.5;
        const markW = 16.5;
        this.pdfTripleMark(doc, center ? cx - markW / 2 : x + 1, ty, pal.grayLight);
      };

      const tagline = this.branding.tagline();

      // Página 1: portada deportiva.
      this.pdfCover(doc, store, tagline, brandLogo, pal, pageW, pageH, hero);

      // Páginas de productos, en flujo con paginación real.
      doc.addPage();
      let pageNum = 1;
      let y = contentTop;
      drawHeader(); drawFooter(pageNum);
      const ensure = (need: number) => {
        if (y + need > pageH - bottom) { doc.addPage(); pageNum++; drawHeader(); drawFooter(pageNum); y = contentTop; }
      };
      for (const sec of sections) {
        const single = sec.items.length === 1;
        // Reserva título + primera fila/tarjeta juntos: evita títulos huérfanos y páginas casi vacías.
        ensure(20 + (single ? bigCardH : cardH + rowGap));
        const promoSec = sec.title === 'PROMOCIONES';
        const title = promoSec ? 'Promociones' : (sec.title.charAt(0).toUpperCase() + sec.title.slice(1).toLowerCase());
        // Título de sección + barra roja + rejilla de puntos a la derecha.
        doc.setFont('helvetica', 'bold'); doc.setFontSize(20); this.pdfText(doc, pal.ink);
        doc.text(this.trunc(title, 40), margin, y + 6);
        this.pdfFill(doc, pal.red); doc.rect(margin, y + 9.5, 30, 2, 'F');
        this.pdfDotGrid(doc, pageW - margin - 15, y, 6, 4, 3, 0.8, pal.dot);
        y += 20;
        if (single) {
          // Producto único: imagen y textos centrados en la página (espacio ya reservado arriba).
          drawCard(sec.items[0], margin, y, pageW - margin * 2, bigPhotoH, true, true);
          y += bigCardH + 4;
        } else {
          for (let i = 0; i < sec.items.length; i += 2) {
            if (i > 0) ensure(cardH + rowGap); // la primera fila ya quedó reservada junto al título
            drawCard(sec.items[i], margin, y, cellW, photoH);
            if (sec.items[i + 1]) drawCard(sec.items[i + 1], margin + cellW + gap, y, cellW, photoH);
            y += cardH + rowGap;
          }
        }
        y += 6;
      }

      // Página final: cierre (gracias + contacto, navy) en una sola página.
      doc.addPage(); pageNum++;
      this.pdfClosing(doc, store, tagline, brandLogo, branches, pal, pageW, pageH);
      this.pdfFooter(doc, brandLogo, store, pal, pageW, pageH, margin, pageNum, true);

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
