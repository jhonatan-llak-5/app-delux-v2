import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CheckoutItemInput {
  variant_id: number;
  quantity: number;
}

export interface CheckoutInitPayload {
  branch_id: number;
  fulfillment?: 'SHIPPING' | 'PICKUP';
  customer_data: {
    full_name: string;
    email: string;
    phone?: string;
    document_id?: string;
  };
  items: CheckoutItemInput[];
  discount?: number;
  coupon_code?: string;
  affiliate_ref?: string;
  return_url: string;
  notes?: string;
  shipping_address?: { address: string; latitude: number | null; longitude: number | null };
}

export interface CheckoutInitResponse {
  order_id: number;
  order_code: string;
  order_total: string;
  payment_url?: string;
  reference?: string;
  payment_id?: number;
  sandbox?: boolean;
  tracking_code?: string | null;
  error?: string;
}

export interface CheckoutConfirmResponse {
  detail: string;
  order_code: string;
  order_status: string;
  payment_status: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin`;

  initPayPhone(payload: CheckoutInitPayload): Observable<CheckoutInitResponse> {
    return this.http.post<CheckoutInitResponse>(`${this.base}/checkout/payphone/init/`, payload);
  }

  /** Crea el pedido con pago contra entrega (sin pasarela). */
  placeCOD(payload: Omit<CheckoutInitPayload, 'return_url'>): Observable<CheckoutInitResponse> {
    return this.http.post<CheckoutInitResponse>(`${this.base}/checkout/cod/`, payload);
  }

  confirmPayPhone(payment_id: number, success: boolean, raw?: any): Observable<CheckoutConfirmResponse> {
    return this.http.post<CheckoutConfirmResponse>(`${this.base}/checkout/payphone/confirm/`, {
      payment_id, success, raw,
    });
  }
}
