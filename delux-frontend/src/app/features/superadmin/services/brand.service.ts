import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  logo_dark_url: string;
  description: string;
  country_of_origin: string;
  website: string;
  founded_year: number | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  products_count: number;
  active_products_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface BrandPayload {
  name: string;
  slug?: string;
  logo_url?: string;
  logo_dark_url?: string;
  description?: string;
  country_of_origin?: string;
  website?: string;
  founded_year?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

interface Paged<T> {
  count: number;
  pages: number;
  page: number;
  next: string | null;
  prev: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class BrandService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/brands`;

  list(opts: {
    search?: string;
    ordering?: string;
    is_active?: boolean;
    is_featured?: boolean;
  } = {}): Observable<Paged<Brand>> {
    let p = new HttpParams();
    if (opts.search)     p = p.set('search', opts.search);
    if (opts.ordering)   p = p.set('ordering', opts.ordering);
    if (opts.is_active !== undefined)   p = p.set('is_active', String(opts.is_active));
    if (opts.is_featured !== undefined) p = p.set('is_featured', String(opts.is_featured));
    return this.http.get<Paged<Brand>>(`${this.base}/`, { params: p });
  }

  get(slug: string)                    { return this.http.get<Brand>(`${this.base}/${slug}/`); }
  create(p: BrandPayload)              { return this.http.post<Brand>(`${this.base}/`, p); }
  update(slug: string, p: BrandPayload) { return this.http.patch<Brand>(`${this.base}/${slug}/`, p); }
  remove(slug: string)                 { return this.http.delete(`${this.base}/${slug}/`); }
  toggleActive(slug: string)           { return this.http.post<{is_active: boolean}>(`${this.base}/${slug}/toggle_active/`, {}); }
  toggleFeatured(slug: string)         { return this.http.post<{is_featured: boolean}>(`${this.base}/${slug}/toggle_featured/`, {}); }
}
