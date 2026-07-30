import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PublicBranchesService, PublicBranch } from './public-branches.service';
import { SplashService } from './splash.service';

const ZONE_KEY = 'dlx_zone_province';

export interface ZoneProvince {
  province: string;
  branches: PublicBranch[];
  count: number;
}

/** @deprecated Se mantiene por compatibilidad; el VALOR ahora es la provincia. */
export interface ZoneCity {
  city: string;
  branches: PublicBranch[];
  count: number;
}

/**
 * Estado global de la "zona" (PROVINCIA) elegida por el cliente.
 *
 * Modelo: Delux es la marca; cada provincia agrupa sus sucursales con stock
 * propio. El cliente elige su provincia y el catálogo se filtra a lo disponible
 * ahí (filtro estricto por provincia en el backend).
 */
@Injectable({ providedIn: 'root' })
export class ZoneService {
  private branchSvc = inject(PublicBranchesService);
  private splash = inject(SplashService);

  private _branches = signal<PublicBranch[]>([]);
  private _province = signal<string | null>(this.readProvince());
  private _loaded = signal(false);
  pickerOpen = signal(false);
  /** Intención de auto-abrir el picker en cuanto el splash termine. */
  private _wantAutoOpen = signal(false);

  constructor() {
    // Abre el selector de provincia SOLO cuando el splash ya terminó.
    effect(() => {
      if (this.splash.done() && this._wantAutoOpen()) {
        this.pickerOpen.set(true);
        this._wantAutoOpen.set(false);
      }
    });
  }

  readonly branches = computed(() => this._branches());
  readonly province = computed(() => this._province());
  readonly loaded = computed(() => this._loaded());
  readonly hasProvince = computed(() => !!this._province());

  // ── Compatibilidad: el resto de la app aún lee `city()`/`hasCity()`,
  //    pero el VALOR ahora es la provincia. ──
  readonly city = this.province;
  readonly hasCity = this.hasProvince;

  /** Provincias únicas (de las sucursales registradas) con sus sucursales. */
  readonly provinces = computed<ZoneProvince[]>(() => {
    const map = new Map<string, PublicBranch[]>();
    for (const b of this._branches()) {
      if (!b.province) continue;
      const arr = map.get(b.province) ?? [];
      arr.push(b);
      map.set(b.province, arr);
    }
    return Array.from(map.entries())
      .map(([province, branches]) => ({
        province,
        branches,
        count: branches.reduce((s, b) => s + (b.products_count || 0), 0),
      }))
      .sort((a, b) => a.province.localeCompare(b.province));
  });

  /** @deprecated Alias de `provinces()` para consumidores que aún usan `.city`. */
  readonly cities = computed<ZoneCity[]>(() =>
    this.provinces().map(p => ({ city: p.province, branches: p.branches, count: p.count }))
  );

  /** Sucursales de la provincia seleccionada. */
  readonly branchesInProvince = computed(() =>
    this._branches().filter(b => b.province === this._province())
  );
  /** @deprecated Alias de `branchesInProvince()`. */
  readonly branchesInCity = this.branchesInProvince;

  /** Carga las sucursales una sola vez; aplica el default de provincia. */
  load(autoOpen = true): void {
    if (this._loaded()) {
      this.applyDefault(autoOpen);
      return;
    }
    this.branchSvc.list().subscribe({
      next: r => {
        this._branches.set(r.results || []);
        this._loaded.set(true);
        // Si la provincia guardada ya no existe, la limpiamos.
        const cur = this._province();
        if (cur && !this.provinces().some(p => p.province === cur)) {
          this._province.set(null);
        }
        this.applyDefault(autoOpen);
      },
      error: () => this._loaded.set(true),
    });
  }

  /**
   * DEFAULT de provincia:
   *  - Si ya hay una elegida/guardada válida → no hace nada.
   *  - Si hay UNA sola provincia → la auto-selecciona (sin abrir el modal).
   *  - Si hay VARIAS → selecciona la primera por defecto y (si corresponde)
   *    marca la intención de abrir el selector para que el cliente confirme.
   */
  private applyDefault(autoOpen: boolean): void {
    if (this._province()) return;
    const provs = this.provinces();
    if (!provs.length) return;
    if (provs.length === 1) {
      this.setProvince(provs[0].province);
      return;
    }
    this.setProvince(provs[0].province);
    if (autoOpen) this._wantAutoOpen.set(true);
  }

  setProvince(province: string): void {
    this._province.set(province);
    if (typeof window !== 'undefined') localStorage.setItem(ZONE_KEY, province);
    this.pickerOpen.set(false);
  }
  /** @deprecated Alias de `setProvince()`. */
  setCity(province: string): void { this.setProvince(province); }

  clear(): void {
    this._province.set(null);
    if (typeof window !== 'undefined') localStorage.removeItem(ZONE_KEY);
  }

  openPicker(): void { this.pickerOpen.set(true); }
  closePicker(): void { this.pickerOpen.set(false); }

  /** Detecta la sucursal más cercana por geolocalización y usa su provincia. */
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
            b => b.latitude != null && b.longitude != null && !!b.province
          );
          if (!withCoords.length) { resolve(null); return; }
          let best = withCoords[0];
          let bestD = Number.POSITIVE_INFINITY;
          for (const b of withCoords) {
            const d = this.haversine(latitude, longitude, Number(b.latitude), Number(b.longitude));
            if (d < bestD) { bestD = d; best = b; }
          }
          const prov = best.province;
          if (!prov) { resolve(null); return; }
          this.setProvince(prov);
          resolve(prov);
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

  private readProvince(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ZONE_KEY);
  }
}
