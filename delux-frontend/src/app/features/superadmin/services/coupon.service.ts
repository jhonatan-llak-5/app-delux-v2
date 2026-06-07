import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Coupon {
  id: number;
  code: string;
  type: 'PERCENT' | 'FIXED';
  type_label: string;
  value: string;
  min_purchase: string;
  usage_limit: number | null;
  times_used: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  is_valid: boolean;
  created_at: string;
}

export interface CouponPayload {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number | string;
  min_purchase?: number | string;
  usage_limit?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export interface CouponValidation {
  valid: boolean;
  code?: string;
  type?: string;
  value?: string;
  discount?: string;
  final_total?: string;
  detail?: string;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class CouponService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/coupons`;

  list(params: { search?: string; is_active?: boolean; type?: string } = {}): Observable<Paged<Coupon>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<Paged<Coupon>>(`${this.base}/`, { params: p });
  }
  get(id: number) { return this.http.get<Coupon>(`${this.base}/${id}/`); }
  create(payload: CouponPayload) { return this.http.post<Coupon>(`${this.base}/`, payload); }
  update(id: number, payload: Partial<CouponPayload>) { return this.http.patch<Coupon>(`${this.base}/${id}/`, payload); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/${id}/`); }
  toggleActive(id: number) { return this.http.post<{ is_active: boolean }>(`${this.base}/${id}/toggle_active/`, {}); }
  validate(code: string, subtotal: number): Observable<CouponValidation> {
    return this.http.post<CouponValidation>(`${this.base}/validate/`, { code, subtotal });
  }
}
