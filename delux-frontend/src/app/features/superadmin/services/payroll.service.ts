import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface PayrollItem {
  id: number;
  employee: number | null;
  employee_name: string;
  role: string;
  base_salary: string;
  adjustment: string;
  amount: string;
  status: 'PENDING' | 'PAID';
  method: 'CASH' | 'TRANSFER' | '';
  paid_at: string | null;
  notes: string;
}

export interface PayrollRun {
  id: number;
  year: number;
  month: number;
  branch: number | null;
  branch_name: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  total_amount: string;
  items_count: number;
  paid_count: number;
  generated_by_name: string;
  created_at: string;
}

export interface PayrollRunDetail extends PayrollRun {
  items: PayrollItem[];
}

export interface PayrollReportMonth { year: number; month: number; total: number; paid: number; pending: number; runs: number; }
export interface PayrollReport { months: PayrollReportMonth[]; total: number; paid: number; pending: number; }

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/payroll`;

  list(params: { year?: number; branch?: number } = {}): Observable<Paged<PayrollRun>> {
    let p = new HttpParams();
    if (params.year) p = p.set('year', String(params.year));
    if (params.branch) p = p.set('branch', String(params.branch));
    return this.http.get<Paged<PayrollRun>>(`${this.base}/`, { params: p });
  }

  get(id: number): Observable<PayrollRunDetail> {
    return this.http.get<PayrollRunDetail>(`${this.base}/${id}/`);
  }

  generate(body: { year: number; month: number; branch?: number | null }): Observable<PayrollRunDetail> {
    return this.http.post<PayrollRunDetail>(`${this.base}/generate/`, body);
  }

  payItem(runId: number, item: number, method: string, notes = ''): Observable<PayrollRunDetail> {
    return this.http.post<PayrollRunDetail>(`${this.base}/${runId}/pay-item/`, { item, method, notes });
  }
  unpayItem(runId: number, item: number): Observable<PayrollRunDetail> {
    return this.http.post<PayrollRunDetail>(`${this.base}/${runId}/unpay-item/`, { item });
  }
  payAll(runId: number, method: string): Observable<PayrollRunDetail> {
    return this.http.post<PayrollRunDetail>(`${this.base}/${runId}/pay-all/`, { method });
  }

  report(params: { year?: number; branch?: number } = {}): Observable<PayrollReport> {
    let p = new HttpParams();
    if (params.year) p = p.set('year', String(params.year));
    if (params.branch) p = p.set('branch', String(params.branch));
    return this.http.get<PayrollReport>(`${this.base}/report/`, { params: p });
  }
}
