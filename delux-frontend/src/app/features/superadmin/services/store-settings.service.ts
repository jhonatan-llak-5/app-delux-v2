import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

export interface StorePayments {
  transfer_enabled: boolean;
  bank_name: string;
  bank_account_type: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_account_document: string;
  bank_contact_email: string;
  bank_contact_whatsapp: string;
  transfer_instructions: string;
  deuna_enabled: boolean;
  deuna_instructions: string;
  deuna_qr_url: string;
}

export interface StoreOptions {
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  out_of_stock_display: 'SHOW' | 'HIDE' | 'SOLD_OUT';
  consumidor_final_enabled: boolean;
  einvoice_enabled?: boolean;
  einvoice_consumidor_final_max?: number;
  // Datos del negocio (emisor) para el comprobante de venta impreso.
  business_legal_name?: string;
  business_ruc?: string;
  business_address?: string;
  business_phone?: string;
}

/**
 * Ajustes de tienda accesibles por Admin y Gerente (no requieren superadmin).
 * IVA por defecto y datos de pago (banco + QR DeUna).
 */
@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/settings`;

  getTax() {
    return this.http.get<{ tax_rate: number }>(`${this.base}/tax/`);
  }
  setTax(tax_rate: number) {
    return this.http.patch<{ tax_rate: number }>(`${this.base}/tax/`, { tax_rate });
  }

  getPayments() {
    return this.http.get<StorePayments>(`${this.base}/payments/`);
  }
  savePayments(body: Partial<StorePayments> | FormData) {
    return this.http.patch<StorePayments>(`${this.base}/payments/`, body);
  }

  getStoreOptions() {
    return this.http.get<StoreOptions>(`${this.base}/store/`);
  }
  saveStoreOptions(body: Partial<StoreOptions>) {
    return this.http.patch<StoreOptions>(`${this.base}/store/`, body);
  }
}
