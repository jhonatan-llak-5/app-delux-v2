import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { Observable } from 'rxjs';

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  document_id?: string;
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

export type EmailProvider =
  'custom' | 'gmail' | 'outlook' | 'yahoo' | 'office365' | 'zoho' | 'sendgrid' | 'mailgun';

export interface PlatformSettings {
  // Email
  email_active: boolean;
  email_provider: EmailProvider;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password?: string;
  smtp_password_configured?: boolean;
  smtp_use_tls: boolean;
  smtp_use_ssl: boolean;
  default_from_email: string;
  default_from_name: string;
  email_reply_to: string;
  support_email: string;

  // reCAPTCHA
  recaptcha_site_key: string;
  recaptcha_secret_key?: string;
  recaptcha_secret_configured?: boolean;

  // Cuentas
  activation_code_ttl_minutes: number;
  password_reset_ttl_minutes: number;

  // Marca
  site_name: string;
  platform_name: string;
  platform_tagline: string;
  site_logo?: string | null;
  site_logo_url?: string | null;
  site_favicon?: string | null;
  site_favicon_url?: string | null;
  whatsapp_contact_number: string;

  // Subidas
  max_image_upload_mb: number;
  max_file_upload_mb: number;
  max_video_upload_mb: number;
  allowed_image_extensions: string;
  allowed_file_extensions: string;
  allowed_video_extensions: string;

  // PayPhone
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
  listUsers(params: { role?: string; search?: string; kind?: 'system' | 'clients' } = {}): Observable<Paged<AdminUser>> {
    let p = new HttpParams();
    if (params.role)   p = p.set('role', params.role);
    if (params.search) p = p.set('search', params.search);
    if (params.kind)   p = p.set('kind', params.kind);
    return this.http.get<Paged<AdminUser>>(`${this.base}/users/`, { params: p });
  }
  activateUser(id: number)   { return this.http.post(`${this.base}/users/${id}/activate/`, {}); }
  deactivateUser(id: number) { return this.http.post(`${this.base}/users/${id}/deactivate/`, {}); }
  impersonate(id: number) {
    return this.http.post<{ access: string; refresh: string; user: any; impersonated: boolean }>(
      `${this.base}/users/${id}/impersonate/`, {},
    );
  }
  /** Editar datos basicos de una cuenta (email, nombre, telefono, documento)
   *  y opcionalmente la contrasena. El rol NO se cambia aqui. */
  updateUser(id: number, payload: {
    email?: string; full_name?: string; phone?: string;
    document_id?: string; password?: string;
  }): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${id}/`, payload);
  }

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
  createBranch(payload: Partial<AdminBranch> & { tenant_slug?: string }): Observable<AdminBranch> {
    return this.http.post<AdminBranch>(`${this.base}/branches/`, payload);
  }
  updateBranch(id: number, payload: Partial<AdminBranch>): Observable<AdminBranch> {
    return this.http.patch<AdminBranch>(`${this.base}/branches/${id}/`, payload);
  }
  deleteBranch(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/branches/${id}/`);
  }
  branchUsage(id: number): Observable<{ products_count: number; staff_count: number; orders_count: number }> {
    return this.http.get<{ products_count: number; staff_count: number; orders_count: number }>(`${this.base}/branches/${id}/usage/`);
  }

  // ── Settings (singleton de configuración global)
  getSettings(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(`${this.base}/settings/`);
  }
  /** PATCH JSON (sin archivos). */
  updateSettings(payload: Partial<PlatformSettings>) {
    return this.http.patch<PlatformSettings>(`${this.base}/settings/`, payload);
  }
  /** PATCH multipart cuando se adjunta logo/favicon. */
  updateSettingsMultipart(form: FormData) {
    return this.http.patch<PlatformSettings>(`${this.base}/settings/`, form);
  }
  testEmail(to: string) {
    return this.http.post<{ detail: string }>(`${this.base}/settings/test-email/`, { to });
  }
  testPayPhone() {
    return this.http.post<{ detail: string; sandbox: boolean; api_url: string; store_id: string }>(
      `${this.base}/settings/test-payphone/`, {}
    );
  }
}
