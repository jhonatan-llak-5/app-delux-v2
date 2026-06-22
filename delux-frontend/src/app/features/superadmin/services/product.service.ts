import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface ProductImage {
  id?: number;
  url: string;
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
  variants_detail?: { size: string; color: string }[];
  total_stock: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  slug?: string;
  short_description?: string;
  description?: string;
  brand: number;
  category: number;
  base_price: number | string;
  compare_at_price?: number | string | null;
  gender?: string;
  status?: string;
  tag?: string;
  is_featured?: boolean;
  main_image_url?: string;
  meta_title?: string;
  meta_description?: string;
  images?: ProductImage[];
  variants?: { size: string; color: string }[];
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/products`;

  uploadImage(file: File): Observable<{ url: string; name: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string; name: string }>(`${this.base}/upload-image/`, form);
  }

  list(params: {
    search?: string; brand?: number; category?: number;
    status?: string; tag?: string; gender?: string;
    is_featured?: boolean; branch?: number;
  } = {}): Observable<Paged<Product>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<Paged<Product>>(`${this.base}/`, { params: p });
  }

  get(id: number) { return this.http.get<Product>(`${this.base}/${id}/`); }
  create(payload: ProductPayload) { return this.http.post<Product>(`${this.base}/`, payload); }
  update(id: number, payload: Partial<ProductPayload>) { return this.http.patch<Product>(`${this.base}/${id}/`, payload); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/${id}/`); }

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
