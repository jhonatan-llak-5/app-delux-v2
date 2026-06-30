import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService, Supplier, ReceptionItemIn, ReceptionResult, ScanResult } from '@features/superadmin/services/inventory.service';
import { ManualProductModalComponent, ManualProduct } from '@features/superadmin/components/manual-product-modal/manual-product-modal.component';
import { Subject, debounceTime } from 'rxjs';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { BrandService } from '@features/superadmin/services/brand.service';
import { CategoryService } from '@features/superadmin/services/category.service';
import { BrandingService } from '@core/services/branding.service';
import { BranchContextService } from '@core/services/branch-context.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { code128BSvg } from '@shared/utils/code128';
import { environment } from '@env/environment';
import { TourService, TourStep } from '@shared/components/app-tour/tour.service';
import { DlxConfirmDialogComponent } from '@shared/ui/confirm-dialog.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { AuthService } from '@core/services/auth.service';
import { SupplierFormModalComponent } from '@features/superadmin/components/supplier-form-modal/supplier-form-modal.component';

interface Row {
  key: number;
  variant_id?: number;
  product_name: string;
  brand_name?: string;
  category_name?: string;
  kind: string;
  color: string;
  size: string;
  barcode: string;
  sku?: string;
  unit_cost: number;
  price?: number;
  isNew: boolean;
  description?: string;
  branchQty: Record<number, number>;
  branchMemo?: Record<number, number>;
  images?: string[];
}

interface AddDraft {
  variant: NonNullable<ScanResult['variant']>;
  unit_cost: number;
  branchQty: Record<number, number>;
}

const KIND_LABELS: Record<string, string> = {
  CALZADO: 'Calzado', ROPA: 'Ropa', GORRA: 'Gorras', MOCHILA: 'Mochilas',
  BISUTERIA: 'Bisutería', ACCESORIO: 'Accesorios', OTRO: 'Otro',
};

