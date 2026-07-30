import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface CheckoutItemInput {
  variant_id: number;
  quantity: number;
  branch_id?: number;
}

export interface CheckoutInitPayload {
  branch_id?: number;
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

/** Un sub-pedido dentro de una compra (una sucursal = un pedido). */
export interface CheckoutOrderResult {
  order_id: number;
  order_code: string;
  order_total: string;
  order_status: string;
  branch_id: number;
  branch_name: string;
  tracking_code?: string;
}

/**
 * Respuesta multi-sucursal de checkout: la compra puede generar 1..N pedidos
 * (uno por sucursal). `group_code` viene vacío cuando es una sola sucursal.
 * Los campos de pasarela (payment_url/payment_id) solo aplican a PayPhone.
 */
export interface CheckoutInitResponse {
  group_code: string;
  method: string;
  orders: CheckoutOrderResult[];
  // Compatibilidad con pasarela (PayPhone):
  payment_url?: string;
  reference?: string;
  payment_id?: number;
  sandbox?: boolean;
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

  /**
   * Crea el pedido con pago por Transferencia o DE UNA. El comprobante
   * (voucher) es OBLIGATORIO. Se envía como multipart: payload JSON + archivo.
   */
  placeTransfer(
    payload: Omit<CheckoutInitPayload, 'return_url'> & { method: 'TRANSFER' | 'DEUNA' },
    voucher: File,
  ): Observable<CheckoutInitResponse> {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    form.append('voucher', voucher);
    return this.http.post<CheckoutInitResponse>(`${this.base}/checkout/transfer/`, form);
  }

  confirmPayPhone(payment_id: number, success: boolean, raw?: any): Observable<CheckoutConfirmResponse> {
    return this.http.post<CheckoutConfirmResponse>(`${this.base}/checkout/payphone/confirm/`, {
      payment_id, success, raw,
    });
  }
}
