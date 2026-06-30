import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface KioskStock { branch: string; available: number; }
export interface KioskVariant {
  id: number; sku: string; barcode: string; size: string; color: string;
  price: string | number; available: number; stocks: KioskStock[];
}
export interface KioskProduct {
  found: boolean; code?: string;
  id?: number; name?: string; brand?: string; category?: string; kind?: string;
  image?: string; images?: string[]; base_price?: string | number; description?: string;
  total_available?: number; matched_variant_id?: number | null; variants?: KioskVariant[];
  current_branch_id?: number | null; current_branch_name?: string | null;
}
export interface KioskFeatured {
  id: number; name: string; brand: string; image: string;
  base_price: string | number; tag: string;
}

export interface KioskInfo {
  found: boolean; branch_id?: number; branch_name?: string; city?: string; pin_required?: boolean;
}

export interface KioskSearchItem {
  id: number; name: string; brand: string; image: string;
  base_price: string | number; total_available: number;
  branch_available?: number; in_branch?: boolean; other_branches?: string[];
}

@Injectable({ providedIn: 'root' })
export class KioskService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/kiosk`;

  product(opts: { code?: string; id?: number; token?: string }): Observable<KioskProduct> {
    let p = new HttpParams();
    if (opts.code) p = p.set('code', opts.code);
    if (opts.id) p = p.set('id', String(opts.id));
    if (opts.token) p = p.set('token', opts.token);
    return this.http.get<KioskProduct>(`${this.base}/product/`, { params: p });
  }

  search(q: string, token?: string): Observable<{ results: KioskSearchItem[] }> {
    let p = new HttpParams().set('q', q);
    if (token) p = p.set('token', token);
    return this.http.get<{ results: KioskSearchItem[] }>(`${this.base}/search/`, { params: p });
  }

  info(token: string): Observable<KioskInfo> {
    return this.http.get<KioskInfo>(`${this.base}/info/`, { params: new HttpParams().set('token', token) });
  }

  unlock(token: string, pin: string): Observable<{ ok: boolean; branch_name: string }> {
    return this.http.post<{ ok: boolean; branch_name: string }>(`${this.base}/unlock/`, { token, pin });
  }

  featured(): Observable<{ results: KioskFeatured[] }> {
    return this.http.get<{ results: KioskFeatured[] }>(`${this.base}/featured/`);
  }
}
