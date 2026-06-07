import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface OrderItem {
  id: number;
  variant: number;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  product_image: string;
}

export interface Order {
  id: number;
  code: string;
  branch: number;
  branch_name: string;
  customer: number | null;
  customer_name: string | null;
  seller: number | null;
  seller_name: string | null;
  channel: string;
  fulfillment: string;
  status: string;
  subtotal: string;
  discount: string;
  shipping_fee: string;
  tax: string;
  total: string;
  coupon_code: string;
  notes: string;
  items: OrderItem[];
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface POSItem {
  variant_id: number;
  quantity: number;
}

export interface POSPayload {
  branch_id: number;
  items: POSItem[];
  customer_id?: number | null;
  customer_data?: { full_name?: string; email?: string; phone?: string; document_id?: string };
  discount?: number;
  notes?: string;
}

export interface OrderSummary {
  total_orders: number;
  total_revenue: number;
  today_orders: number;
  today_revenue: number;
  pending: number;
  paid: number;
  cancelled: number;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/orders`;

  list(params: { search?: string; branch?: number; status?: string; channel?: string; date_from?: string; date_to?: string } = {}): Observable<Paged<Order>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<Paged<Order>>(`${this.base}/`, { params: p });
  }

  get(id: number) { return this.http.get<Order>(`${this.base}/${id}/`); }
  summary() { return this.http.get<OrderSummary>(`${this.base}/summary/`); }

  cancel(id: number) {
    return this.http.post<{ detail: string }>(`${this.base}/${id}/cancel/`, {});
  }

  posCheckout(payload: POSPayload): Observable<Order> {
    return this.http.post<Order>(`${this.base}/pos-checkout/`, payload);
  }
}
