import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface StaffUser {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  document_id: string;
  role: 'TENANT_ADMIN' | 'BRANCH_MANAGER' | 'SALESPERSON';
  role_label: string;
  tenant: number | null;
  branch: number | null;
  branch_name: string | null;
  commission_rate: string;
  hire_date: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface StaffPayload {
  email: string;
  full_name: string;
  phone?: string;
  document_id?: string;
  role: 'TENANT_ADMIN' | 'BRANCH_MANAGER' | 'SALESPERSON';
  branch: number;
  commission_rate?: number;
  hire_date?: string | null;
  password?: string;
}

export interface StaffCreated extends StaffUser {
  temp_password?: string | null;
  password_generated?: boolean;
  credentials_emailed?: boolean;
}

export interface SalesMetrics {
  total_sales: number;
  total_revenue: number;
  today_sales: number;
  today_revenue: number;
  commission_total: number;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class StaffService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/staff`;

  list(params: { search?: string; branch?: number; role?: string; is_active?: boolean } = {}): Observable<Paged<StaffUser>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v)); });
    return this.http.get<Paged<StaffUser>>(`${this.base}/`, { params: p });
  }

  get(id: number) { return this.http.get<StaffUser>(`${this.base}/${id}/`); }
  create(payload: StaffPayload) { return this.http.post<StaffCreated>(`${this.base}/`, payload); }
  update(id: number, payload: Partial<StaffPayload>) { return this.http.patch<StaffUser>(`${this.base}/${id}/`, payload); }
  delete(id: number) { return this.http.delete<void>(`${this.base}/${id}/`); }
  toggleActive(id: number) { return this.http.post<{ is_active: boolean }>(`${this.base}/${id}/toggle_active/`, {}); }
  metrics(id: number) { return this.http.get<SalesMetrics>(`${this.base}/${id}/sales_metrics/`); }
}
