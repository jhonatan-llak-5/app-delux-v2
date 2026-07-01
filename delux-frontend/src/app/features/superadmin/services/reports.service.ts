import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface RangeParams {
  from?: string;
  to?: string;
  branch?: number;
}

export interface OverviewKPIs {
  from: string;
  to: string;
  total_revenue: string;
  total_orders: number;
  avg_order_value: string;
  items_sold: number;
  unique_customers: number;
  revenue_delta_pct: number | null;
  orders_delta_pct: number | null;
}

export interface TimelinePoint { day: string; revenue: string; orders: number; }
export interface BranchRow { branch_id: number; branch__name: string; branch__code: string; revenue: string; orders: number; }
export interface CategoryRow { variant__product__category_id: number; variant__product__category__name: string; revenue: string; units: number; }
export interface BrandRow { variant__product__brand_id: number; variant__product__brand__name: string; revenue: string; units: number; }
export interface ProductRow {
  variant__product_id: number;
  variant__product__name: string;
  variant__product__main_image_url: string;
  variant__product__brand__name: string;
  revenue: string;
  units: number;
}
export interface SellerRow {
  seller_id: number;
  seller__full_name: string;
  seller__email: string;
  seller__commission_rate: string;
  seller__branch__name: string;
  revenue: string;
  orders: number;
  commission: number;
}
export interface ChannelRow { channel: string; revenue: string; orders: number; }
export interface LowStockRow { variant_sku: string; product_name: string; branch_name: string; quantity: number; min_threshold: number; }

export interface MySalesData {
  from: string; to: string;
  total_revenue: string;
  total_orders: number;
  items_sold: number;
  avg_order_value: string;
  today_revenue: string;
  today_orders: number;
  commission_rate: string;
  commission: string;
  timeline: { day: string; revenue: string; orders: number }[];
  by_branch: { branch__name: string; revenue: string; orders: number }[];
  recent: { code: string; created_at: string; total: string; branch: string; customer: string; channel: string }[];
}

function buildParams(p: RangeParams) {
  let q = new HttpParams();
  if (p.from)   q = q.set('from', p.from);
  if (p.to)     q = q.set('to', p.to);
  if (p.branch) q = q.set('branch', String(p.branch));
  return q;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/reports`;

  overview(p: RangeParams = {}) {
    return this.http.get<OverviewKPIs>(`${this.base}/overview/`, { params: buildParams(p) });
  }
  timeline(p: RangeParams = {}): Observable<{ results: TimelinePoint[] }> {
    return this.http.get<{ results: TimelinePoint[] }>(`${this.base}/timeline/`, { params: buildParams(p) });
  }
  byBranch(p: RangeParams = {}): Observable<{ results: BranchRow[] }> {
    return this.http.get<{ results: BranchRow[] }>(`${this.base}/by_branch/`, { params: buildParams(p) });
  }
  byCategory(p: RangeParams = {}): Observable<{ results: CategoryRow[] }> {
    return this.http.get<{ results: CategoryRow[] }>(`${this.base}/by_category/`, { params: buildParams(p) });
  }
  byBrand(p: RangeParams = {}): Observable<{ results: BrandRow[] }> {
    return this.http.get<{ results: BrandRow[] }>(`${this.base}/by_brand/`, { params: buildParams(p) });
  }
  topProducts(p: RangeParams = {}): Observable<{ results: ProductRow[] }> {
    return this.http.get<{ results: ProductRow[] }>(`${this.base}/top_products/`, { params: buildParams(p) });
  }
  topSellers(p: RangeParams = {}): Observable<{ results: SellerRow[] }> {
    return this.http.get<{ results: SellerRow[] }>(`${this.base}/top_sellers/`, { params: buildParams(p) });
  }
  byChannel(p: RangeParams = {}): Observable<{ results: ChannelRow[] }> {
    return this.http.get<{ results: ChannelRow[] }>(`${this.base}/by_channel/`, { params: buildParams(p) });
  }
  lowStock(): Observable<{ results: LowStockRow[] }> {
    return this.http.get<{ results: LowStockRow[] }>(`${this.base}/low_stock/`);
  }
  mySales(p: RangeParams = {}): Observable<MySalesData> {
    return this.http.get<MySalesData>(`${this.base}/my-sales/`, { params: buildParams(p) });
  }
}
