import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import type { AppRole } from '../guards/role.guard';

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  full_name: string;
  phone?: string;
  role: AppRole;
  tenant_id?: number | null;
  branch_id?: number | null;
  ref_code?: string;
  is_email_verified?: boolean;
  is_active?: boolean;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

const ACCESS_KEY  = 'dlx_access_token';
const REFRESH_KEY = 'dlx_refresh_token';
const USER_KEY    = 'dlx_user';

// Backup de la sesión real cuando el superadmin impersona a otro usuario.
const IMP_ACCESS  = 'dlx_imp_access';
const IMP_REFRESH = 'dlx_imp_refresh';
const IMP_USER    = 'dlx_imp_user';
const IMP_FLAG    = 'dlx_impersonator';

export interface Impersonator { name: string; email: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/auth`;

  private _user = signal<AuthUser | null>(this.readUser());
  readonly user = computed(() => this._user());
  readonly isLogged = computed(() => this._user() !== null);
  readonly role = computed(() => this._user()?.role ?? null);
  readonly isSuperadmin = computed(() => this._user()?.role === 'SUPERADMIN');

  // ── Impersonación
  private _impersonator = signal<Impersonator | null>(this.readImpersonator());
  readonly impersonating = computed(() => this._impersonator() !== null);
  readonly impersonator = computed(() => this._impersonator());

  // ── Auth flows
  /** Login acepta username o email en `identifier`. */
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/login/`, { identifier, password })
      .pipe(tap((r) => this.persist(r)));
  }

  register(payload: { full_name: string; username: string; email: string; password: string; account_type?: string; recaptcha_token?: string }) {
    return this.http.post<{ detail: string; email: string }>(
      `${this.base}/register/`, payload,
    );
  }

  activate(email: string, code: string) {
    return this.http.post<{ detail: string }>(
      `${this.base}/activate/`, { email, code },
    );
  }

  resendCode(email: string) {
    return this.http.post<{ detail: string }>(
      `${this.base}/resend-code/`, { email },
    );
  }

  forgotPassword(email: string) {
    return this.http.post<{ detail: string }>(
      `${this.base}/forgot-password/`, { email },
    );
  }

  resetPassword(payload: { email: string; code: string; new_password: string }) {
    return this.http.post<{ detail: string }>(
      `${this.base}/reset-password/`, payload,
    );
  }

  me() {
    return this.http.get<AuthUser>(`${this.base}/me/`)
      .pipe(tap((u) => { localStorage.setItem(USER_KEY, JSON.stringify(u)); this._user.set(u); }));
  }

  updateProfile(payload: { full_name?: string; phone?: string }) {
    return this.http.patch<AuthUser>(`${this.base}/me/`, payload)
      .pipe(tap((u) => { localStorage.setItem(USER_KEY, JSON.stringify(u)); this._user.set(u); }));
  }

  changePassword(current_password: string, new_password: string) {
    return this.http.post<{ detail: string }>(`${this.base}/change-password/`,
      { current_password, new_password });
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.clearImpersonationBackup();
    this._user.set(null);
  }

  // ── Impersonación (superadmin entra como otro usuario)
  /** Respalda la sesión actual y activa la sesión del usuario impersonado. */
  startImpersonation(r: LoginResponse): void {
    if (typeof window === 'undefined') return;
    if (!this._impersonator()) {
      // Solo respaldar si no estamos ya impersonando (evita perder al superadmin).
      const cur = this._user();
      localStorage.setItem(IMP_ACCESS, localStorage.getItem(ACCESS_KEY) || '');
      localStorage.setItem(IMP_REFRESH, localStorage.getItem(REFRESH_KEY) || '');
      localStorage.setItem(IMP_USER, localStorage.getItem(USER_KEY) || '');
      const imp: Impersonator = { name: cur?.full_name || 'Superadmin', email: cur?.email || '' };
      localStorage.setItem(IMP_FLAG, JSON.stringify(imp));
      this._impersonator.set(imp);
    }
    this.persist(r);
  }

  /** Restaura la sesión del superadmin original. */
  stopImpersonation(): void {
    if (typeof window === 'undefined') return;
    const a = localStorage.getItem(IMP_ACCESS);
    const rf = localStorage.getItem(IMP_REFRESH);
    const u = localStorage.getItem(IMP_USER);
    if (a && rf && u) {
      localStorage.setItem(ACCESS_KEY, a);
      localStorage.setItem(REFRESH_KEY, rf);
      localStorage.setItem(USER_KEY, u);
      try { this._user.set(JSON.parse(u) as AuthUser); } catch { /* noop */ }
    }
    this.clearImpersonationBackup();
  }

  private clearImpersonationBackup(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(IMP_ACCESS);
    localStorage.removeItem(IMP_REFRESH);
    localStorage.removeItem(IMP_USER);
    localStorage.removeItem(IMP_FLAG);
    this._impersonator.set(null);
  }

  private readImpersonator(): Impersonator | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(IMP_FLAG);
    if (!raw) return null;
    try { return JSON.parse(raw) as Impersonator; } catch { return null; }
  }

  // ── Internals
  private persist(r: LoginResponse): void {
    localStorage.setItem(ACCESS_KEY, r.access);
    localStorage.setItem(REFRESH_KEY, r.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(r.user));
    this._user.set(r.user);
  }

  private readUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  }
}
