import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

export interface ReturnItem {
  id: number;
  order_item: number;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  refund_amount: string;
}

export interface ReturnRequest {
  id: number;
  code: string;
  order: number;
  order_code: string;
  customer: number;
  customer_name: string;
  reason: string;
  reason_label: string;
  note: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CLOSED';
  status_label: string;
  refund_amount: string;
  admin_note: string;
  items: ReturnItem[];
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  myReturns() {
    return this.http.get<{ results: ReturnRequest[] }>(`${this.base}/me/returns/`);
  }
  request(orderId: number, reason: string, note: string, items: { order_item_id: number; quantity: number }[]) {
    return this.http.post<ReturnRequest>(`${this.base}/me/returns/`, {
      order_id: orderId, reason, note, items,
    });
  }
  // Admin
  list(params: { status?: string; search?: string } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<{ count: number; results: ReturnRequest[] }>(`${this.base}/admin/returns/`, { params: p });
  }
  approve(id: number, admin_note = '') { return this.http.post<ReturnRequest>(`${this.base}/admin/returns/${id}/approve/`, { admin_note }); }
  reject(id: number, admin_note = '') { return this.http.post<ReturnRequest>(`${this.base}/admin/returns/${id}/reject/`, { admin_note }); }
  refund(id: number) { return this.http.post<ReturnRequest>(`${this.base}/admin/returns/${id}/refund/`, {}); }
}
