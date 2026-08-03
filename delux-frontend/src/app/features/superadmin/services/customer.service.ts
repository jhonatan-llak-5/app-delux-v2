import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Address {
  id: number;
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  is_default: boolean;
}

export interface Customer {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  document_id: string;
  document_type: string;
  business_name: string;
  address: string;
  city: string;
  province: string;
  accepts_marketing: boolean;
  is_active: boolean;
  tags: string[];
  total_orders: number;
  total_spent: string | null;
  last_order_at: string | null;
  addresses: Address[];
  created_at: string;
}

export interface CustomerPayload {
  full_name: string;
  email?: string;
  phone?: string;
  document_id?: string;
  document_type?: string;
  business_name?: string;
  address?: string;
  city?: string;
  province?: string;
  accepts_marketing?: boolean;
  is_active?: boolean;
  tags?: string[];
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/customers`;

  list(params: { search?: string; page?: number; page_size?: number } = {}): Observable<Paged<Customer>> {
    let p = new HttpParams();
    if (params.search) p = p.set('search', params.search);
    return this.http.get<Paged<Customer>>(`${this.base}/`, { params: p });
  }
  get(id: number) { return this.http.get<Customer>(`${this.base}/${id}/`); }
  create(payload: CustomerPayload) { return this.http.post<Customer>(`${this.base}/`, payload); }
  update(id: number, payload: Partial<CustomerPayload>) { return this.http.patch<Customer>(`${this.base}/${id}/`, payload); }
  setActive(id: number, is_active: boolean) { return this.http.patch<Customer>(`${this.base}/${id}/`, { is_active }); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/${id}/`); }
  summary() { return this.http.get<{ total_customers: number; with_purchases: number; marketing_subscribers: number }>(`${this.base}/summary/`); }
}
