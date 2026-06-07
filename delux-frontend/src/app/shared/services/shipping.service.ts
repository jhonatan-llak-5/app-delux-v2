import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';

export interface ShipmentEvent {
  id: number;
  status: string;
  status_label: string;
  description: string;
  location: string;
  actor_name: string | null;
  created_at: string;
}

export interface Shipment {
  id: number;
  order: number;
  order_code: string;
  tracking_code: string;
  carrier: string;
  carrier_label: string;
  status: 'CREATED' | 'PREPARING' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  status_label: string;
  estimated_delivery: string | null;
  shipping_cost: string;
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  country: string;
  notes: string;
  events: ShipmentEvent[];
  created_at: string;
}

export interface PublicTracking {
  tracking_code: string;
  order_code: string;
  status: string;
  status_label: string;
  carrier: string;
  recipient_name: string;
  city: string;
  estimated_delivery: string | null;
  events: { status: string; status_label: string; description: string; location: string; created_at: string }[];
}

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  publicTrack(code: string) {
    return this.http.get<PublicTracking>(`${this.base}/tracking/${code}/`);
  }
  list(params: { status?: string; carrier?: string; search?: string } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p = p.set(k, String(v)); });
    return this.http.get<{ count: number; results: Shipment[] }>(`${this.base}/admin/shipments/`, { params: p });
  }
  create(payload: Partial<Shipment>) { return this.http.post<Shipment>(`${this.base}/admin/shipments/`, payload); }
  updateStatus(id: number, status: string, description = '', location = '') {
    return this.http.post<Shipment>(`${this.base}/admin/shipments/${id}/update_status/`, { status, description, location });
  }
}
