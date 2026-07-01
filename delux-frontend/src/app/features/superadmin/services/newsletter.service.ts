import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Subscriber {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/settings/subscribers`;

  list(search = ''): Observable<Subscriber[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<Subscriber[]>(`${this.base}/`, { params });
  }

  deactivate(id: number): Observable<Subscriber> {
    return this.http.post<Subscriber>(`${this.base}/${id}/deactivate/`, {});
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }
}
