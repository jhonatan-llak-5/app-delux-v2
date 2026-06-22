import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface PublicBranch {
  id: number;
  code: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  opening_hours: string;
  allows_pickup: boolean;
  is_active: boolean;
  products_count: number;
}

interface BranchesResp { count: number; results: PublicBranch[]; }

@Injectable({ providedIn: 'root' })
export class PublicBranchesService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /** Sucursales activas del tenant actual (registradas en superadmin). */
  list(city?: string): Observable<BranchesResp> {
    const params: Record<string, string> = { slug: environment.tenant };
    if (city) params['city'] = city;
    return this.http.get<BranchesResp>(`${this.base}/branches/`, { params });
  }
}
