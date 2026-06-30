import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  parent_name: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  parent: number | null;
  children: CategoryTreeNode[];
  products_count: number;
}

export interface CategoryPayload {
  name: string;
  slug?: string;
  parent?: number | null;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

interface Paged<T> { count: number; results: T[]; }
interface TreeResp { count: number; results: CategoryTreeNode[]; }

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/categories`;

  list(params: { parent?: number | 'null'; is_active?: boolean; search?: string; page_size?: number } = {}): Observable<Paged<Category>> {
    let p = new HttpParams();
    if (params.parent !== undefined) p = p.set('parent', String(params.parent));
    if (params.is_active !== undefined) p = p.set('is_active', String(params.is_active));
    if (params.search) p = p.set('search', params.search);
    if (params.page_size) p = p.set('page_size', String(params.page_size));
    return this.http.get<Paged<Category>>(`${this.base}/`, { params: p });
  }

  tree(onlyActive = false): Observable<TreeResp> {
    let p = new HttpParams();
    if (onlyActive) p = p.set('only_active', 'true');
    return this.http.get<TreeResp>(`${this.base}/tree/`, { params: p });
  }

  get(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.base}/${id}/`);
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.http.post<Category>(`${this.base}/`, payload);
  }

  update(id: number, payload: Partial<CategoryPayload>): Observable<Category> {
    return this.http.patch<Category>(`${this.base}/${id}/`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }

  toggleActive(id: number): Observable<{ detail: string; is_active: boolean }> {
    return this.http.post<{ detail: string; is_active: boolean }>(`${this.base}/${id}/toggle_active/`, {});
  }

  reorder(items: { id: number; sort_order: number; parent?: number | null }[]): Observable<{ detail: string; count: number }> {
    return this.http.post<{ detail: string; count: number }>(`${this.base}/reorder/`, { items });
  }
}
