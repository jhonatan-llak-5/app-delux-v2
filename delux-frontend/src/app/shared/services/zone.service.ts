import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PublicBranchesService, PublicBranch } from './public-branches.service';
import { SplashService } from './splash.service';

const ZONE_KEY = 'dlx_zone_city';

export interface ZoneCity {
  city: string;
  branches: PublicBranch[];
  count: number;
}

/**
 * Estado global de la "zona" (ciudad) elegida por el cliente.
 *
 * Modelo: Delux es la marca; cada ciudad tiene su sucursal con stock propio.
 * El cliente elige su ciudad y el catálogo se filtra a lo disponible ahí.
 */
@Injectable({ providedIn: 'root' })
export class ZoneService {
  private branchSvc = inject(PublicBranchesService);
  private splash = inject(SplashService);

  private _branches = signal<PublicBranch[]>([]);
  private _city = signal<string | null>(this.readCity());
  private _loaded = signal(false);
  pickerOpen = signal(false);
  /** Intención de auto-abrir el picker en cuanto el splash termine. */
  private _wantAutoOpen = signal(false);

  constructor() {
    // Abre el selector de ciudad SOLO cuando el splash ya terminó.
    effect(() => {
      if (this.splash.done() && this._wantAutoOpen() && !this._city()) {
        this.pickerOpen.set(true);
        this._wantAutoOpen.set(false);
      }
    });
  }

  readonly branches = computed(() => this._branches());
  readonly city = computed(() => this._city());
  readonly loaded = computed(() => this._loaded());
  readonly hasCity = computed(() => !!this._city());

  /** Ciudades únicas (de las sucursales registradas) con sus sucursales. */
  readonly cities = computed<ZoneCity[]>(() => {
    const map = new Map<string, PublicBranch[]>();
    for (const b of this._branches()) {
      const arr = map.get(b.city) ?? [];
      arr.push(b);
      map.set(b.city, arr);
    }
    return Array.from(map.entries())
      .map(([city, branches]) => ({
        city,
        branches,
        count: branches.reduce((s, b) => s + (b.products_count || 0), 0),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  });

  /** Sucursales de la ciudad seleccionada. */
  readonly branchesInCity = computed(() =>
    this._branches().filter(b => b.city === this._city())
  );

  /** Carga las sucursales una sola vez; abre el selector si no hay ciudad. */
  load(autoOpen = true): void {
    if (this._loaded()) {
      if (autoOpen && !this._city()) this._wantAutoOpen.set(true);
      return;
    }
    this.branchSvc.list().subscribe({
      next: r => {
        this._branches.set(r.results || []);
        this._loaded.set(true);
        // Si la ciudad guardada ya no existe, la limpiamos.
        const cur = this._city();
        if (cur && !this.cities().some(c => c.city === cur)) {
          this._city.set(null);
        }
        if (autoOpen && !this._city()) this._wantAutoOpen.set(true);
      },
      error: () => this._loaded.set(true),
    });
  }

  setCity(city: string): void {
    this._city.set(city);
    if (typeof window !== 'undefined') localStorage.setItem(ZONE_KEY, city);
    this.pickerOpen.set(false);
  }

  clear(): void {
    this._city.set(null);
    if (typeof window !== 'undefined') localStorage.removeItem(ZONE_KEY);
  }

  openPicker(): void { this.pickerOpen.set(true); }
  closePicker(): void { this.pickerOpen.set(false); }

  /** Detecta la ciudad más cercana por geolocalización (haversine). */
  useGeolocation(): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          const withCoords = this._branches().filter(
            b => b.latitude != null && b.longitude != null
          );
          if (!withCoords.length) { resolve(null); return; }
          let best = withCoords[0];
          let bestD = Number.POSITIVE_INFINITY;
          for (const b of withCoords) {
            const d = this.haversine(latitude, longitude, Number(b.latitude), Number(b.longitude));
            if (d < bestD) { bestD = d; best = b; }
          }
          this.setCity(best.city);
          resolve(best.city);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000 },
      );
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private readCity(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ZONE_KEY);
  }
}