@Component({
  selector: 'dlx-reception',
  standalone: true,
  imports: [CommonModule, FormsModule, ManualProductModalComponent, DlxConfirmDialogComponent, DlxPriceInputComponent, SupplierFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Recepción de mercadería</h1>
        <p class="text-slate-500 text-sm mt-1">Ingresa productos de golpe: escanea, agrega y confirma. Genera código e imprime etiquetas.</p>
      </div>
      <button class="btn-secondary text-sm" (click)="startTour()">
        <i class="fa-solid fa-circle-question"></i> ¿Cómo funciona?
      </button>
    </div>

    @if (result(); as r) {
      <div class="card p-6 max-w-2xl">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
            <i class="fa-solid fa-check text-lg"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold">Recepción confirmada</h2>
            <p class="text-sm text-slate-500">{{ r.code }} · {{ r.branch_name }} · {{ r.total_units }} unidad(es)</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 mt-4">
          <button class="eg-btn-primary" (click)="printLabels()">
            <i class="fa-solid fa-print"></i> Imprimir etiquetas
          </button>
          <label class="inline-flex items-center gap-2 text-sm text-slate-600 px-2">
            <input type="checkbox" [(ngModel)]="labelPerUnit" class="w-4 h-4 accent-[#1e40af]" />
            Una etiqueta por unidad
          </label>
          <button class="btn-secondary text-sm" (click)="reset()">
            <i class="fa-solid fa-plus"></i> Nueva recepción
          </button>
        </div>
      </div>
    } @else {

    <!-- Stepper -->
    <div class="mb-6">
      @if (items().length) {
        <div class="flex justify-end mb-3">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
                       bg-[#1e40af]/10 text-[#1e40af] dark:bg-[#3b82f6]/15 dark:text-[#7aa2ff]">
            <i class="fa-solid fa-box"></i>
            {{ totalUnits() }} uds · {{ money(totalCost()) }}
          </span>
        </div>
      }
      <div class="flex items-center">
        @for (s of steps; track s.id; let i = $index; let last = $last) {
          <button type="button" (click)="goStep(s.id)"
                  class="flex items-center gap-3 shrink-0 focus:outline-none group">
            <span class="relative grid place-items-center w-11 h-11 rounded-full font-bold text-sm transition-all duration-300"
                  [ngClass]="stepCircleCls(s.id)">
              @if (stepState(s.id) === 'done') {
                <i class="fa-solid fa-check"></i>
              } @else {
                {{ i + 1 }}
              }
              @if (s.id === 'review' && items().length) {
                <span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 grid place-items-center rounded-full
                             bg-emerald-500 text-white text-[10px] font-bold ring-2 ring-white dark:ring-[#0d1320]">
                  {{ items().length }}
                </span>
              }
            </span>
            <div class="text-left hidden sm:block pr-1">
              <p class="text-[10px] font-semibold uppercase tracking-wider transition-colors"
                 [ngClass]="stepState(s.id) === 'todo' ? 'text-slate-400 dark:text-white/30' : 'text-[#1e40af] dark:text-[#7aa2ff]'">
                Paso {{ i + 1 }}
              </p>
              <p class="text-sm font-bold leading-tight transition-colors"
                 [ngClass]="stepState(s.id) === 'todo' ? 'text-slate-400 dark:text-white/40' : 'text-slate-800 dark:text-white'">
                {{ s.label }}
              </p>
            </div>
          </button>
          @if (!last) {
            <div class="flex-1 h-1 mx-2 sm:mx-4 rounded-full transition-colors duration-300 min-w-[1.5rem]"
                 [ngClass]="stepDone(s.id) ? 'bg-[#1e40af]' : 'bg-slate-200 dark:bg-white/10'"></div>
          }
        }
      </div>
    </div>

    <!-- ════════ TAB 1: SUBIR ════════ -->
    @if (tab() === 'upload') {
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- Config: sucursales / proveedor / nota -->
      <div class="card p-5 space-y-4">
        <div data-tour="recv-branch">
          <label class="eg-label">¿A qué sucursales llega? *</label>
          <div class="space-y-1.5 mt-1 max-h-48 overflow-y-auto">
            @for (b of branches(); track b.id) {
              <label class="flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition"
                     [ngClass]="isSelected(b.id) ? 'border-[#1e40af] bg-[#1e40af]/5' : 'border-slate-200 dark:border-white/10 hover:border-slate-300'">
                <input type="checkbox" [checked]="isSelected(b.id)" (change)="toggleBranch(b.id)" [disabled]="isBranchLocked(b.id)" class="w-4 h-4 accent-[#1e40af]" />
                <span class="text-sm">{{ b.name }} · {{ b.city }}</span>
              </label>
            }
          </div>
          @if (selectedBranches().length > 1) {
            <p class="text-[11px] text-slate-400 mt-1">Asigna la sucursal de cada producto en la pestaña Revisar.</p>
          }
        </div>
        <div data-tour="recv-supplier">
          <label class="eg-label">Proveedor</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input [(ngModel)]="supplierName" (focus)="supplierOpen.set(true)"
                     (ngModelChange)="supplierOpen.set(true); saveState()" (blur)="closeSupplierSoon()"
                     class="eg-input w-full" placeholder="Nombre del proveedor" autocomplete="off" />
              @if (supplierOpen() && filteredSuppliers().length) {
                <div class="absolute left-0 right-0 top-full mt-1 z-30 max-h-52 overflow-y-auto rounded-xl py-1
                            bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
                  @for (sp of filteredSuppliers(); track sp.id) {
                    <button type="button" (click)="pickSupplier(sp.name)"
                            class="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center gap-2">
                      <i class="fa-solid fa-truck-field text-slate-400 text-xs"></i> {{ sp.name }}
                    </button>
                  }
                </div>
              }
            </div>
            <button type="button" class="eg-btn-secondary shrink-0" (click)="showSupplierModal.set(true)" title="Agregar proveedor con todos sus datos">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
          <p class="text-[11px] text-slate-400 mt-1">Escribe el nombre, o usa <b>+</b> para registrar un proveedor con todos sus datos.</p>
        </div>
        <div>
          <label class="eg-label">Nota (opcional)</label>
          <input [(ngModel)]="note" (ngModelChange)="saveState()" class="eg-input" placeholder="Ej. Contenedor junio" />
        </div>
      </div>

      <!-- Formas de agregar -->
      <div class="card p-5 space-y-4">
        <div>
          <label class="eg-label">Buscar producto existente</label>
          <div class="relative">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input [(ngModel)]="prodQuery" (ngModelChange)="prodSearch$.next($event)"
                   (focus)="searchOpen.set(true)" (blur)="closeSearchSoon()"
                   class="eg-input has-icon-left" placeholder="Nombre, talla, color o código… (ej. jogger negro 35)"
                   autocomplete="off" [disabled]="!selectedBranches().length" />
            @if (searchOpen() && searchResults().length) {
              <div class="absolute left-0 right-0 top-full mt-1 z-30 max-h-64 overflow-y-auto rounded-xl py-1
                          bg-white dark:bg-[#161a26] border border-slate-200 dark:border-white/10 shadow-xl">
                @for (v of searchResults(); track v.id) {
                  <button type="button" (click)="addExisting(v)"
                          class="w-full text-left px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-white/5 transition">
                    <p class="text-sm font-medium truncate">{{ v.product_name }}</p>
                    <p class="text-xs text-slate-400">{{ v.size || '—' }} / {{ v.color || '—' }} · {{ v.sku }}@if (v.barcode) { · {{ v.barcode }} }</p>
                  </button>
                }
              </div>
            }
          </div>
          <p class="text-[11px] text-slate-400 mt-1">Si ya lo subiste antes, búscalo por nombre o código de barras y se suma a la lista.</p>
        </div>

        <div data-tour="recv-scan">
          <label class="eg-label">Escanear código de barras</label>
          <div class="relative">
            <i class="fa-solid fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input #scan [(ngModel)]="scanCode" (keyup.enter)="onScan()" [disabled]="!selectedBranches().length"
                   class="eg-input has-icon-left" placeholder="Escanea o escribe y Enter" autocomplete="off" />
          </div>
          @if (scanMsg()) { <p class="text-xs text-slate-500 mt-1">{{ scanMsg() }}</p> }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button type="button"
                  class="h-12 rounded-xl border-2 font-semibold text-sm inline-flex items-center justify-center gap-2 transition
                         border-[#1e40af] text-[#1e40af] dark:text-[#7aa2ff] dark:border-[#3b82f6]
                         hover:bg-[#1e40af]/5 dark:hover:bg-[#3b82f6]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  (click)="cameraOn() ? stopCamera() : startCamera()" [disabled]="!selectedBranches().length">
            <i class="fa-solid" [class.fa-camera]="!cameraOn()" [class.fa-xmark]="cameraOn()"></i>
            {{ cameraOn() ? 'Cerrar cámara' : 'Escanear con cámara' }}
          </button>
          <button type="button"
                  class="h-12 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition text-white
                         bg-gradient-to-r from-[#1e40af] to-[#2563eb] hover:from-[#1d4ed8] hover:to-[#3b82f6]
                         shadow-lg shadow-[#1e40af]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  (click)="openNew('')" [disabled]="!selectedBranches().length" data-tour="recv-manual">
            <i class="fa-solid fa-plus"></i> Agregar producto manual
          </button>
        </div>

        @if (cameraOn()) {
          <div class="rounded-xl overflow-hidden bg-black relative">
            <video #camVideo class="w-full max-h-60 object-contain" muted playsinline></video>
            <div class="absolute inset-0 border-4 border-white/30 m-6 rounded-lg pointer-events-none"></div>
            <p class="absolute bottom-1 left-0 right-0 text-center text-white/80 text-xs">Apunta al código de barras o QR</p>
          </div>
        }
        @if (camError()) { <p class="text-xs text-amber-600">{{ camError() }}</p> }
        @if (!selectedBranches().length) { <p class="text-xs text-amber-600">Elige al menos una sucursal destino arriba.</p> }

        @if (items().length) {
          <button type="button" (click)="tab.set('review')"
                  class="w-full h-11 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition
                         font-semibold text-sm inline-flex items-center justify-center gap-2">
            <i class="fa-solid fa-list-check"></i> Ver lista ({{ items().length }}) →
          </button>
        }
      </div>
    </div>
    }

    <!-- ════════ TAB 2: REVISAR ════════ -->
    @if (tab() === 'review') {
    <div data-tour="recv-list">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="font-bold tracking-tight">Productos a ingresar <span class="text-slate-400 font-normal">· {{ items().length }}</span></h2>
        @if (items().length) {
          <div class="flex items-center gap-2">
            <button class="btn-secondary text-sm text-rose-600" (click)="askClear()">
              <i class="fa-solid fa-trash-can"></i> Limpiar lista
            </button>
            <button class="eg-btn-primary text-sm" (click)="tab.set('confirm')">
              Continuar <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        }
      </div>

      @if (items().length === 0) {
        <div class="card p-10 text-center">
          <div class="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center bg-slate-100 dark:bg-white/5 text-slate-400">
            <i class="fa-solid fa-box-open text-xl"></i>
          </div>
          <p class="text-slate-500 mb-4">Aún no hay productos en la lista.</p>
          <button class="eg-btn-primary" (click)="tab.set('upload')">
            <i class="fa-solid fa-plus"></i> Agregar productos
          </button>
        </div>
      } @else {
        <div class="space-y-2.5">
          @for (it of items(); track it.key) {
            <div class="card p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3 min-w-0">
                  @if (it.images && it.images.length) {
                    <img [src]="it.images[0]" [alt]="it.product_name" (error)="onImgErr($event)"
                         class="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-white/10 shrink-0" />
                  } @else {
                    <div class="w-12 h-12 rounded-lg grid place-items-center bg-slate-100 dark:bg-white/5 text-slate-300 shrink-0">
                      <i class="fa-solid fa-image"></i>
                    </div>
                  }
                  <div class="min-w-0">
                    <p class="font-medium truncate flex items-center gap-1.5">
                      <span class="truncate">{{ it.product_name }}</span>
                      @if (it.isNew) { <span class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Nuevo</span> }
                    </p>
                    <p class="text-xs text-slate-400 truncate">
                      {{ it.size || '—' }} / {{ it.color || '—' }}
                      @if (it.sku) { · {{ it.sku }} } @else if (it.brand_name) { · {{ it.brand_name }} }
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <button class="text-slate-400 hover:text-[#1e40af]" (click)="openDetail(it)" title="Ver detalle"><i class="fa-solid fa-eye text-sm"></i></button>
                  <button class="text-rose-500 hover:text-rose-700" (click)="removeRow(it.key)" title="Quitar"><i class="fa-solid fa-trash text-sm"></i></button>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-4 mt-3">
                <div>
                  <label class="text-[11px] text-slate-400">Costo unitario</label>
                  <dlx-price-input [(ngModel)]="it.unit_cost" (ngModelChange)="touchItems()" extraClass="!h-9 w-full" />
                </div>

                <div>
                  <label class="text-[11px] text-slate-400">Cantidad por sucursal</label>
                  <div class="space-y-1.5 mt-0.5">
                    @for (b of rowBranchOptions(it); track b.id) {
                      <div class="flex items-center gap-2 rounded-xl border pl-3 pr-1.5 h-11 transition"
                           [ngClass]="hasBranch(it, b.id) ? 'border-[#1e40af] bg-[#1e40af]/5' : 'border-slate-200 dark:border-white/10'">
                        <label class="flex items-center gap-2 flex-1 min-w-0 h-full cursor-pointer">
                          <input type="checkbox" [checked]="hasBranch(it, b.id)" (change)="toggleRowBranch(it, b.id)" class="w-4 h-4 accent-[#1e40af] shrink-0" />
                          <span class="text-sm truncate">{{ b.name }} · {{ b.city }}</span>
                        </label>
                        @if (hasBranch(it, b.id)) {
                          <div class="w-20 shrink-0">
                            <input type="number" min="0" [ngModel]="it.branchQty[b.id]" (ngModelChange)="setRowQty(it, b.id, $event)"
                                   class="eg-input !h-8 w-full text-center text-sm" placeholder="0" />
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 text-sm">
                <span class="text-slate-500">{{ rowUnits(it) }} uds @if (rowBranchSummary(it)) { <span class="text-slate-400">· {{ rowBranchSummary(it) }}</span> }</span>
                <span class="font-bold">{{ money(rowUnits(it) * (+it.unit_cost || 0)) }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
    }

    <!-- ════════ TAB 3: CONFIRMAR ════════ -->
    @if (tab() === 'confirm') {
    <div class="max-w-3xl">
      @if (items().length === 0) {
        <div class="card p-10 text-center">
          <p class="text-slate-500 mb-4">No hay productos para confirmar.</p>
          <button class="eg-btn-primary" (click)="tab.set('upload')"><i class="fa-solid fa-plus"></i> Agregar productos</button>
        </div>
      } @else {
        <div class="card p-5 space-y-4">
          <h2 class="font-bold tracking-tight text-lg">Resumen de la recepción</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
              <p class="text-[11px] uppercase tracking-wide text-slate-400">Productos</p>
              <p class="text-xl font-bold">{{ items().length }}</p>
            </div>
            <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
              <p class="text-[11px] uppercase tracking-wide text-slate-400">Unidades</p>
              <p class="text-xl font-bold">{{ totalUnits() }}</p>
            </div>
            <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
              <p class="text-[11px] uppercase tracking-wide text-slate-400">Costo total</p>
              <p class="text-xl font-bold">{{ money(totalCost()) }}</p>
            </div>
            <div class="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
              <p class="text-[11px] uppercase tracking-wide text-slate-400">Sucursales</p>
              <p class="text-xl font-bold">{{ selectedBranches().length }}</p>
            </div>
          </div>

          <div class="text-sm space-y-1.5 border-t border-slate-100 dark:border-white/5 pt-3">
            <div class="flex justify-between"><span class="text-slate-500">Destino</span><span class="font-medium text-right">{{ branchNames() }}</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Proveedor</span><span class="font-medium">{{ supplierName.trim() || '—' }}</span></div>
            @if (note.trim()) { <div class="flex justify-between"><span class="text-slate-500">Nota</span><span class="font-medium text-right">{{ note.trim() }}</span></div> }
          </div>

          <div class="space-y-2 max-h-80 overflow-y-auto pr-0.5">
            @for (g of groupedSummary(); track g.key) {
              <div class="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div class="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5">
                  <div class="min-w-0 flex items-center gap-2">
                    <p class="font-semibold truncate">{{ g.name }}</p>
                    @if (g.isNew) {
                      <span class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Nuevo</span>
                    } @else {
                      <span class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-white/50">Existente</span>
                    }
                  </div>
                  <div class="text-right shrink-0 text-xs whitespace-nowrap">
                    <span class="font-bold">{{ groupUnits(g.rows) }} uds</span>
                    <span class="text-slate-400"> · {{ money(groupCost(g.rows)) }}</span>
                  </div>
                </div>
                <div class="divide-y divide-slate-100 dark:divide-white/5">
                  @for (it of g.rows; track it.key) {
                    <div class="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                      <div class="min-w-0 flex items-center gap-2 flex-wrap">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70">{{ it.size || '—' }} / {{ it.color || '—' }}</span>
                        @if (rowBranchSummary(it)) { <span class="text-[11px] text-slate-400 truncate">{{ rowBranchSummary(it) }}</span> }
                      </div>
                      <div class="text-right shrink-0 whitespace-nowrap">
                        <span class="font-medium">{{ rowUnits(it) }} × {{ money(it.unit_cost) }}</span>
                        <span class="text-xs text-slate-400 ml-1.5">{{ money(rowUnits(it) * (+it.unit_cost || 0)) }}</span>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="flex items-center justify-between gap-3 flex-wrap pt-2">
            <button class="btn-secondary text-sm" (click)="tab.set('review')">
              <i class="fa-solid fa-arrow-left"></i> Volver a la lista
            </button>
            <button class="eg-btn-primary" [disabled]="!canConfirm() || saving()" (click)="confirmOpen.set(true)" data-tour="recv-confirm">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
              @else { <i class="fa-solid fa-check"></i> Confirmar recepción }
            </button>
          </div>
        </div>
      }
    </div>
    }

    <!-- Modal manual -->
    @if (showManual()) {
      <dlx-manual-product-modal [brands]="brands()" [categories]="categories()" [categoryParents]="categoryParents()" [barcode]="manualBarcode()"
                                (add)="onManualAdd($event)" (cancel)="showManual.set(false)" />
    }

    <!-- Modal proveedor completo -->
    @if (showSupplierModal()) {
      <dlx-supplier-form-modal [initialName]="supplierName"
                               (saved)="onSupplierCreated($event)" (cancel)="showSupplierModal.set(false)" />
    }

    <!-- Panel: agregar producto existente a la lista -->
    @if (addDraft(); as d) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl max-h-[88vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
            <h2 class="font-bold text-lg">Agregar a la lista</h2>
            <button class="text-slate-400 hover:text-slate-600" (click)="addDraft.set(null)"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-start gap-3">
              @if (d.variant.images && d.variant.images.length) {
                <img [src]="d.variant.images[0]" [alt]="d.variant.product_name" (error)="onImgErr($event)"
                     class="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-white/10 shrink-0" />
              } @else {
                <div class="w-20 h-20 rounded-xl grid place-items-center bg-slate-100 dark:bg-white/5 text-slate-300 shrink-0">
                  <i class="fa-solid fa-image text-xl"></i>
                </div>
              }
              <div class="min-w-0">
                <p class="font-bold truncate">{{ d.variant.product_name }}</p>
                <p class="text-xs text-slate-400">{{ d.variant.size || '—' }} / {{ d.variant.color || '—' }}</p>
                <p class="text-xs text-slate-400 font-mono truncate">{{ d.variant.sku }}@if (d.variant.barcode) { · {{ d.variant.barcode }} }</p>
              </div>
            </div>

            <div>
              <label class="text-[11px] text-slate-400">Costo unitario</label>
              <div class="sm:max-w-[180px]">
                <dlx-price-input [(ngModel)]="d.unit_cost" extraClass="!h-10 w-full" />
              </div>
            </div>

            <div>
              <label class="text-[11px] text-slate-400">¿A qué sucursal(es) y cuántas?</label>
              @if (!selectedBranches().length) {
                <p class="text-xs text-amber-600 mt-1">Primero selecciona al menos una sucursal en el paso 1.</p>
              } @else {
                <div class="space-y-1.5 mt-0.5">
                  @for (b of selectedBranchList(); track b.id) {
                    <div class="flex items-center gap-2 rounded-xl border pl-3 pr-1.5 h-11 transition"
                         [ngClass]="d.branchQty[b.id] != null ? 'border-[#1e40af] bg-[#1e40af]/5' : 'border-slate-200 dark:border-white/10'">
                      <label class="flex items-center gap-2 flex-1 min-w-0 h-full cursor-pointer">
                        <input type="checkbox" [checked]="d.branchQty[b.id] != null" (change)="panelToggle(b.id)" class="w-4 h-4 accent-[#1e40af] shrink-0" />
                        <span class="text-sm truncate">{{ b.name }} · {{ b.city }}</span>
                      </label>
                      @if (d.branchQty[b.id] != null) {
                        <div class="w-20 shrink-0">
                          <input type="number" min="0" [ngModel]="d.branchQty[b.id]" (ngModelChange)="panelSetQty(b.id, $event)"
                                 class="eg-input !h-8 w-full text-center text-sm" placeholder="0" />
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
          <div class="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-white/10">
            <button class="btn-secondary" (click)="addDraft.set(null)">Cancelar</button>
            <button class="eg-btn-primary" (click)="confirmAddExisting()"><i class="fa-solid fa-plus"></i> Agregar a la lista</button>
          </div>
        </div>
      </div>
    }

    <!-- Popup detalle -->
    @if (detailRow(); as d) {
      <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl p-5 max-h-[85vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="min-w-0">
              <h3 class="font-bold text-lg truncate">{{ d.product_name }}</h3>
              <p class="text-xs text-slate-400">
                {{ kindLabel(d.kind) }}
                @if (d.isNew) { <span class="text-emerald-600">· producto nuevo</span> }
                @else { <span class="text-slate-400">· ya existía</span> }
              </p>
            </div>
            <button class="text-slate-400 hover:text-slate-600" (click)="detailRow.set(null)"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          @if (d.images && d.images.length) {
            <div class="mb-4">
              <div class="rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 aspect-square grid place-items-center">
                @if (!isImgBroken(detailImg())) {
                  <img [src]="d.images[detailImg()]" [alt]="d.product_name" class="w-full h-full object-contain" (error)="markImgBroken(detailImg())" />
                } @else {
                  <div class="text-slate-300 dark:text-white/20 text-center">
                    <i class="fa-solid fa-image text-3xl"></i>
                    <p class="text-xs mt-1">Imagen no disponible</p>
                  </div>
                }
              </div>
              @if (d.images.length > 1) {
                <div class="flex gap-2 mt-2 overflow-x-auto pb-1">
                  @for (img of d.images; track $index; let idx = $index) {
                    <button type="button" (click)="detailImg.set(idx)"
                            class="w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition grid place-items-center bg-slate-100 dark:bg-white/5"
                            [ngClass]="detailImg() === idx ? 'border-[#1e40af]' : 'border-transparent opacity-60 hover:opacity-100'">
                      @if (!isImgBroken(idx)) {
                        <img [src]="img" class="w-full h-full object-cover" (error)="markImgBroken(idx)" />
                      } @else {
                        <i class="fa-solid fa-image text-slate-300 dark:text-white/20"></i>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }
          <dl class="text-sm divide-y divide-slate-100 dark:divide-white/5">
            <div class="flex justify-between py-2"><dt class="text-slate-500">Marca</dt><dd class="font-medium">{{ d.brand_name || '—' }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-slate-500">Categoría</dt><dd class="font-medium">{{ d.category_name || '—' }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-slate-500">Talla / Color</dt><dd class="font-medium">{{ d.size || '—' }} / {{ d.color || '—' }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-slate-500">Código de barras</dt><dd class="font-mono text-xs">{{ d.barcode || '—' }}</dd></div>
            @if (d.sku) { <div class="flex justify-between py-2"><dt class="text-slate-500">Código interno</dt><dd class="font-mono text-xs">{{ d.sku }}</dd></div> }
            <div class="flex justify-between py-2"><dt class="text-slate-500">Sucursales</dt><dd class="font-medium text-right">{{ rowBranchSummary(d) || '—' }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-slate-500">Costo unitario</dt><dd class="font-medium">{{ money(d.unit_cost) }}</dd></div>
            @if (d.price) { <div class="flex justify-between py-2"><dt class="text-slate-500">Precio venta</dt><dd class="font-medium">{{ money(d.price) }}</dd></div> }
            <div class="flex justify-between py-2"><dt class="text-slate-500">Cantidad total</dt><dd class="font-bold">{{ rowUnits(d) }}</dd></div>
            <div class="flex justify-between py-2"><dt class="text-slate-500">Subtotal</dt><dd class="font-bold">{{ money(rowUnits(d) * (+d.unit_cost || 0)) }}</dd></div>
          </dl>
        </div>
      </div>
    }

    <dlx-confirm-dialog
      [open]="clearOpen()"
      title="¿Limpiar la lista?"
      message="Se quitarán todos los productos que aún no has confirmado. Esta acción no se puede deshacer."
      variant="danger" icon="fa-trash-can" confirmText="Limpiar"
      (confirmed)="doClear()" (cancelled)="clearOpen.set(false)" />

    <dlx-confirm-dialog
      [open]="confirmOpen()"
      title="¿Ingresar la mercadería al inventario?"
      [message]="confirmMessage()"
      variant="info" icon="fa-boxes-stacked" confirmText="Sí, ingresar al stock"
      [loading]="saving()"
      (confirmed)="confirm()" (cancelled)="confirmOpen.set(false)" />
    }
  `,
})
export class ReceptionComponent implements OnInit, OnDestroy {
  private inv = inject(InventoryService);
  private admin = inject(AdminService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private branding = inject(BrandingService);
  private branchCtx = inject(BranchContextService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private tour = inject(TourService);

  private readonly STORAGE_KEY = 'dlx_reception_draft';

  @ViewChild('camVideo') camVideo?: ElementRef<HTMLVideoElement>;
  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;
  private lastScan = '';
  private lastScanAt = 0;

  tab = signal<'upload' | 'review' | 'confirm'>('upload');

  branches = signal<AdminBranch[]>([]);
  suppliers = signal<Supplier[]>([]);
  brands = signal<string[]>([]);
  categories = signal<string[]>([]);
  categoryParents = signal<Record<string, string>>({});

  selectedBranches = signal<number[]>([]);
  private restoredBranches: number[] | null = null;
  supplierName = '';
  note = '';

  scanCode = '';
  scanMsg = signal<string | null>(null);

  items = signal<Row[]>([]);
  private keySeq = 1;
  showManual = signal(false);
  manualBarcode = signal('');
  detailRow = signal<Row | null>(null);
  detailImg = signal(0);
  brokenImgs = signal<Set<number>>(new Set());
  addDraft = signal<AddDraft | null>(null);
  clearOpen = signal(false);
  confirmOpen = signal(false);
  prodQuery = '';
  searchOpen = signal(false);
  searchResults = signal<NonNullable<ScanResult['variant']>[]>([]);
  prodSearch$ = new Subject<string>();
  saving = signal(false);
  result = signal<ReceptionResult | null>(null);
  labelPerUnit = true;

  isMulti = computed(() => this.selectedBranches().length > 1);
  singleBranch = computed(() => this.selectedBranches()[0] ?? 0);
  totalUnits = computed(() => this.items().reduce((a, r) => a + this.rowUnits(r), 0));
  totalCost = computed(() => this.items().reduce((a, r) => a + this.rowUnits(r) * (+r.unit_cost || 0), 0));

  ngOnInit(): void {
    this.restoreState();
    this.prodSearch$.pipe(debounceTime(250)).subscribe(q => this.runProdSearch(q));
    this.admin.listBranches().subscribe(r => {
      const active = r.results.filter(b => b.is_active);
      this.branches.set(active);
      if (this.restoredBranches && this.restoredBranches.length) {
        const valid = this.restoredBranches.filter(id => active.some(b => b.id === id));
        this.selectedBranches.set(valid.length ? valid : (active.length ? [active[0].id] : []));
      } else {
        const ctx = this.branchCtx.current();
        this.selectedBranches.set(ctx ? [ctx] : (active.length ? [active[0].id] : []));
      }
    });
    this.inv.listSuppliers().subscribe(r => this.suppliers.set(r.results));
    this.brandSvc.list({ page_size: 100 }).subscribe(r => this.brands.set(r.results.map(b => b.name)));
    this.catSvc.list({ page_size: 100 }).subscribe(r => {
      this.categories.set(r.results.map(c => c.name));
      const map: Record<string, string> = {};
      for (const c of r.results) { if (c.parent_name) map[c.name] = c.parent_name; }
      this.categoryParents.set(map);
    });
    if (typeof window !== 'undefined' && localStorage.getItem('dlx_tour_reception') !== '1') {
      setTimeout(() => { this.startTour(); localStorage.setItem('dlx_tour_reception', '1'); }, 700);
    }
  }

  // ── Persistencia del borrador ──
  saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        items: this.items(),
        selectedBranches: this.selectedBranches(),
        supplierName: this.supplierName,
        note: this.note,
        keySeq: this.keySeq,
      }));
    } catch { /* storage lleno o no disponible */ }
  }

  private restoreState(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.items) && d.items.length) {
        this.items.set((d.items as any[]).map(r => {
          if (!r.branchQty) {
            const bid = r.branch_id;
            r.branchQty = (bid != null) ? { [bid]: r.quantity ?? 1 } : {};
          }
          return r as Row;
        }));
        const maxKey = d.items.reduce((m: number, r: any) => Math.max(m, r.key || 0), 0);
        this.keySeq = d.keySeq && d.keySeq > maxKey ? d.keySeq : maxKey + 1;
        if (d.supplierName) this.supplierName = d.supplierName;
        if (d.note) this.note = d.note;
        if (Array.isArray(d.selectedBranches) && d.selectedBranches.length) {
          this.restoredBranches = d.selectedBranches;
        }
      }
    } catch { /* draft corrupto */ }
  }

  private clearState(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(this.STORAGE_KEY);
  }

  startTour(): void { this.tour.runSteps(this.tourSteps); }

  readonly tourSteps: TourStep[] = [
    { target: null, placement: 'center', icon: 'fa-truck-ramp-box',
      title: 'Cómo recibir mercadería',
      body: 'En 3 pasos: subes los productos, revisas la lista y confirmas. La lista se guarda sola aunque recargues la página.' },
    { target: '[data-tour=\"recv-branch\"]', placement: 'right', icon: 'fa-store',
      title: '1. Sucursales destino',
      body: 'Marca a qué sucursales llega la mercadería. Si son varias, asignas cada producto a su sucursal en la pestaña Revisar.' },
    { target: '[data-tour=\"recv-supplier\"]', placement: 'right', icon: 'fa-truck-field',
      title: '2. Proveedor',
      body: 'Escribe el proveedor. Si no existe, se crea solo. Queda el historial de quién te entregó.' },
    { target: '[data-tour=\"recv-scan\"]', placement: 'right', icon: 'fa-barcode',
      title: '3. Escanea el código',
      body: 'Escanea (o escribe y Enter) el código de la caja. Si ya existe, suma +1; si es nuevo, abre el formulario.' },
    { target: '[data-tour=\"recv-manual\"]', placement: 'right', icon: 'fa-plus',
      title: '4. O agrégalo manual',
      body: 'Si no tiene código, agrégalo a mano. El formulario se adapta al tipo: calzado tallas 35-45, ropa S-XL, etc.' },
    { target: '[data-tour=\"recv-confirm\"]', placement: 'top', icon: 'fa-check',
      title: '5. Confirma',
      body: 'Al confirmar se crea todo de golpe y se genera el código interno. Luego podrás imprimir las etiquetas. ¡Listo! 🚀' },
  ];

  canConfirm(): boolean { return this.selectedBranches().length > 0 && this.totalUnits() > 0; }

  confirmMessage(): string {
    const prods = this.items().length;
    const uds = this.totalUnits();
    const sucs = this.selectedBranchList().length;
    const dest = this.branchNames();
    return `Estás por confirmar la recepción de ${prods} producto(s) con un total de ${uds} unidad(es). ` +
      `Estas unidades se SUMARÁN al inventario (stock) de ${sucs > 1 ? sucs + ' sucursales' : dest}. ` +
      `Se generará el código interno de cada producto nuevo y la recepción quedará registrada en el historial. ` +
      `Esta acción no se puede deshacer.`;
  }

  rowUnits(r: Row): number {
    return Object.values(r.branchQty || {}).reduce((a, q) => a + (+q || 0), 0);
  }
  rowBranchOptions(_r: Row): AdminBranch[] {
    // El paso 2 muestra SIEMPRE todas las sucursales de la tienda.
    // Las "activas" (marcadas) son las que el producto tiene asignadas (branchQty),
    // que vienen de lo elegido en el paso 1 al momento de agregarlo. Independiente del paso 1.
    return this.branches();
  }
  hasBranch(r: Row, bid: number): boolean { return r.branchQty?.[bid] != null; }
  toggleRowBranch(r: Row, bid: number): void {
    if (!r.branchQty) r.branchQty = {};
    if (!r.branchMemo) r.branchMemo = {};
    if (r.branchQty[bid] != null) {
      // Desmarcar: recuerda la cantidad que tenía.
      r.branchMemo[bid] = +r.branchQty[bid] || 0;
      delete r.branchQty[bid];
    } else {
      // Volver a marcar: restaura la cantidad previa, o 1 si no había.
      const prev = +(r.branchMemo[bid] ?? 0);
      r.branchQty[bid] = prev > 0 ? prev : 1;
    }
    this.touchItems();
  }
  setRowQty(r: Row, bid: number, val: any): void {
    if (!r.branchQty) r.branchQty = {};
    r.branchQty[bid] = Math.max(0, +val || 0);
    this.items.set([...this.items()]);
    this.saveState();
  }
  rowBranchSummary(r: Row): string {
    return Object.entries(r.branchQty || {})
      .filter(([, q]) => (+q) > 0)
      .map(([bid, q]) => this.branchLabel(+bid) + ': ' + q)
      .join(' · ');
  }
  groupedSummary(): { key: string; name: string; isNew: boolean; rows: Row[] }[] {
    const groups: { key: string; name: string; isNew: boolean; rows: Row[] }[] = [];
    const idx = new Map<string, number>();
    for (const it of this.items()) {
      const key = it.product_name + '|' + (it.isNew ? 'n' : 'e');
      let i = idx.get(key);
      if (i == null) { i = groups.length; idx.set(key, i); groups.push({ key, name: it.product_name, isNew: it.isNew, rows: [] }); }
      groups[i].rows.push(it);
    }
    return groups;
  }
  groupUnits(rows: Row[]): number { return rows.reduce((a, r) => a + this.rowUnits(r), 0); }
  groupCost(rows: Row[]): number { return rows.reduce((a, r) => a + this.rowUnits(r) * (+r.unit_cost || 0), 0); }
  private bumpBranchQty(r: Row, bid: number | null): void {
    if (bid == null) return;
    if (!r.branchQty) r.branchQty = {};
    r.branchQty[bid] = (+r.branchQty[bid] || 0) + 1;
  }
  private normalizeRows(): void {
    // Solo quita las sucursales que ya no están seleccionadas; NO toca las
    // asignaciones por producto (cada producto recuerda sus sucursales/cantidades).
    const sel = this.selectedBranches();
    this.items.update(list => list.map(r => {
      const bq: Record<number, number> = {};
      for (const [bid, q] of Object.entries(r.branchQty || {})) if (sel.includes(+bid)) bq[+bid] = +q;
      return { ...r, branchQty: bq };
    }));
  }

  isSelected(id: number): boolean { return this.selectedBranches().includes(id); }
  isBranchLocked(id: number): boolean {
    const r = this.auth.user()?.role;
    const single = (r === 'BRANCH_MANAGER' || r === 'SALESPERSON') && !!this.auth.user()?.branch_id;
    return single && this.auth.user()?.branch_id === id;
  }
  defaultBranchId(): number | null { return this.selectedBranches()[0] ?? null; }
  selectedBranchList() { return this.branches().filter(b => this.selectedBranches().includes(b.id)); }
  branchLabel(id: number | null): string {
    if (id == null) return '';
    return this.branches().find(b => b.id === id)?.name ?? '';
  }
  branchNames(): string {
    const list = this.selectedBranchList();
    return list.length ? list.map(b => b.name).join(', ') : '—';
  }
  kindLabel(k: string): string { return KIND_LABELS[k] ?? k ?? 'Otro'; }

  tabCls(t: string): string {
    const base = 'relative px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition';
    return this.tab() === t
      ? base + ' bg-white dark:bg-[#1e2535] shadow text-[#1e40af] dark:text-white'
      : base + ' text-slate-500 hover:text-slate-700 dark:hover:text-white';
  }
  goReview(): void { this.tab.set('review'); }
  goConfirm(): void { this.tab.set(this.items().length ? 'confirm' : 'review'); }

  readonly steps: { id: 'upload' | 'review' | 'confirm'; label: string }[] = [
    { id: 'upload', label: 'Subir productos' },
    { id: 'review', label: 'Revisar lista' },
    { id: 'confirm', label: 'Confirmar' },
  ];
  private stepOrder: Record<'upload' | 'review' | 'confirm', number> = { upload: 0, review: 1, confirm: 2 };
  stepState(id: 'upload' | 'review' | 'confirm'): 'done' | 'active' | 'todo' {
    const cur = this.stepOrder[this.tab()];
    const idx = this.stepOrder[id];
    if (idx === cur) return 'active';
    return idx < cur ? 'done' : 'todo';
  }
  stepDone(id: 'upload' | 'review' | 'confirm'): boolean { return this.stepOrder[id] < this.stepOrder[this.tab()]; }
  stepCircleCls(id: 'upload' | 'review' | 'confirm'): string {
    const st = this.stepState(id);
    if (st === 'active') return 'bg-gradient-to-br from-[#1e40af] to-[#3b82f6] text-white shadow-lg shadow-[#1e40af]/30 ring-4 ring-[#1e40af]/15 scale-105';
    if (st === 'done') return 'bg-[#1e40af] text-white shadow-md shadow-[#1e40af]/25';
    return 'bg-slate-100 dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/10';
  }
  goStep(id: 'upload' | 'review' | 'confirm'): void {
    if (id === 'confirm' && !this.items().length) { this.tab.set('review'); return; }
    this.tab.set(id);
  }


  toggleBranch(id: number): void {
    if (this.isBranchLocked(id)) return;
    const cur = this.selectedBranches();
    if (cur.includes(id)) {
      this.selectedBranches.set(cur.filter(x => x !== id));
    } else {
      this.selectedBranches.set([...cur, id]);
    }
    // No tocar los productos ya agregados: cada uno conserva sus sucursales.
    this.saveState();
  }

  onScan(): void {
    const code = this.scanCode.trim();
    if (!code || !this.defaultBranchId()) return;
    this.scanMsg.set('Buscando...');
    this.inv.scan(code, this.defaultBranchId()!).subscribe({
      next: (res) => {
        this.scanCode = '';
        if (res.found && res.variant) {
          const v = res.variant;
          const def = this.defaultBranchId();
          const existing = this.items().find(r => r.variant_id === v.id);
          if (existing) {
            this.bumpBranchQty(existing, def);
            this.items.set([...this.items()]);
            this.scanMsg.set(`+1 a ${v.product_name} (${v.size}/${v.color})`);
          } else {
            this.items.update(list => [...list, {
              key: this.keySeq++, variant_id: v.id, product_name: v.product_name,
              brand_name: v.brand_name, category_name: v.category_name,
              kind: v.kind, color: v.color, size: v.size, barcode: v.barcode || code,
              sku: v.sku,
              unit_cost: +v.cost || 0,
              price: v.price_override != null ? +v.price_override : +v.base_price || 0,
              isNew: false, branchQty: def != null ? { [def]: 1 } : {}, images: v.images,
            }]);
            this.scanMsg.set(`Agregado: ${v.product_name} (${v.size}/${v.color})`);
          }
          this.saveState();
        } else {
          this.scanMsg.set('Código nuevo: completa los datos del producto.');
          this.openNew(code);
        }
      },
      error: () => this.scanMsg.set('No se pudo buscar el código.'),
    });
  }

  openNew(barcode: string): void {
    this.manualBarcode.set(barcode);
    this.showManual.set(true);
  }

  openDetail(it: Row): void { this.detailImg.set(0); this.brokenImgs.set(new Set()); this.detailRow.set(it); }
  isImgBroken(idx: number): boolean { return this.brokenImgs().has(idx); }
  markImgBroken(idx: number): void { const set = new Set(this.brokenImgs()); set.add(idx); this.brokenImgs.set(set); }
  onImgErr(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#eef2f7"/>' +
      '<circle cx="37" cy="40" r="7" fill="#cbd5e1"/>' +
      '<path d="M22 70l18-20 12 14 9-10 17 16z" fill="#cbd5e1"/></svg>');
  }
  touchItems(): void { this.items.set([...this.items()]); this.saveState(); }

  onManualAdd(list: ManualProduct[]): void {
    const def = this.defaultBranchId();
    this.items.update(cur => [...cur, ...list.map(p => ({
      key: this.keySeq++, product_name: p.product_name, brand_name: p.brand,
      category_name: p.category, kind: p.kind, color: p.color, size: p.size,
      barcode: p.barcode, unit_cost: p.cost, price: p.price, description: p.description,
      isNew: true, branchQty: (def != null ? { [def]: +p.quantity || 1 } : {}), images: p.images,
    }))]);
    this.showManual.set(false);
    this.scanMsg.set('Agregado: ' + list.length + ' variante(s)');
    this.saveState();
  }

  runProdSearch(q: string): void {
    const t = (q || '').trim();
    if (t.length < 2) { this.searchResults.set([]); return; }
    this.inv.variantSearch(t).subscribe({
      next: r => this.searchResults.set(r.results),
      error: () => this.searchResults.set([]),
    });
  }

  closeSearchSoon(): void { setTimeout(() => this.searchOpen.set(false), 150); }

  addExisting(v: NonNullable<ScanResult['variant']>): void {
    this.searchOpen.set(false); this.prodQuery = ''; this.searchResults.set([]);
    const existing = this.items().find(r => r.variant_id === v.id);
    let branchQty: Record<number, number>;
    if (existing) {
      // Ya está en la lista: refleja su asignación actual para editarla.
      branchQty = { ...existing.branchQty };
    } else {
      // Nuevo: pre-marca todas las sucursales elegidas en el paso 1.
      branchQty = {};
      for (const id of this.selectedBranches()) branchQty[id] = 1;
    }
    this.addDraft.set({ variant: v, unit_cost: existing ? existing.unit_cost : (+v.cost || 0), branchQty });
  }

  panelToggle(bid: number): void {
    const d = this.addDraft(); if (!d) return;
    if (d.branchQty[bid] != null) delete d.branchQty[bid]; else d.branchQty[bid] = 1;
    this.addDraft.set({ ...d, branchQty: { ...d.branchQty } });
  }
  panelSetQty(bid: number, val: any): void {
    const d = this.addDraft(); if (!d) return;
    d.branchQty[bid] = Math.max(0, +val || 0);
    this.addDraft.set({ ...d, branchQty: { ...d.branchQty } });
  }
  confirmAddExisting(): void {
    const d = this.addDraft(); if (!d) return;
    const v = d.variant;
    const sel = this.selectedBranches();
    const bq: Record<number, number> = {};
    for (const [b, q] of Object.entries(d.branchQty)) if (sel.includes(+b) && (+q) > 0) bq[+b] = +q;
    if (!Object.keys(bq).length) { this.notify.error('Marca al menos una sucursal con cantidad.'); return; }
    const existing = this.items().find(r => r.variant_id === v.id);
    if (existing) {
      existing.branchQty = bq;
      existing.unit_cost = d.unit_cost;
      this.items.set([...this.items()]);
    } else {
      this.items.update(list => [...list, {
        key: this.keySeq++, variant_id: v.id, product_name: v.product_name,
        brand_name: v.brand_name, category_name: v.category_name,
        kind: v.kind, color: v.color, size: v.size, barcode: v.barcode || '',
        sku: v.sku, unit_cost: d.unit_cost,
        price: v.price_override != null ? +v.price_override : +v.base_price || 0,
        isNew: false, branchQty: bq, images: v.images,
      }]);
    }
    this.scanMsg.set('Agregado: ' + v.product_name);
    this.addDraft.set(null);
    this.saveState();
  }

  removeRow(key: number): void {
    this.items.update(list => list.filter(r => r.key !== key));
    this.saveState();
  }

  askClear(): void { this.clearOpen.set(true); }
  doClear(): void {
    this.items.set([]);
    this.scanMsg.set(null);
    this.clearOpen.set(false);
    this.clearState();
    this.tab.set('upload');
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    this.saving.set(true);
    const sel = this.selectedBranches();
    const items: ReceptionItemIn[] = [];
    for (const r of this.items()) {
      const entries = Object.entries(r.branchQty || {}).filter(([, q]) => (+q) > 0);
      for (const [bid, q] of entries) {
        items.push(r.variant_id
          ? { variant_id: r.variant_id, quantity: +q, unit_cost: +r.unit_cost, branch: +bid }
          : {
              quantity: +q, unit_cost: +r.unit_cost, barcode: r.barcode,
              product_name: r.product_name, kind: r.kind,
              brand_name: r.brand_name, category_name: r.category_name,
              color: r.color, size: r.size, price: +(r.price ?? 0), branch: +bid, images: r.images, description: r.description,
            });
      }
    }
    if (!items.length) { this.saving.set(false); this.notify.error('Asigna cantidad a por lo menos una sucursal.'); return; }
    this.inv.createReception({
      branch: this.defaultBranchId()!, supplier_name: this.supplierName.trim() || undefined,
      note: this.note.trim() || undefined, items,
    }).subscribe({
      next: (r) => { this.saving.set(false); this.confirmOpen.set(false); this.result.set(r); this.clearState(); this.notify.success('Recepción confirmada'); },
      error: (e) => { this.saving.set(false); this.notify.error(parseApiError(e).message || 'No se pudo confirmar.'); },
    });
  }

  reset(): void {
    this.result.set(null);
    this.items.set([]);
    this.supplierName = '';
    this.note = '';
    this.scanMsg.set(null);
    this.tab.set('upload');
    this.clearState();
  }

  money(v: number): string { return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2); }

  ngOnDestroy(): void { this.stopCamera(); }

  supplierOpen = signal(false);
  showSupplierModal = signal(false);

  filteredSuppliers() {
    const q = this.supplierName.trim().toLowerCase();
    const list = this.suppliers();
    return (q ? list.filter(s => s.name.toLowerCase().includes(q)) : list).slice(0, 8);
  }
  pickSupplier(name: string): void { this.supplierName = name; this.supplierOpen.set(false); this.saveState(); }
  closeSupplierSoon(): void { setTimeout(() => this.supplierOpen.set(false), 150); }

  onSupplierCreated(s: Supplier): void {
    this.suppliers.update(l => {
      const others = l.filter(x => x.id !== s.id);
      return [s, ...others];
    });
    this.supplierName = s.name;
    this.showSupplierModal.set(false);
    this.notify.success('Proveedor guardado');
    this.saveState();
  }

  saveSupplier(): void {
    const name = this.supplierName.trim();
    if (!name) return;
    if (this.suppliers().some(s => s.name.toLowerCase() === name.toLowerCase())) {
      this.notify.success('Ese proveedor ya está guardado.');
      return;
    }
    this.inv.createSupplier({ name }).subscribe({
      next: (sup) => { this.suppliers.update(l => [...l, sup]); this.notify.success('Proveedor guardado'); },
      error: (e) => this.notify.error(parseApiError(e).message || 'No se pudo guardar el proveedor.'),
    });
  }

  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta cámara para escanear. Usa una pistola o escribe el código.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara (requiere HTTPS y permiso).');
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.camVideo?.nativeElement;
      if (v && this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.camVideo?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) this.onCameraCode(codes[0].rawValue || '');
    } catch { /* frame sin codigo */ }
    if (this.cameraOn()) this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  private onCameraCode(raw: string): void {
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (!code) return;
    const now = Date.now();
    if (code === this.lastScan && now - this.lastScanAt < 2500) return;
    this.lastScan = code; this.lastScanAt = now;
    this.scanCode = code;
    this.onScan();
  }

  printLabels(): void {
    const r = this.result();
    if (!r || typeof window === 'undefined') return;
    const store = (this.branding.siteName() || 'DELUX').toUpperCase();
    let html = '';
    for (const it of r.items) {
      const copies = this.labelPerUnit ? Math.max(1, it.quantity) : 1;
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
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
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
