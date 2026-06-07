import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface PublicProduct {
  id: number; name: string; slug: string;
  brand_id: number; brand_name: string;
  category_id: number; category_name: string;
  base_price: string;
  compare_at_price: string | null;
  gender: string; tag: string;
  main_image_url: string;
  is_featured: boolean;
}

export interface AutocompleteResp {
  products: { id: number; name: string; brand_name: string; main_image_url: string; base_price: string }[];
  brands: { id: number; name: string; slug: string; logo_url: string }[];
  categories: { id: number; name: string; slug: string; icon: string }[];
}

export interface FacetsResp {
  min_price: number;
  max_price: number;
  brands: { id: number; name: string; slug: string }[];
  categories: { id: number; name: string; slug: string; parent_id: number | null }[];
}

export interface ProductFilters {
  q?: string;
  brand?: number[];
  category?: string[];
  gender?: string;
  price_min?: number;
  price_max?: number;
  size?: string;
  color?: string;
  sort?: 'new' | 'price-asc' | 'price-desc' | 'featured';
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  list(filters: ProductFilters = {}): Observable<{ count: number; results: PublicProduct[] }> {
    let p = new HttpParams();
    if (filters.q) p = p.set('q', filters.q);
    if (filters.brand?.length) p = p.set('brand', filters.brand.join(','));
    if (filters.category?.length) p = p.set('category', filters.category.join(','));
    if (filters.gender) p = p.set('gender', filters.gender);
    if (filters.price_min !== undefined) p = p.set('price_min', String(filters.price_min));
    if (filters.price_max !== undefined) p = p.set('price_max', String(filters.price_max));
    if (filters.size) p = p.set('size', filters.size);
    if (filters.color) p = p.set('color', filters.color);
    if (filters.sort) p = p.set('sort', filters.sort);
    return this.http.get<{ count: number; results: PublicProduct[] }>(`${this.base}/products/`, { params: p });
  }

  facets() {
    return this.http.get<FacetsResp>(`${this.base}/products/facets/`);
  }

  autocomplete(q: string) {
    return this.http.get<AutocompleteResp>(`${this.base}/search/autocomplete/`, {
      params: new HttpParams().set('q', q),
    });
  }
}
