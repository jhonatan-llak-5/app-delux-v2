import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

export interface Payment {
  id: number;
  order: number;
  order_code: string;
  method: string;
  method_label: string;
  status: string;
  status_label: string;
  amount: string;
  external_id: string;
  voucher_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleChangeLineMini {
  direction: 'RETURN' | 'DELIVER';
  order_item: number | null;
  product_name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface SaleChangeMini {
  id: number;
  code: string;
  product_name: string;
  quantity: number;
  valor_devuelto: string;
  tipo: string;
  tipo_label: string;
  descripcion: string;
  created_at: string;
  returned_value: string;
  delivered_value: string;
  difference: string;
  annulled: boolean;
  returned_items: SaleChangeLineMini[];
  delivered_items: SaleChangeLineMini[];
}

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
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_document?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
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
  payment_form?: string;   // código SRI (01 efectivo, 16 débito, 19 crédito, 20 transferencia)
  coupon_code: string;
  notes: string;
  invoice_status?: 'NOT_ISSUED' | 'PROCESSING' | 'PENDING_SRI' | 'AUTHORIZED' | 'REJECTED' | 'ANNULLED' | 'ERROR';
  invoice_number?: string;
  invoice_access_key?: string;
  invoice_authorization?: string;
  invoice_pdf_url?: string;
  invoice_xml_url?: string;
  invoice_message?: string;
  invoice_error?: string;
  invoice_updated_at?: string | null;
  items: OrderItem[];
  items_count: number;
  total_changes?: string;
  net_total?: string;
  changes?: SaleChangeMini[];
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
  customer_data?: {
    full_name?: string; email?: string; phone?: string; document_id?: string;
    document_type?: string; business_name?: string; address?: string; province?: string;
  };
  discount?: number;
  notes?: string;
  seller_id?: number | null;
  payment_form?: string;
  payment_plazo?: number;
  payment_unidad?: string;
  want_invoice?: boolean;
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

  list(params: { search?: string; branch?: number; status?: string; channel?: string; mine?: boolean; date_from?: string; date_to?: string; page?: number; page_size?: number } = {}): Observable<Paged<Order>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<Paged<Order>>(`${this.base}/`, { params: p });
  }

  get(id: number) { return this.http.get<Order>(`${this.base}/${id}/`); }
  summary() { return this.http.get<OrderSummary>(`${this.base}/summary/`); }

  setStatus(id: number, status: string, notes?: string): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/set-status/`, { status, notes });
  }

  /** Edita SOLO la forma de pago (ajuste interno; no altera una factura ya emitida en SRI). */
  setPaymentForm(id: number, payment_form: string): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/set-payment-form/`, { payment_form });
  }

  cancel(id: number, reason: string, restoreStock: boolean) {
    return this.http.post<{ detail: string; restored_stock: boolean }>(
      `${this.base}/${id}/cancel/`, { reason, restore_stock: restoreStock });
  }

  /** Registra un CAMBIO producto-por-producto: el cliente devuelve ítems y se
   * lleva otros a cambio. Devuelto vuelve al stock, entregado sale del stock. */
  registerChange(id: number, body: {
    returned: { order_item_id: number; quantity: number }[];
    delivered: { variant_id?: number; manual?: boolean; name?: string; price?: number; quantity: number }[];
    descripcion: string;
    change_date?: string;
    /** true = devolución de dinero: no se entrega nada a cambio. */
    refund_money?: boolean;
    /** Cómo se movió el dinero de la diferencia (solo CASH toca la caja). */
    payment_method?: 'CASH' | 'CARD' | 'TRANSFER';
  }): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/register-change/`, body);
  }

  /** Reintenta la emisión de la factura electrónica de la venta. */
  retryInvoice(id: number): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/retry-invoice/`, {});
  }

  /** Emite (por primera vez) la factura electrónica de una venta con los datos del cliente. */
  emitInvoice(id: number, body: {
    customer_data: { identification: string; document_type?: string; name: string; email?: string; address?: string; phone?: string };
    payment_form?: string;
    payment_plazo?: number;
    payment_unidad?: string;
  }): Observable<Order> {
    return this.http.post<Order>(`${this.base}/${id}/emit-invoice/`, body);
  }

  /** Descarga el RIDE (pdf) o XML de la factura vía proxy autenticado de DLUX. */
  invoiceFile(id: number, kind: 'pdf' | 'xml'): Observable<Blob> {
    const p = new HttpParams().set('kind', kind);
    return this.http.get(`${this.base}/${id}/invoice-file/`, { params: p, responseType: 'blob' });
  }

  posCheckout(payload: POSPayload): Observable<Order> {
    return this.http.post<Order>(`${this.base}/pos-checkout/`, payload);
  }

  // ── Pagos (comprobantes de transferencia / DE UNA) ──
  private paymentsBase = `${environment.apiUrl}/admin/payments`;

  payments(orderId: number): Observable<Payment[]> {
    const p = new HttpParams().set('order', String(orderId));
    return this.http.get<any>(`${this.paymentsBase}/`, { params: p })
      .pipe(map(r => Array.isArray(r) ? r : (r.results || [])));
  }
  confirmPayment(id: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.paymentsBase}/${id}/confirm/`, {});
  }
  rejectPayment(id: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.paymentsBase}/${id}/reject/`, {});
  }
}
