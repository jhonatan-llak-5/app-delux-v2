import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface AffiliateSummary {
  orders_count: number;
  sales_with_commission: number;
  sales_in_progress: number;
  commission_pending: number;
  commission_paid: number;
  commission_total: number;
}

export interface CommissionRow {
  id: number;
  order_code: string;
  order_status: string;
  order_total: string;
  customer_name: string;
  affiliate_name?: string;
  ref_code?: string;
  base_amount: string;
  rate: string;
  amount: string;
  status: 'APPROVED' | 'PAID' | 'CANCELLED';
  paid_at: string | null;
  created_at: string;
}

export interface AffiliateAdminRow {
  id: number;
  full_name: string;
  email: string;
  ref_code: string;
  is_active: boolean;
  date_joined: string;
  sales_count: number;
  commission_pending: number;
  commission_paid: number;
}

export interface PayoutRow {
  id: number;
  affiliate: number;
  affiliate_name: string;
  ref_code: string;
  amount: string;
  method: 'CASH' | 'TRANSFER';
  method_label: string;
  reference: string;
  commissions_count: number;
  paid_by_name: string;
  created_at: string;
}

export interface PayoutCreatePayload {
  affiliate: number;
  method: 'CASH' | 'TRANSFER';
  reference?: string;
  commission_ids?: number[];
}

export interface MonthlyPoint {
  label: string;
  sales: number;
  commission: number;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class AffiliateService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/affiliate`;

  // --- Afiliado (self) ---
  summary(): Observable<AffiliateSummary> {
    return this.http.get<AffiliateSummary>(`${this.base}/commissions/summary/`);
  }

  commissions(): Observable<Paged<CommissionRow>> {
    return this.http.get<Paged<CommissionRow>>(`${this.base}/commissions/`);
  }

  monthly(): Observable<MonthlyPoint[]> {
    return this.http.get<MonthlyPoint[]>(`${this.base}/commissions/monthly/`);
  }

  // --- Gestion admin ---
  adminAffiliates(search = ''): Observable<AffiliateAdminRow[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<AffiliateAdminRow[]>(`${this.base}/admin/affiliates/`, { params });
  }

  adminCommissions(affiliateId: number, status = ''): Observable<Paged<CommissionRow>> {
    let params = new HttpParams().set('affiliate', String(affiliateId));
    if (status) params = params.set('status', status);
    return this.http.get<Paged<CommissionRow>>(`${this.base}/admin/commissions/`, { params });
  }

  adminPayouts(affiliateId?: number): Observable<Paged<PayoutRow>> {
    let params = new HttpParams();
    if (affiliateId) params = params.set('affiliate', String(affiliateId));
    return this.http.get<Paged<PayoutRow>>(`${this.base}/admin/payouts/`, { params });
  }

  createPayout(body: PayoutCreatePayload): Observable<PayoutRow> {
    return this.http.post<PayoutRow>(`${this.base}/admin/payouts/`, body);
  }
}
