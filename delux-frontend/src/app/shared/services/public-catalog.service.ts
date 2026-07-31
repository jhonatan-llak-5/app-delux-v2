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
  branch_stock?: number | null;
  available_in_city?: boolean;
  in_stock?: boolean;
  total_stock?: number;
  sizes?: string[];
  colors?: string[];
  out_of_stock_display?: 'SHOW' | 'HIDE' | 'SOLD_OUT';
  thumb_url?: string | null;
  branches?: { id: number; name: string; province: string; stock: number }[];
}

export interface PublicProductColor { name: string; hex: string; image: string; }
export interface PublicProductDetail {
  id: number; name: string; slug: string;
  brand_name: string; category_name: string; category_slug: string;
  base_price: string; compare_at_price: string | null;
  gender: string; tag: string;
  short_description: string; description: string;
  main_image_url: string; images: string[];
  sizes: string[]; colors: PublicProductColor[];
  variants: { id: number; size: string; color: string; stock_by_branch?: Record<string, number>; total_stock?: number }[];
  rating: number; reviews_count: number;
  in_stock?: boolean;
  out_of_stock_display?: 'SHOW' | 'HIDE' | 'SOLD_OUT';
  branches?: { id: number; name: string; province: string; stock: number }[];
  branch_names?: Record<string, string>;
}

export interface PublicCategory { id: number; name: string; slug: string; parent_id: number | null; }
export interface PublicBrand    { id: number; name: string; slug: string; }

export interface FacetCategory { slug: string; name: string; count: number; }
export interface FacetBrand    { id: number; name: string; count: number; }
export interface FacetGender   { value: 'MEN' | 'WOMEN' | 'UNISEX' | 'KIDS'; label: string; count: number; }
export interface ProductFacets {
  min_price: number;
  max_price: number;
  categories: FacetCategory[];
  brands: FacetBrand[];
  sizes: string[];
  genders: FacetGender[];
}

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listProducts(params: {
    q?: string; brand?: string; category?: string; gender?: string;
    sort?: 'new' | 'featured' | 'price-asc' | 'price-desc';
    price_min?: number; price_max?: number; size?: string; color?: string;
    city?: string; province?: string; branch?: number;
    page?: number; page_size?: number;
  } = {}): Observable<{ count: number; results: PublicProduct[] }> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<{ count: number; results: PublicProduct[] }>(
      `${this.base}/products/`, { params: p }
    );
  }

  facets(params: { province?: string } = {}): Observable<ProductFacets> {
    let p = new HttpParams();
    if (params.province) p = p.set('province', params.province);
    return this.http.get<ProductFacets>(`${this.base}/products/facets/`, { params: p });
  }

  getProduct(id: number | string): Observable<PublicProductDetail> {
    return this.http.get<PublicProductDetail>(`${this.base}/products/${id}/`);
  }
}
