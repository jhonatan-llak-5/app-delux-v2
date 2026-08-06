import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ProductImage {
  id?: number;
  url: string;
  thumb_url?: string;
  alt?: string;
  sort_order?: number;
  is_main?: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  brand: number;
  brand_name: string;
  category: number;
  category_name: string;
  base_price: string;
  compare_at_price: string | null;
  tax_rate?: string | null;
  discount_percent?: string | null;
  on_offer?: boolean;
  kind?: string;
  gender: 'UNISEX' | 'MEN' | 'WOMEN' | 'KIDS';
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  tag: '' | 'NEW' | 'DROP' | 'SALE' | 'EXCLUSIVE';
  is_featured: boolean;
  main_image_url: string;
  meta_title: string;
  meta_description: string;
  images: ProductImage[];
  images_count: number;
  variants_count: number;
  variants_detail?: { sku?: string; size: string; color: string; barcode?: string }[];
  total_stock: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  slug?: string;
  short_description?: string;
  description?: string;
  brand?: number | null;
  category?: number | null;
  brand_name?: string;
  category_name?: string;
  base_price: number | string;
  compare_at_price?: number | string | null;
  tax_rate?: number | string | null;
  discount_percent?: number | string | null;
  gender?: string;
  status?: string;
  tag?: string;
  is_featured?: boolean;
  main_image_url?: string;
  meta_title?: string;
  meta_description?: string;
  images?: ProductImage[];
  variants?: { size: string; color: string; barcode?: string }[];
  initial_stock?: { branch: number; quantity: number }[];
}

interface Paged<T> { count: number; results: T[]; next?: string | null; }

export interface ProductSummary {
  total: number; published: number; draft: number;
  paused: number; archived: number; featured: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/products`;

  uploadImage(file: File): Observable<{ url: string; thumb_url: string; name: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string; thumb_url: string; name: string }>(`${this.base}/upload-image/`, form);
  }

  list(params: {
    search?: string; brand?: number; category?: number;
    status?: string; tag?: string; gender?: string;
    is_featured?: boolean; branch?: number;
    page?: number; page_size?: number;
  } = {}): Observable<Paged<Product>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<Paged<Product>>(`${this.base}/`, { params: p });
  }

  summary(): Observable<ProductSummary> {
    return this.http.get<ProductSummary>(`${this.base}/summary/`);
  }

  get(id: number) { return this.http.get<Product>(`${this.base}/${id}/`); }
  create(payload: ProductPayload) { return this.http.post<Product>(`${this.base}/`, payload); }
  update(id: number, payload: Partial<ProductPayload>) { return this.http.patch<Product>(`${this.base}/${id}/`, payload); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/${id}/`); }

  /** Aplica un IVA a varios productos. tax_rate=null => vuelve al IVA global. */
  bulkTax(body: { tax_rate: number | null; product_ids?: number[]; all?: boolean }) {
    return this.http.post<{ updated: number; tax_rate: number | null }>(`${this.base}/bulk-tax/`, body);
  }

  /** Activa/desactiva varios productos. status: 'PUBLISHED' (activo) | 'PAUSED' (inactivo). */
  bulkStatus(product_ids: number[], status: string) {
    return this.http.post<{ updated: number; status: string }>(`${this.base}/bulk-status/`, { product_ids, status });
  }
  /** Elimina varios productos (borrado lógico: se ocultan pero se conservan las ventas). */
  bulkDelete(product_ids: number[]) {
    return this.http.post<{ deleted: number; skipped: number }>(`${this.base}/bulk-delete/`, { product_ids });
  }

  /** Muestra/oculta un producto del sitio web (sigue en POS y kiosko). */
  toggleOnline(id: number) {
    return this.http.post<{ detail: string; online_visible: boolean }>(`${this.base}/${id}/toggle-online/`, {});
  }
  /** Muestra/oculta varios productos del sitio web a la vez. */
  bulkOnline(product_ids: number[], online_visible: boolean) {
    return this.http.post<{ updated: number; online_visible: boolean }>(
      `${this.base}/bulk-online/`, { product_ids, online_visible });
  }

  /** ¿El código de barras ya existe en la empresa? Devuelve el producto dueño. */
  checkBarcode(code: string) {
    return this.http.get<{ exists: boolean; product_id?: number; product_name?: string; sku?: string }>(
      `${this.base}/check-barcode/`, { params: new HttpParams().set('code', code) });
  }

  /** Agrega variantes NUEVAS a un producto existente (no toca las actuales). */
  addVariants(id: number, body: { branch?: number | null; supplier_name?: string; note?: string; variants: Array<{
    size?: string; color?: string; attributes?: Record<string, string>;
    cost?: number; price?: number; quantity?: number;
  }> }) {
    return this.http.post<{ created: number }>(`${this.base}/${id}/add-variants/`, body);
  }

  toggleFeatured(id: number) {
    return this.http.post<{ is_featured: boolean }>(`${this.base}/${id}/toggle_featured/`, {});
  }
  publish(id: number) {
    return this.http.post<{ status: string }>(`${this.base}/${id}/publish/`, {});
  }
  archive(id: number) {
    return this.http.post<{ status: string }>(`${this.base}/${id}/archive/`, {});
  }
}
