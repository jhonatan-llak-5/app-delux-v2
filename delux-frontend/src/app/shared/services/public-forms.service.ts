import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class PublicFormsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  contact(payload: { name: string; email: string; subject?: string; message: string }): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.base}/contact/`, payload);
  }

  subscribeNewsletter(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.base}/newsletter/`, { email });
  }
}
