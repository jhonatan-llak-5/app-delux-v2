import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface PublicProduct {
  id: number;
  name: string;
  slug: string;
  brand_id: number;
  brand_name: string;
  category_id: number;
  category_name: string;
  base_price: string;
  compare_at_price?: string | null;
  gender: string;
  tag: string;
  main_image_url: string;
  is_featured: boolean;
}

export interface PublicCategory { id: number; name: string; slug: string; parent_id: number | null; }
export interface PublicBrand    { id: number; name: string; slug: string; }

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listProducts(params: {
    q?: string; brand?: string; category?: string; gender?: string;
    sort?: 'new' | 'featured' | 'price-asc' | 'price-desc';
    price_min?: number; price_max?: number; size?: string; color?: string;
  } = {}): Observable<{ count: number; results: PublicProduct[] }> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<{ count: number; results: PublicProduct[] }>(
      `${this.base}/products/`, { params: p }
    );
  }

  facets(): Observable<{
    min_price: number; max_price: number;
    brands: PublicBrand[]; categories: PublicCategory[];
  }> {
    return this.http.get<any>(`${this.base}/products/facets/`);
  }
}
