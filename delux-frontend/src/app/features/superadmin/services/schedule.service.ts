import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface BranchSchedule {
  id?: number;
  branch: number;
  weekday: number;
  weekday_label?: string;
  open_time: string | null;   // 'HH:MM:SS'
  close_time: string | null;
  is_closed: boolean;
}

interface Paged<T> { count: number; results: T[]; }

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/admin/schedules`;

  list(branch: number): Observable<Paged<BranchSchedule>> {
    return this.http.get<Paged<BranchSchedule>>(`${this.base}/`, {
      params: new HttpParams().set('branch', String(branch)),
    });
  }

  bulkSave(schedules: BranchSchedule[]) {
    return this.http.post<{ detail: string; count: number }>(`${this.base}/bulk-save/`, {
      schedules,
    });
  }
}
