import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: 'SUPERADMIN' | 'TENANT_ADMIN' | 'BRANCH_MANAGER' | 'SALESPERSON' | 'CUSTOMER';
  tenant_id: number | null;
  tenant_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  is_email_verified: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface AdminTenant {
  id: number;
  name: string;
  slug: string;
  legal_id: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  is_active: boolean;
  created_at: string;
  branches_count: number;
  users_count: number;
}

export interface AdminBranch {
  id: number;
  tenant_id: number;
  tenant_slug: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  opening_hours: string;
  manager: number | null;
  manager_name: string | null;
  allows_pickup: boolean;
  is_active: boolean;
  created_at: string;
  products_count: number;
}

export interface AdminBranchCatalogItem {
  id: number;
  name: string;
  slug: string;
  brand_name: string;
  category_name: string;
  base_price: string;
  status: string;
  tag: string;
  branch_stock: number;
}

export interface AdminBranchCatalogResponse {
  branch: AdminBranch;
  count: number;
  results: AdminBranchCatalogItem[];
}

export interface PlatformSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  default_from_email: string;
  default_from_name: string;
  support_email: string;
  activation_code_ttl_minutes: number;
  password_reset_ttl_minutes: number;
  platform_name: string;
  platform_tagline: string;
  payphone_enabled: boolean;
  payphone_token?: string;
  payphone_token_masked?: string;
  payphone_store_id: string;
  payphone_api_url: string;
  payphone_sandbox: boolean;
  updated_at?: string;
}

interface Paged<T> {
  count: number;
  pages: number;
  page: number;
  next: string | null;
  prev: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin`;

  // ── Users
  listUsers(params: { role?: string; search?: string } = {}): Observable<Paged<AdminUser>> {
    let p = new HttpParams();
    if (params.role)   p = p.set('role', params.role);
    if (params.search) p = p.set('search', params.search);
    return this.http.get<Paged<AdminUser>>(`${this.base}/users/`, { params: p });
  }
  activateUser(id: number)   { return this.http.post(`${this.base}/users/${id}/activate/`, {}); }
  deactivateUser(id: number) { return this.http.post(`${this.base}/users/${id}/deactivate/`, {}); }

  // ── Tenants
  listTenants(): Observable<Paged<AdminTenant>> {
    return this.http.get<Paged<AdminTenant>>(`${this.base}/tenants/`);
  }
  getTenant(slug: string): Observable<AdminTenant> {
    return this.http.get<AdminTenant>(`${this.base}/tenants/${slug}/`);
  }

  // ── Branches
  listBranches(tenantSlug?: string): Observable<Paged<AdminBranch>> {
    let p = new HttpParams();
    if (tenantSlug) p = p.set('tenant_slug', tenantSlug);
    return this.http.get<Paged<AdminBranch>>(`${this.base}/branches/`, { params: p });
  }
  branchCatalog(id: number): Observable<AdminBranchCatalogResponse> {
    return this.http.get<AdminBranchCatalogResponse>(`${this.base}/branches/${id}/catalog/`);
  }

  // ── Settings
  getSettings(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(`${this.base}/settings/`);
  }
  updateSettings(payload: Partial<PlatformSettings>) {
    return this.http.patch<PlatformSettings>(`${this.base}/settings/`, payload);
  }
  testEmail(to: string) {
    return this.http.post<{ detail: string }>(`${this.base}/settings/test-email/`, { to });
  }
}
