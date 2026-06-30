import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { BrandingService } from '@core/services/branding.service';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Product, ProductImage, ProductPayload, ProductService } from '@features/superadmin/services/product.service';
import { BrandService, Brand } from '@features/superadmin/services/brand.service';
import { CategoryService, Category } from '@features/superadmin/services/category.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { NotifyService } from '@shared/services/notify.service';
import { FileValidatorService } from '@shared/services/file-validator.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
      <a routerLink="/app/admin/products" class="hover:text-ink-950">Productos</a>
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
      <span class="uppercase tracking-widest font-semibold">
        {{ isEdit() ? 'Editar' : 'Nuevo' }}
      </span>
    </div>
    <h1 class="text-2xl md:text-3xl font-bold tracking-tight mb-6">
      {{ isEdit() ? payload.name : 'Nuevo producto' }}
    </h1>

    <form (ngSubmit)="save()" #f="ngForm" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- COL principal -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Info básica -->
        <div class="card p-6 space-y-4">
          <h2 class="font-bold tracking-tight">Información básica</h2>
          <div>
            <label class="eg-label">Nombre *</label>
            <input [(ngModel)]="payload.name" name="name" required maxlength="160"
                   class="eg-input" [class.!border-rose-400]="fe('name')" />
            @if (fe('name')) { <p class="text-xs text-rose-600 mt-1">{{ fe('name') }}</p> }
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="eg-label">Género</label>
              <select [(ngModel)]="payload.gender" name="gender"
                      class="eg-input">
                <option value="UNISEX">Unisex</option>
                <option value="MEN">Hombre</option>
                <option value="WOMEN">Mujer</option>
                <option value="KIDS">Niños</option>
              </select>
            </div>
          </div>
          <div>
            <label class="eg-label">Descripción (opcional)</label>
            <textarea [(ngModel)]="payload.description" name="description" rows="4"
                      class="eg-input" placeholder="Descripción del producto…"></textarea>
          </div>
        </div>

        <!-- GALERÍA -->
        <div class="card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold tracking-tight">Galería de imágenes</h2>
            <span class="text-xs text-slate-500">{{ images().length }} imágenes</span>
          </div>

          <!-- Imágenes actuales -->
          @if (images().length > 0) {
            <div class="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              @for (img of images(); track $index; let i = $index) {
                <div class="relative group aspect-square rounded-lg overflow-hidden border-2 transition"
                     [class.border-violet-500]="img.is_main"
                     [class.border-slate-200]="!img.is_main">
                  <img [src]="img.url" [alt]="img.alt || 'imagen'"
                       class="w-full h-full object-cover" crossorigin="anonymous" (error)="onImgErr($event)" />
                  @if (img.is_main) {
                    <span class="absolute top-1 left-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500 text-white">
                      Main
                    </span>
                  }
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    @if (!img.is_main) {
                      <button type="button" (click)="setMain(i)" title="Marcar principal"
                              class="w-8 h-8 rounded-full bg-white grid place-items-center hover:bg-slate-100 shadow">
                        <i class="fa-solid fa-star text-violet-600 text-sm"></i>
                      </button>
                    }
                    @if (images().length > 1) {
                      <button type="button" (click)="moveUp(i)" title="Mover" [disabled]="i === 0"
                              class="w-8 h-8 rounded-full bg-white grid place-items-center hover:bg-slate-100 disabled:opacity-30 shadow">
                        <i class="fa-solid fa-arrow-left text-slate-800 text-sm"></i>
                      </button>
                      <button type="button" (click)="moveDown(i)" title="Mover" [disabled]="i === images().length - 1"
                              class="w-8 h-8 rounded-full bg-white grid place-items-center hover:bg-slate-100 disabled:opacity-30 shadow">
                        <i class="fa-solid fa-arrow-right text-slate-800 text-sm"></i>
                      </button>
                    }
                    <button type="button" (click)="removeImg(i)" title="Eliminar"
                            class="w-8 h-8 rounded-full bg-rose-500 grid place-items-center hover:bg-rose-600 shadow">
                      <i class="fa-solid fa-trash text-white text-sm"></i>
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Subir desde el dispositivo (drag & drop o seleccionar) -->
          <div class="mb-3 rounded-xl border-2 border-dashed transition cursor-pointer p-6 text-center"
               [class.border-violet-400]="dragOver()"
               [class.bg-violet-50]="dragOver()"
               [class.border-slate-300]="!dragOver()"
               (click)="fileInput.click()"
               (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
            <input #fileInput type="file" accept="image/*" multiple hidden (change)="onFilePick($event)" />
            @if (uploading()) {
              <i class="fa-solid fa-spinner fa-spin text-violet-600 text-xl mb-2"></i>
              <p class="text-sm text-slate-600">Subiendo imágenes...</p>
            } @else {
              <i class="fa-solid fa-cloud-arrow-up text-slate-400 text-2xl mb-2"></i>
              <p class="text-sm font-semibold text-slate-700">Arrastra imágenes aquí o haz clic para seleccionar</p>
              <p class="text-[11px] text-slate-400 mt-1">JPG, PNG, WEBP, GIF o AVIF · hasta 8 MB c/u</p>
            }
          </div>

          <!-- Tomar foto (cámara en móvil/tablet) -->
          <button type="button" class="eg-btn-secondary w-full mb-3" (click)="cameraInput.click()">
            <i class="fa-solid fa-camera"></i> Tomar foto
          </button>
          <input #cameraInput type="file" accept="image/*" capture="environment" hidden (change)="onFilePick($event)" />

          <!-- Añadir por URL -->
          <div class="flex gap-2">
            <input [(ngModel)]="newImgUrl" name="newImgUrl" type="url" placeholder="https://imagen.com/foto.jpg"
                   class="eg-input flex-1" />
            <button type="button" (click)="addImg()" [disabled]="!newImgUrl"
                    class="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
              <i class="fa-solid fa-plus"></i> Añadir
            </button>
          </div>
          <p class="text-[10px] text-slate-400 mt-2">
            También puedes pegar una URL pública. La primera marcada como "Main" será la imagen principal del producto.
          </p>
        </div>

        <!-- Variantes (tallas y colores) -->
        <div class="card p-6">
          <h2 class="font-bold tracking-tight mb-1">Variantes</h2>
          <p class="text-xs text-slate-500 mb-4">
            Define tallas y colores. Se crean combinando talla × color, con stock inicial 0 en cada sucursal
            (luego lo ajustas en Inventario). {{ variantCount() }} variante(s) se generarán.
          </p>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Tallas</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <button type="button" (click)="addPreset('shoe')" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">Calzado 38-44</button>
            <button type="button" (click)="addPreset('cloth')" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">Ropa S-XL</button>
            <button type="button" (click)="addPreset('shoeKids')" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">Calzado niños 18-34</button>
            <button type="button" (click)="addPreset('clothKids')" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">Ropa niños 2-16</button>
            <button type="button" (click)="addPreset('unica')" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">Única</button>
          </div>
          <div class="flex flex-wrap gap-2 mb-2">
            @for (sz of sizes(); track sz) {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold">
                {{ sz }}
                <button type="button" (click)="removeSize(sz)" class="hover:text-violet-900"><i class="fa-solid fa-xmark text-[11px]"></i></button>
              </span>
            }
          </div>
          <div class="flex gap-2 mb-5">
            <input [(ngModel)]="newSize" name="newSize" (keydown.enter)="$event.preventDefault(); addSize()"
                   placeholder="Ej: 42, M, XL" maxlength="20"
                   class="eg-input flex-1" />
            <button type="button" (click)="addSize()" [disabled]="!newSize.trim()"
                    class="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">Añadir</button>
          </div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Colores</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            @for (c of colorPresets; track c) {
              <button type="button" (click)="addColorValue(c)" class="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold">{{ c }}</button>
            }
          </div>
          <div class="flex flex-wrap gap-2 mb-2">
            @for (col of colors(); track col) {
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 text-sm font-semibold">
                {{ col }}
                <button type="button" (click)="removeColor(col)" class="hover:text-sky-900"><i class="fa-solid fa-xmark text-[11px]"></i></button>
              </span>
            }
          </div>
          <div class="flex gap-2">
            <input [(ngModel)]="newColor" name="newColor" (keydown.enter)="$event.preventDefault(); addColor()"
                   placeholder="Ej: Negro, Azul marino" maxlength="40"
                   class="eg-input flex-1" />
            <button type="button" (click)="addColor()" [disabled]="!newColor.trim()"
                    class="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">Añadir</button>
          </div>
        </div>

        <!-- Disponibilidad inicial por sucursal -->
        @if (!isEdit()) {
          <div class="card p-6">
            <h2 class="font-bold tracking-tight mb-1">Disponibilidad inicial por sucursal</h2>
            <p class="text-xs text-slate-500 mb-4">
              Marca a qué sucursales va este producto y la cantidad inicial de cada variante. Lo puedes ajustar luego en Inventario.
            </p>
            <div class="space-y-2">
              @for (b of visibleBranches(); track b.id) {
                <div class="flex items-center justify-between gap-3 p-3 rounded-lg border transition"
                     [ngClass]="isBranchSel(b.id) ? 'border-violet-300 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5'">
                  <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <input type="checkbox" [checked]="isBranchSel(b.id)" (change)="toggleBranchSel(b.id)"
                           [disabled]="lockedBranchId() === b.id" class="w-4 h-4 accent-violet-500 shrink-0" />
                    <div class="min-w-0">
                      <p class="font-semibold text-sm text-ink-950 dark:text-white truncate">{{ b.name }}@if (lockedBranchId() === b.id) { <span class="text-[10px] text-violet-600 dark:text-violet-300 ml-1">(tu sucursal)</span> }</p>
                      <p class="text-xs text-slate-500">{{ b.city }}</p>
                    </div>
                  </label>
                  @if (isBranchSel(b.id)) {
                    <input type="number" min="0" [ngModel]="branchStock[b.id] || 0"
                           (ngModelChange)="branchStock[b.id] = +$event" [name]="'stock_' + b.id"
                           class="w-24 px-3 py-2 rounded-lg bg-white dark:bg-ink-950 border border-slate-200 dark:border-white/10 text-sm text-right focus:outline-none focus:border-slate-400" />
                  } @else {
                    <span class="text-xs text-slate-400 shrink-0">No incluir</span>
                  }
                </div>
              }
            </div>
          </div>
        }

      </div>

      <!-- COL lateral -->
      <div class="space-y-4">
        <div class="card p-6 space-y-4 lg:sticky lg:top-4">
          <h2 class="font-bold tracking-tight">Publicación</h2>

          <div>
            <label class="eg-label">Estado</label>
            <select [(ngModel)]="payload.status" name="status"
                    class="eg-input">
              <option value="DRAFT">Borrador</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="PAUSED">Pausado</option>
              <option value="ARCHIVED">Archivado</option>
            </select>
          </div>

          <div>
            <label class="eg-label">Etiqueta</label>
            <select [(ngModel)]="payload.tag" name="tag"
                    class="eg-input">
              <option value="">— Ninguna —</option>
              <option value="NEW">Nuevo</option>
              <option value="DROP">Drop</option>
              <option value="SALE">Oferta</option>
              <option value="EXCLUSIVE">Exclusivo</option>
            </select>
          </div>

          <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition bg-violet-50 hover:bg-violet-100 border-violet-100 dark:bg-violet-500/10 dark:hover:bg-violet-500/20 dark:border-violet-500/25">
            <input type="checkbox" [(ngModel)]="payload.is_featured" name="is_featured" class="w-4 h-4 accent-violet-500" />
            <div class="flex-1">
              <p class="text-sm font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-star text-violet-500 text-xs"></i> Destacado
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Aparece en home / landing</p>
            </div>
          </label>
        </div>

        <div class="card p-6 space-y-4">
          <h2 class="font-bold tracking-tight">Organización</h2>

          <div>
            <label class="eg-label">Marca *</label>
            <select [(ngModel)]="payload.brand" name="brand" required
                    class="eg-input" [class.!border-rose-400]="fe('brand')">
              <option [ngValue]="null">— Seleccionar —</option>
              @for (b of brands(); track b.id) { <option [ngValue]="b.id">{{ b.name }}</option> }
            </select>
            @if (fe('brand')) { <p class="text-xs text-rose-600 mt-1">{{ fe('brand') }}</p> }
          </div>

          <div>
            <label class="eg-label">Categoría *</label>
            <select [(ngModel)]="payload.category" name="category" required
                    class="eg-input" [class.!border-rose-400]="fe('category')">
              <option [ngValue]="null">— Seleccionar —</option>
              @for (c of categories(); track c.id) {
                <option [ngValue]="c.id">{{ c.parent_name ? c.parent_name + ' → ' : '' }}{{ c.name }}</option>
              }
            </select>
            @if (fe('category')) { <p class="text-xs text-rose-600 mt-1">{{ fe('category') }}</p> }
          </div>
        </div>

        <div class="card p-6 space-y-4">
          <h2 class="font-bold tracking-tight">Precio</h2>
          <div>
            <label class="eg-label">Precio base (sin IVA) *</label>
            <dlx-price-input [(ngModel)]="payload.base_price" name="base_price" />
            @if (fe('base_price')) { <p class="text-xs text-rose-600 mt-1">{{ fe('base_price') }}</p> }
            @if ((+payload.base_price || 0) > 0) {
              <p class="text-[11px] text-slate-400 mt-1">Con IVA ({{ ivaRate() }}%): <b class="text-[#1e40af] dark:text-[#7aa2ff]">$ {{ priceWithIva() | number:'1.2-2' }}</b></p>
            }
          </div>
        </div>

        @if (error()) {
          <div class="card p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <i class="fa-solid fa-circle-exclamation"></i> {{ error() }}
          </div>
        }

        <div class="flex flex-col gap-2">
          <button type="submit" [disabled]="!f.valid || saving()"
                  class="px-5 py-3 rounded-lg bg-ink-950 text-white text-sm font-semibold
                         hover:bg-ink-900 disabled:opacity-50 transition flex items-center justify-center gap-2">
            @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
            @else { <i class="fa-solid fa-floppy-disk"></i> {{ isEdit() ? 'Guardar cambios' : 'Crear producto' }} }
          </button>
          <a routerLink="/app/admin/products" class="px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-center transition">
            Cancelar
          </a>
        </div>
      </div>
    </form>
  `,
})
export class ProductFormComponent implements OnInit {
  private svc = inject(ProductService);
  private brandSvc = inject(BrandService);
  private catSvc = inject(CategoryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notify = inject(NotifyService);
  private adminSvc = inject(AdminService);
  private fileValidator = inject(FileValidatorService);
  private branding = inject(BrandingService);
  ivaRate(): number { return this.branding.taxRate(); }
  priceWithIva(): number { const b = +this.payload.base_price || 0; return b + b * this.ivaRate() / 100; }
  private auth = inject(AuthService);
  branches = signal<AdminBranch[]>([]);
  branchStock: Record<number, number> = {};
  branchSel: Record<number, boolean> = {};
  isSingleBranchUser(): boolean {
    const r = this.auth.user()?.role;
    return (r === 'BRANCH_MANAGER' || r === 'SALESPERSON') && !!this.auth.user()?.branch_id;
  }
  lockedBranchId(): number | null { return this.isSingleBranchUser() ? (this.auth.user()?.branch_id ?? null) : null; }
  visibleBranches(): AdminBranch[] {
    const lb = this.lockedBranchId();
    return lb != null ? this.branches().filter(b => b.id === lb) : this.branches();
  }
  isBranchSel(id: number): boolean { return this.lockedBranchId() === id || !!this.branchSel[id]; }
  toggleBranchSel(id: number): void {
    if (this.lockedBranchId() === id) return;
    this.branchSel[id] = !this.branchSel[id];
    if (!this.branchSel[id]) delete this.branchStock[id];
  }

  brands = signal<Brand[]>([]);
  categories = signal<Category[]>([]);
  images = signal<ProductImage[]>([]);
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string | undefined { return this.fieldErrors()[k]; }
  productId = signal<number | null>(null);
  isEdit = computed(() => this.productId() !== null);

  newImgUrl = '';

  uploading = signal(false);
  dragOver = signal(false);

  sizes = signal<string[]>([]);
  colors = signal<string[]>([]);
  newSize = '';
  newColor = '';
  readonly colorPresets = ['Negro', 'Blanco', 'Gris', 'Azul', 'Celeste', 'Rojo', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Café', 'Beige'];
  variantCount = computed(() => (this.sizes().length || 1) * (this.colors().length || 1));

  payload: ProductPayload = {
    name: '', slug: '', short_description: '', description: '',
    brand: null as any, category: null as any,
    base_price: 0, compare_at_price: null,
    gender: 'UNISEX', status: 'DRAFT', tag: '',
    is_featured: false,
    main_image_url: '', meta_title: '', meta_description: '',
  };

  ngOnInit(): void {
    this.brandSvc.list({ search: '' }).subscribe(r => this.brands.set(r.results || []));
    this.catSvc.list().subscribe(r => this.categories.set(r.results || []));
    this.adminSvc.listBranches().subscribe(r => {
      this.branches.set(r.results || []);
      const lb = this.lockedBranchId();
      if (lb != null) this.branchSel[lb] = true;
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.productId.set(+id);
      this.svc.get(+id).subscribe(p => {
        this.payload = {
          name: p.name, slug: p.slug,
          short_description: p.short_description, description: p.description,
          brand: p.brand, category: p.category,
          base_price: p.base_price, compare_at_price: p.compare_at_price,
          gender: p.gender, status: p.status, tag: p.tag,
          is_featured: p.is_featured,
          main_image_url: p.main_image_url,
          meta_title: p.meta_title, meta_description: p.meta_description,
        };
        this.images.set(p.images || []);
        const vs = p.variants_detail || [];
        this.sizes.set([...new Set(vs.map(v => v.size).filter(Boolean))]);
        this.colors.set([...new Set(vs.map(v => v.color).filter(Boolean))]);
      });
    }
  }

  addImg() {
    if (!this.newImgUrl) return;
    const list = [...this.images()];
    list.push({
      url: this.newImgUrl,
      alt: this.payload.name || 'producto',
      sort_order: list.length,
      is_main: list.length === 0,
    });
    this.images.set(list);
    this.newImgUrl = '';
  }

  onDragOver(ev: DragEvent) { ev.preventDefault(); this.dragOver.set(true); }
  onDragLeave(ev: DragEvent) { ev.preventDefault(); this.dragOver.set(false); }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragOver.set(false);
    const files = ev.dataTransfer?.files;
    if (files?.length) this.uploadFiles(Array.from(files));
  }
  onFilePick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (input.files?.length) this.uploadFiles(Array.from(input.files));
    input.value = '';
  }
  private uploadFiles(files: File[]) {
    let imgs = files.filter(f => f.type.startsWith('image/'));
    // Valida tamaño/tipo con la config del superadmin antes de subir.
    imgs = imgs.filter(f => {
      const r = this.fileValidator.validate(f, 'image');
      if (!r.ok) this.notify.warning('Imagen no válida', { description: `${f.name}: ${r.reason}` });
      return r.ok;
    });
    if (!imgs.length) return;
    this.uploading.set(true);
    this.error.set(null);
    let pending = imgs.length;
    for (const file of imgs) {
      this.svc.uploadImage(file).subscribe({
        next: r => {
          const list = [...this.images()];
          list.push({ url: r.url, thumb_url: r.thumb_url, alt: this.payload.name || 'producto', sort_order: list.length, is_main: list.length === 0 });
          this.images.set(list);
          if (--pending === 0) this.uploading.set(false);
        },
        error: e => { this.error.set(parseApiError(e).message || 'No se pudo subir una imagen.'); if (--pending === 0) this.uploading.set(false); },
      });
    }
  }

  addSize() { const v = this.newSize.trim(); if (v && !this.sizes().includes(v)) this.sizes.update(a => [...a, v]); this.newSize = ''; }
  removeSize(s: string) { this.sizes.update(a => a.filter(x => x !== s)); }
  addColor() { this.addColorValue(this.newColor); this.newColor = ''; }
  addColorValue(v: string) { const c = (v || '').trim(); if (c && !this.colors().includes(c)) this.colors.update(a => [...a, c]); }
  removeColor(c: string) { this.colors.update(a => a.filter(x => x !== c)); }
  addPreset(kind: 'shoe' | 'cloth' | 'unica' | 'shoeKids' | 'clothKids') {
    const map: Record<string, string[]> = {
      shoe: ['38','39','40','41','42','43','44'],
      cloth: ['S','M','L','XL'],
      shoeKids: ['18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34'],
      clothKids: ['2','4','6','8','10','12','14','16'],
      unica: ['UNICA'],
    };
    this.sizes.update(a => Array.from(new Set([...a, ...(map[kind] || [])])));
  }
  private buildVariants(): { size: string; color: string }[] {
    const sizes = this.sizes().length ? this.sizes() : ['UNICA'];
    const colors = this.colors().length ? this.colors() : ['Estándar'];
    const out: { size: string; color: string }[] = [];
    for (const s of sizes) for (const c of colors) out.push({ size: s, color: c });
    return out;
  }

  removeImg(i: number) {
    const list = [...this.images()];
    const wasMain = list[i].is_main;
    list.splice(i, 1);
    if (wasMain && list.length > 0) list[0].is_main = true;
    list.forEach((x, idx) => x.sort_order = idx);
    this.images.set(list);
  }

  setMain(i: number) {
    const list = this.images().map((x, idx) => ({ ...x, is_main: idx === i }));
    this.images.set(list);
  }

  moveUp(i: number) {
    if (i === 0) return;
    const list = [...this.images()];
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    list.forEach((x, idx) => x.sort_order = idx);
    this.images.set(list);
  }
  moveDown(i: number) {
    const list = [...this.images()];
    if (i === list.length - 1) return;
    [list[i], list[i + 1]] = [list[i + 1], list[i]];
    list.forEach((x, idx) => x.sort_order = idx);
    this.images.set(list);
  }

  save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});

    // Asegurar main_image_url desde la galería
    const mainImg = this.images().find(i => i.is_main) || this.images()[0];
    if (mainImg) this.payload.main_image_url = mainImg.url;

    const initialStock = this.branches()
      .filter(b => this.isBranchSel(b.id))
      .map(b => ({ branch: b.id, quantity: +(this.branchStock[b.id] || 0) }));
    const body: ProductPayload = {
      ...this.payload, images: this.images(), variants: this.buildVariants(),
      initial_stock: initialStock,
    };

    const obs = this.isEdit()
      ? this.svc.update(this.productId()!, body)
      : this.svc.create(body);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(this.isEdit() ? 'Producto actualizado' : 'Producto creado');
        this.router.navigate(['/app/admin/products']);
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        this.error.set(Object.keys(p.fieldErrors).length ? null : (p.message || 'Error al guardar'));
      },
    });
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e2e8f0"/></svg>';
  }
}
