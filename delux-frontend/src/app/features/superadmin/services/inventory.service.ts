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

export interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  tax_id: string;
  notes: string;
  is_active: boolean;
}

export interface ScanResult {
  found: boolean;
  code?: string;
  branch_qty?: number;
  variant?: {
    id: number; sku: string; barcode: string; size: string; color: string;
    cost: string | number; price_override: string | number | null;
    product_id: number; product_name: string; kind: string;
    base_price: string | number;
    brand_id: number; brand_name: string;
    category_id: number; category_name: string;
    images?: string[];
  };
}

export interface ReceptionItemIn {
  variant_id?: number;
  product_id?: number;
  quantity: number;
  unit_cost?: number;
  barcode?: string;
  product_name?: string;
  kind?: string;
  brand_id?: number; brand_name?: string;
  category_id?: number; category_name?: string;
  color?: string; size?: string; price?: number;
  branch?: number;
  images?: string[];
  description?: string;
}

export interface ReceptionResult {
  id: number;
  code: string;
  supplier_name: string | null;
  branch_name: string;
  total_units: number;
  items_count?: number;
  note?: string;
  status?: string;
  created_by_name?: string | null;
  committed_at?: string | null;
  created_at?: string;
  items: Array<{
    id: number; variant: number; variant_sku: string; barcode: string;
    product_name: string; kind: string; size: string; color: string;
    quantity: number; unit_cost: string; price: string | number;
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
  // ── Recepción de mercadería ──
  scan(code: string, branch?: number): Observable<ScanResult> {
    let p = new HttpParams().set('code', code);
    if (branch) p = p.set('branch', String(branch));
    return this.http.get<ScanResult>(`${this.base}/stocks/scan/`, { params: p });
  }

  variantSearch(q: string): Observable<{ results: NonNullable<ScanResult['variant']>[] }> {
    return this.http.get<{ results: NonNullable<ScanResult['variant']>[] }>(
      `${this.base}/stocks/variant-search/`, { params: new HttpParams().set('q', q) });
  }

  listSuppliers(search = ''): Observable<Paged<Supplier>> {
    let p = new HttpParams();
    if (search) p = p.set('search', search);
    return this.http.get<Paged<Supplier>>(`${this.base}/suppliers/`, { params: p });
  }

  createSupplier(payload: Partial<Supplier>): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.base}/suppliers/`, payload);
  }

  updateSupplier(id: number, payload: Partial<Supplier>): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.base}/suppliers/${id}/`, payload);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/suppliers/${id}/`);
  }

  createReception(payload: {
    branch: number; supplier?: number | null; supplier_name?: string;
    note?: string; items: ReceptionItemIn[];
  }): Observable<ReceptionResult> {
    return this.http.post<ReceptionResult>(`${this.base}/receptions/`, payload);
  }

  listReceptions(): Observable<Paged<ReceptionResult>> {
    return this.http.get<Paged<ReceptionResult>>(`${this.base}/receptions/`);
  }
}
