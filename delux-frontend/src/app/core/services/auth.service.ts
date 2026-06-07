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
  role: AppRole;
  tenant_id?: number | null;
  branch_id?: number | null;
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/auth`;

  private _user = signal<AuthUser | null>(this.readUser());
  readonly user = computed(() => this._user());
  readonly isLogged = computed(() => this._user() !== null);
  readonly role = computed(() => this._user()?.role ?? null);
  readonly isSuperadmin = computed(() => this._user()?.role === 'SUPERADMIN');

  // ── Auth flows
  /** Login acepta username o email en `identifier`. */
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/login/`, { identifier, password })
      .pipe(tap((r) => this.persist(r)));
  }

  register(payload: { full_name: string; username: string; email: string; password: string }) {
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

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
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
