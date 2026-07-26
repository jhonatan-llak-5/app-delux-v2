import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Expense {
  id: number;
  date: string;
  amount: string | number;
  category: string;
  category_label: string;
  payment_method?: string;
  payment_method_label?: string;
  supplier?: number | null;
  supplier_name?: string | null;
  description: string;
  branch: number | null;
  branch_name?: string | null;
  created_by_name?: string;
  created_at?: string;
}
export interface ExpenseCategoryOpt { value: string; label: string; }
export interface ExpenseSummary {
  total: string;
  today_total: string;
  count: number;
  by_category: { category: string; label: string; total: string; count: number }[];
}
export interface FinanceDeltas {
  ventas: number | null; ventas_web: number | null; ventas_pos: number | null;
  compras: number | null; gastos: number | null; ganancia: number | null;
}
export interface FinanceSummary {
  ventas: string; ventas_web: string; ventas_pos: string;
  compras: string; gastos: string; ganancia: string; orders: number;
  gastos_by_cat: { category: string; label: string; total: string }[];
  deltas: FinanceDeltas;
  range: { from: string; to: string };
  prev_range: { from: string; to: string };
}
export interface FinanceTimeline { labels: string[]; web: number[]; pos: number[]; gastos: number[]; granularity: 'day' | 'month'; }
export interface FinanceYear { year: number; ventas: string; compras: string; gastos: string; ganancia: string; }
export interface FinanceTopProduct { product: string; qty: number; revenue: string; delta: number | null; }
export interface FinanceTxn {
  id: string; kind: 'INGRESO' | 'EGRESO'; date: string;
  concept: string; party: string; method: string; ref: string; amount: string;
}
export interface FinanceTxnPage {
  count: number; page: number; page_size: number; results: FinanceTxn[];
  ingresos_total: string; egresos_total: string; balance: string;
}
export interface TxnFilter extends ExpenseFilter { q?: string; kind?: 'INGRESO' | 'EGRESO' | ''; page?: number; page_size?: number; }
export interface ExpenseFilter { branch?: number | null; category?: string; from?: string; to?: string; }
interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/expenses`;
  private financeBase = `${environment.apiUrl}/admin/finance`;

  private toParams(f: ExpenseFilter): HttpParams {
    let p = new HttpParams();
    if (f.branch != null) p = p.set('branch', String(f.branch));
    if (f.category) p = p.set('category', f.category);
    if (f.from) p = p.set('from', f.from);
    if (f.to) p = p.set('to', f.to);
    return p;
  }
  list(f: ExpenseFilter = {}): Observable<Paged<Expense>> {
    return this.http.get<Paged<Expense>>(`${this.base}/`, { params: this.toParams(f) });
  }
  summary(f: ExpenseFilter = {}): Observable<ExpenseSummary> {
    return this.http.get<ExpenseSummary>(`${this.base}/summary/`, { params: this.toParams(f) });
  }
  categories(): Observable<ExpenseCategoryOpt[]> {
    return this.http.get<ExpenseCategoryOpt[]>(`${this.base}/categories/`);
  }
  create(body: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/`, body);
  }
  update(id: number, body: Partial<Expense>): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${id}/`, body);
  }
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }
  financeSummary(f: ExpenseFilter = {}): Observable<FinanceSummary> {
    return this.http.get<FinanceSummary>(`${this.financeBase}/summary/`, { params: this.toParams(f) });
  }
  financeTimeline(f: ExpenseFilter = {}): Observable<FinanceTimeline> {
    return this.http.get<FinanceTimeline>(`${this.financeBase}/timeline/`, { params: this.toParams(f) });
  }
  financeYearly(f: ExpenseFilter = {}): Observable<FinanceYear[]> {
    return this.http.get<FinanceYear[]>(`${this.financeBase}/yearly/`, { params: this.toParams(f) });
  }
  financeTopProducts(f: ExpenseFilter = {}): Observable<FinanceTopProduct[]> {
    return this.http.get<FinanceTopProduct[]>(`${this.financeBase}/top_products/`, { params: this.toParams(f) });
  }
  financeTransactions(f: TxnFilter = {}): Observable<FinanceTxnPage> {
    let p = this.toParams(f);
    if (f.q) p = p.set('q', f.q);
    if (f.kind) p = p.set('kind', f.kind);
    if (f.page) p = p.set('page', String(f.page));
    if (f.page_size) p = p.set('page_size', String(f.page_size));
    return this.http.get<FinanceTxnPage>(`${this.financeBase}/transactions/`, { params: p });
  }
}
