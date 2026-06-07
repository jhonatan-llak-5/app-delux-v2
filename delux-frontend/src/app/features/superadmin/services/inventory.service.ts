import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Stock {
  id: number;
  variant: number;
  variant_sku: string;
  variant_size: string;
  variant_color: string;
  product_id: number;
  product_name: string;
  product_main_image: string;
  brand_name: string;
  category_name: string;
  branch: number;
  branch_name: string;
  branch_code: string;
  base_price: string;
  price_override: string | null;
  quantity: number;
  reserved: number;
  min_threshold: number;
  available: number;
  is_low: boolean;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  stock_id: number;
  variant_sku: string;
  product_name: string;
  branch_name: string;
  type: string;
  type_label: string;
  quantity: number;
  note: string;
  actor: number | null;
  actor_name: string | null;
  created_at: string;
}

export interface InventorySummary {
  total_units: number;
  variants_count: number;
  products_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  by_branch: Array<{
    branch_id: number;
    branch__name: string;
    branch__code: string;
    units: number;
    variants: number;
    low: number;
  }>;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/inventory`;

  stocks(params: {
    search?: string; branch?: number; product?: number;
    brand?: number; category?: number;
    low_stock?: boolean; out_of_stock?: boolean;
  } = {}): Observable<Paged<Stock>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== false) {
        p = p.set(k, String(v));
      }
    });
    return this.http.get<Paged<Stock>>(`${this.base}/stocks/`, { params: p });
  }

  summary(branch?: number): Observable<InventorySummary> {
    let p = new HttpParams();
    if (branch) p = p.set('branch', String(branch));
    return this.http.get<InventorySummary>(`${this.base}/stocks/summary/`, { params: p });
  }

  adjust(stockId: number, delta: number, note = '', type: 'IN' | 'OUT' | 'ADJ' = 'ADJ') {
    return this.http.post<{ detail: string; quantity: number }>(
      `${this.base}/stocks/${stockId}/adjust/`,
      { delta, note, type }
    );
  }

  transfer(payload: { variant_id: number; from_branch_id: number; to_branch_id: number; quantity: number; note?: string }) {
    return this.http.post<{ detail: string; from_qty: number; to_qty: number }>(
      `${this.base}/stocks/transfer/`, payload
    );
  }

  movements(params: { branch?: number; product?: number; type?: string } = {}): Observable<Paged<StockMovement>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<Paged<StockMovement>>(`${this.base}/movements/`, { params: p });
  }
}
