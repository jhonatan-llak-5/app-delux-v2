import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { tap } from 'rxjs';

export interface TenantBranding {
  id: number;
  name: string;
  slug: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private http = inject(HttpClient);
  tenant = signal<TenantBranding | null>(null);

  load() {
    return this.http.get<TenantBranding>(`${environment.apiUrl}/tenant/current/`).pipe(
      tap(t => {
        this.tenant.set(t);
        this.applyBranding(t);
      })
    );
  }

  applyBranding(t: TenantBranding) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', t.primary_color);
    root.style.setProperty('--brand-accent', t.accent_color);
    if (t.name) document.title = `${t.name} — Streetwear premium`;
  }
}
