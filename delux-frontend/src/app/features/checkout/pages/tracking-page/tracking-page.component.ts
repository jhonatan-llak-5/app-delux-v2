import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit,
  ViewChild, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { environment } from '@env/environment';
import { ShippingService, PublicTracking, PublicTrackingEvent } from '@shared/services/shipping.service';
import * as L from 'leaflet';

@Component({
  selector: 'dlx-tracking-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tracking-page.component.html',
})
export class TrackingPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private svc = inject(ShippingService);
  private route = inject(ActivatedRoute);

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  code = '';
  tracking = signal<PublicTracking | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  wsConnected = signal(false);
  lastUpdate = signal<Date | null>(null);

  private ws: WebSocket | null = null;
  private map: any = null;
  private originMarker: any = null;
  private destMarker: any = null;
  private courierMarker: any = null;
  private routeLine: any = null;
  private cssLoaded = false;

  ngOnInit() {
    const c = this.route.snapshot.paramMap.get('code') ||
              this.route.snapshot.queryParamMap.get('code');
    if (c) { this.code = c; this.search(); }
  }

  ngAfterViewInit() { this.injectLeafletCss(); }

  ngOnDestroy() {
    this.closeWs();
    if (this.map) { this.map.remove(); this.map = null; }
  }

  search() {
    if (!this.code) return;
    this.loading.set(true);
    this.error.set(null);
    this.tracking.set(null);
    this.closeWs();
    this.svc.publicTrack(this.code.trim().toUpperCase()).subscribe({
      next: t => {
        this.tracking.set(t);
        this.loading.set(false);
        this.lastUpdate.set(new Date());
        this.connectWs(t.tracking_code);
        setTimeout(() => this.renderMap(), 50);
      },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'Código no encontrado');
      },
    });
  }

  private connectWs(code: string) {
    const wsBase = location.origin.replace(/^http/, 'ws');
    const url = `${wsBase}/ws/tracking/${code}/`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => this.wsConnected.set(true);
      this.ws.onclose = () => this.wsConnected.set(false);
      this.ws.onerror = () => this.wsConnected.set(false);
      this.ws.onmessage = (ev) => this.handleWsMessage(JSON.parse(ev.data));
    } catch {
      this.wsConnected.set(false);
    }
  }

  private closeWs() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
      this.wsConnected.set(false);
    }
  }

  private handleWsMessage(msg: any) {
    const t = this.tracking();
    if (!t) return;

    if (msg.type === 'event_added' && msg.event) {
      const updated: PublicTracking = {
        ...t,
        status: msg.shipment_status,
        status_label: msg.shipment_status_label,
        events: [msg.event as PublicTrackingEvent, ...t.events],
      };
      this.tracking.set(updated);
      this.lastUpdate.set(new Date());
      if (msg.event.latitude != null && msg.event.longitude != null) {
        this.addEventMarker(msg.event.latitude, msg.event.longitude, msg.event.status_label);
      }
    }

    if (msg.type === 'courier_moved' && msg.latitude != null && msg.longitude != null) {
      this.updateCourierMarker(msg.latitude, msg.longitude);
      this.lastUpdate.set(new Date());
    }
  }

  private injectLeafletCss() {
    if (this.cssLoaded || typeof document === 'undefined') return;
    const id = 'leaflet-css-cdn';
    if (document.getElementById(id)) { this.cssLoaded = true; return; }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
    this.cssLoaded = true;
  }

  private async renderMap() {
    const t = this.tracking();
    if (!t || !this.mapEl) return;

    const origin = t.origin;
    const dest   = t.destination;
    const hasOrigin = !!(origin && origin.latitude != null && origin.longitude != null);
    const hasDest   = !!(dest   && dest.latitude   != null && dest.longitude   != null);
    if (!hasOrigin && !hasDest) return;

    if (this.map) { this.map.remove(); this.map = null; }

    const center: [number, number] = hasOrigin
      ? [origin!.latitude as number, origin!.longitude as number]
      : [dest!.latitude as number, dest!.longitude as number];

    this.map = L.map(this.mapEl.nativeElement, {
      center, zoom: 13, zoomControl: true, scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'OpenStreetMap contributors',
    }).addTo(this.map);

    if (hasOrigin && origin) {
      this.originMarker = L.marker([origin.latitude as number, origin.longitude as number], {
        icon: this.colorIcon(L, '#16a34a', 'fa-store'),
      }).addTo(this.map).bindPopup(
        '<b>' + (origin.name ?? 'Sucursal') + '</b><br>' + (origin.address ?? '')
      );
    }
    if (hasDest && dest) {
      this.destMarker = L.marker([dest.latitude as number, dest.longitude as number], {
        icon: this.colorIcon(L, '#dc2626', 'fa-location-dot'),
      }).addTo(this.map).bindPopup(
        '<b>Destino</b><br>' + dest.address
      );
    }
    if (hasOrigin && hasDest && origin && dest) {
      this.routeLine = L.polyline(
        [[origin.latitude as number, origin.longitude as number],
         [dest.latitude as number, dest.longitude as number]],
        { color: '#1e40af', weight: 3, opacity: 0.5, dashArray: '8,8' }
      ).addTo(this.map);
      const group = L.featureGroup([this.originMarker, this.destMarker]);
      this.map.fitBounds(group.getBounds().pad(0.25));
    }
    if (t.courier?.latitude != null && t.courier?.longitude != null) {
      this.updateCourierMarker(t.courier.latitude, t.courier.longitude);
    }
  }

  private colorIcon(L: any, color: string, faIcon: string) {
    const html =
      '<div style="background:' + color + ';width:34px;height:34px;border-radius:50% 50% 50% 0;' +
      'transform:rotate(-45deg);display:grid;place-items:center;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.3);border:3px solid #fff;">' +
      '<i class="fa-solid ' + faIcon + '" style="color:#fff;transform:rotate(45deg);font-size:13px;"></i>' +
      '</div>';
    return L.divIcon({
      className: 'dlx-map-pin',
      html,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
  }

  private addEventMarker(lat: number, lon: number, label: string) {
    if (!this.map) return;
    L.circleMarker([lat, lon], {
      radius: 6, color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 0.7,
    }).bindPopup('<b>' + label + '</b>').addTo(this.map);
  }

  private updateCourierMarker(lat: number, lon: number) {
    if (!this.map) return;
    if (this.courierMarker) {
      this.courierMarker.setLatLng([lat, lon]);
    } else {
      this.courierMarker = L.marker([lat, lon], {
        icon: this.colorIcon(L, '#f59e0b', 'fa-truck'),
      }).addTo(this.map).bindPopup('<b>Repartidor</b><br>En ruta');
    }
  }

  statusColor(s: string): string {
    const map: Record<string, string> = {
      CREATED:    'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/70',
      PREPARING:  'bg-amber-100 text-amber-700',
      SHIPPED:    'bg-sky-100 text-sky-700',
      IN_TRANSIT: 'bg-violet-100 text-violet-700',
      DELIVERED:  'bg-emerald-100 text-emerald-700',
      FAILED:     'bg-rose-100 text-rose-700',
      RETURNED:   'bg-rose-100 text-rose-700',
    };
    return map[s] || 'bg-slate-200 text-slate-700';
  }

  statusIcon(s: string): string {
    const map: Record<string, string> = {
      CREATED:    'fa-box',
      PREPARING:  'fa-boxes-packing',
      SHIPPED:    'fa-truck-fast',
      IN_TRANSIT: 'fa-truck',
      DELIVERED:  'fa-circle-check',
      FAILED:     'fa-circle-xmark',
      RETURNED:   'fa-rotate-left',
    };
    return map[s] || 'fa-box';
  }
}
