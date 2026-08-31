import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import type { CashCountLine } from '@shared/ui/cash-count.component';

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashRegister {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  is_active: boolean;
  has_open_session: boolean;
}

export interface CashCountRow {
  piece: 'BILL' | 'COIN';
  denomination: string;
  quantity: number;
  subtotal: string;
}

export interface CashMovement {
  id: number;
  type: 'IN' | 'OUT';
  type_label: string;
  amount: string;
  reason: string;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

/** Totales del turno: en vivo si está abierta, congelados si ya cerró. */
export interface CashTotals {
  sales_count: number;
  sales_total: string;
  cash_sales: string;
  card_sales: string;
  transfer_sales: string;
  other_sales: string;
  change_in: string;
  change_out: string;
  expenses_cash: string;
  cash_in: string;
  cash_out: string;
  total_income: string;
  total_outflow: string;
  expected_amount: string;
}

export interface CashSession {
  id: number;
  code: string;
  status: CashSessionStatus;
  branch: number;
  branch_name: string;
  register: number | null;
  register_name: string;
  opened_by: number;
  opened_by_name: string;
  opened_at: string;
  opening_amount: string;
  opening_note: string;
  closed_by: number | null;
  closed_by_name: string;
  closed_at: string | null;
  closing_note: string;
  sales_count: number;
  sales_total: string;
  cash_sales: string;
  card_sales: string;
  transfer_sales: string;
  other_sales: string;
  change_in: string;
  change_out: string;
  expenses_cash: string;
  cash_in: string;
  cash_out: string;
  expected_amount: string;
  counted_amount: string;
  difference: string;
  // Solo en el detalle
  opening_count?: CashCountRow[];
  closing_count?: CashCountRow[];
  movements?: CashMovement[];
  totals?: CashTotals;
}

export interface CashStats {
  sessions: number;
  open: number;
  closed: number;
  sales_total: string;
  cash_sales: string;
  expected_amount: string;
  counted_amount: string;
  difference: string;
  mismatched: number;
}

export interface CashFilter {
  branch?: number | null;
  register?: number | null;
  status?: CashSessionStatus | '';
  user?: number | null;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  /** Trae también conteos y movimientos de cada turno (para exportar). */
  detail?: boolean;
}

interface Paged<T> { count: number; results: T[]; }

/** Las líneas vacías (cantidad null) no se envían: el backend las cuenta en 0. */
function toPayloadLines(lines: CashCountLine[]) {
  return lines
    .filter(l => (l.quantity ?? 0) > 0)
    .map(l => ({ piece: l.piece, denomination: l.denomination.toFixed(2), quantity: l.quantity }));
}

@Injectable({ providedIn: 'root' })
export class CashService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/cash-sessions`;
  private registersBase = `${environment.apiUrl}/admin/cash-registers`;

  private toParams(f: CashFilter): HttpParams {
    let p = new HttpParams();
    if (f.branch != null) p = p.set('branch', String(f.branch));
    if (f.register != null) p = p.set('register', String(f.register));
    if (f.status) p = p.set('status', f.status);
    if (f.user != null) p = p.set('user', String(f.user));
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to) p = p.set('date_to', f.date_to);
    if (f.page) p = p.set('page', String(f.page));
    if (f.page_size) p = p.set('page_size', String(f.page_size));
    if (f.detail) p = p.set('detail', '1');
    return p;
  }

  list(f: CashFilter = {}): Observable<Paged<CashSession>> {
    return this.http.get<Paged<CashSession>>(`${this.base}/`, { params: this.toParams(f) });
  }
  get(id: number): Observable<CashSession> {
    return this.http.get<CashSession>(`${this.base}/${id}/`);
  }
  stats(f: CashFilter = {}): Observable<CashStats> {
    return this.http.get<CashStats>(`${this.base}/stats/`, { params: this.toParams(f) });
  }
  /** Turno abierto del usuario (o null si no tiene ninguno). */
  current(branch?: number | null): Observable<{ session: CashSession | null }> {
    let p = new HttpParams();
    if (branch != null) p = p.set('branch', String(branch));
    return this.http.get<{ session: CashSession | null }>(`${this.base}/current/`, { params: p });
  }
  open(body: { branch: number; register?: number | null; lines: CashCountLine[]; note?: string }): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.base}/open/`, {
      branch: body.branch,
      register: body.register ?? null,
      lines: toPayloadLines(body.lines),
      note: body.note || '',
    });
  }
  close(id: number, body: { lines: CashCountLine[]; note?: string }): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.base}/${id}/close/`, {
      lines: toPayloadLines(body.lines),
      note: body.note || '',
    });
  }
  summary(id: number): Observable<CashSession> {
    return this.http.get<CashSession>(`${this.base}/${id}/summary/`);
  }
  addMovement(id: number, body: { type: 'IN' | 'OUT'; amount: number; reason?: string }): Observable<CashMovement> {
    return this.http.post<CashMovement>(`${this.base}/${id}/movements/`, body);
  }

  registers(branch?: number | null): Observable<Paged<CashRegister>> {
    let p = new HttpParams();
    if (branch != null) p = p.set('branch', String(branch));
    return this.http.get<Paged<CashRegister>>(`${this.registersBase}/`, { params: p });
  }
  createRegister(body: { branch: number; name: string }): Observable<CashRegister> {
    return this.http.post<CashRegister>(`${this.registersBase}/`, body);
  }
  updateRegister(id: number, body: Partial<CashRegister>): Observable<CashRegister> {
    return this.http.patch<CashRegister>(`${this.registersBase}/${id}/`, body);
  }
  removeRegister(id: number): Observable<void> {
    return this.http.delete<void>(`${this.registersBase}/${id}/`);
  }
}
