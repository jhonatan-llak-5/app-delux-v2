import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ImgFallbackDirective } from '@shared/ui/img-fallback.directive';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
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
  imports: [ImgFallbackDirective, DlxFieldErrorComponent, CommonModule, FormsModule, RouterLink, DlxPriceInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html',
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
  ivaRate(): number { const r = this.payload.tax_rate; return r == null || r === '' ? this.branding.taxRate() : +r; }
  globalIva(): number { return this.branding.taxRate(); }
  // base_price ES el precio final (IVA incluido); derivamos el neto y el IVA contenido.
  netPrice(): number { const b = +this.payload.base_price || 0; const r = this.ivaRate(); return r ? b / (1 + r / 100) : b; }
  ivaAmount(): number { return (+this.payload.base_price || 0) - this.netPrice(); }
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
  mode = signal<'basic' | 'variants'>('basic');
  setVariantMode(m: 'basic' | 'variants'): void {
    this.mode.set(m);
    if (m === 'basic') { this.sizes.set([]); this.colors.set([]); }
  }
  barcode = '';
  variantsDetail = signal<{ sku?: string; size: string; color: string; barcode?: string }[]>([]);
  newSize = '';
  newColor = '';
  readonly colorPresets = ['Negro', 'Blanco', 'Gris', 'Azul', 'Celeste', 'Rojo', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosa', 'Café', 'Beige'];
  variantCount = computed(() => (this.sizes().length || 1) * (this.colors().length || 1));

  payload: ProductPayload = {
    name: '', slug: '', short_description: '', description: '',
    brand: null as any, category: null as any,
    base_price: 0, compare_at_price: null, tax_rate: null,
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
          base_price: p.base_price, compare_at_price: p.compare_at_price, tax_rate: p.tax_rate ?? null,
          gender: p.gender, status: p.status, tag: p.tag,
          is_featured: p.is_featured,
          main_image_url: p.main_image_url,
          meta_title: p.meta_title, meta_description: p.meta_description,
        };
        this.images.set(p.images || []);
        const vs = p.variants_detail || [];
        this.variantsDetail.set(vs);
        this.sizes.set([...new Set(vs.map(v => v.size).filter(Boolean))]);
        this.colors.set([...new Set(vs.map(v => v.color).filter(Boolean))]);
        if (this.sizes().length || this.colors().length) this.mode.set('variants');
        // Si el producto tiene una sola variante, precarga su código de barras.
        this.barcode = (vs.length === 1 ? (vs[0].barcode || '') : '');
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
  private buildVariants(): { size: string; color: string; barcode?: string }[] {
    const sizes = this.sizes().length ? this.sizes() : ['UNICA'];
    const colors = this.colors().length ? this.colors() : ['Estándar'];
    const out: { size: string; color: string; barcode?: string }[] = [];
    for (const s of sizes) for (const c of colors) out.push({ size: s, color: c });
    // El código de barras solo aplica cuando hay una única variante.
    if (out.length === 1 && this.barcode.trim()) out[0].barcode = this.barcode.trim();
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

}
