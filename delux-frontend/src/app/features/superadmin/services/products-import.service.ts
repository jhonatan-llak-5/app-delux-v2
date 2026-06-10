import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type RowStatus = 'ok' | 'warning' | 'error';

export interface ImportRow {
  __row__: number;
  _status: RowStatus;
  _errors: string[];
  _warnings: string[];

  name?: string;
  slug?: string;
  brand_slug?: string;
  category_slug?: string;
  base_price?: string | number;
  compare_at_price?: string | number | null;
  gender?: string;
  status?: string;
  tag?: string;
  is_featured?: boolean;
  short_description?: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  stock_per_variant?: number;
  stock_branch_code?: string;
  main_image_url?: string;
  extra_images_urls?: string[];
}

export interface DryRunResponse {
  summary: { total: number; ok: number; warning: number; error: number };
  rows: ImportRow[];
}

export interface CommitResponse {
  created_count: number;
  skipped_count: number;
  created: Array<{ row: number; id: number; slug: string; name: string }>;
  skipped: Array<{ row: number; reason: string }>;
}

@Injectable({ providedIn: 'root' })
export class ProductsImportService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/products/bulk-import`;

  /** Descarga la plantilla xlsx (devuelve Blob). */
  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/template/`, { responseType: 'blob' });
  }

  /** Sube el xlsx, recibe preview validado. */
  dryRun(file: File): Observable<DryRunResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<DryRunResponse>(`${this.base}/dry-run/`, fd);
  }

  /** Commit definitivo: filas validadas + ZIP opcional. */
  commit(rows: ImportRow[], zip?: File | null): Observable<CommitResponse> {
    const fd = new FormData();
    fd.append('rows', JSON.stringify(rows));
    if (zip) fd.append('zip', zip);
    return this.http.post<CommitResponse>(`${this.base}/commit/`, fd);
  }
}
