import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';

export interface MeProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  document_id: string;
  accepts_marketing: boolean;
  total_orders: number;
  total_spent: string;
}

export interface MeAddress {
  id?: number;
  label: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  is_default: boolean;
}

export interface WishlistEntry {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  brand_name: string;
  main_image_url: string;
  base_price: string;
  compare_at_price: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class MeService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  // Estado global del wishlist (set de productIds en memoria)
  wishlistIds = signal<Set<number>>(new Set());

  isInWishlist = (productId: number) =>
    computed(() => this.wishlistIds().has(productId));

  profile() { return this.http.get<MeProfile>(`${this.base}/me/profile/`); }
  updateProfile(payload: Partial<MeProfile>) {
    return this.http.patch<MeProfile>(`${this.base}/me/profile/`, payload);
  }

  addresses() { return this.http.get<{ count: number; results: MeAddress[] }>(`${this.base}/me/addresses/`); }
  createAddress(payload: MeAddress) { return this.http.post<MeAddress>(`${this.base}/me/addresses/`, payload); }
  updateAddress(id: number, payload: Partial<MeAddress>) { return this.http.patch<MeAddress>(`${this.base}/me/addresses/${id}/`, payload); }
  deleteAddress(id: number) { return this.http.delete(`${this.base}/me/addresses/${id}/`); }
  setDefaultAddress(id: number) { return this.http.post(`${this.base}/me/addresses/${id}/set_default/`, {}); }

  orders() { return this.http.get<{ count: number; results: any[] }>(`${this.base}/me/orders/`); }

  wishlist(): Observable<{ count: number; results: WishlistEntry[] }> {
    return this.http.get<{ count: number; results: WishlistEntry[] }>(`${this.base}/me/wishlist/`)
      .pipe(tap(r => this.wishlistIds.set(new Set(r.results.map(w => w.product_id)))));
  }

  toggleWishlist(productId: number): Observable<{ created: boolean; detail: string }> {
    const inList = this.wishlistIds().has(productId);
    if (inList) {
      return new Observable(sub => {
        this.http.delete(`${this.base}/me/wishlist/${productId}/`).subscribe({
          next: () => {
            const next = new Set(this.wishlistIds());
            next.delete(productId);
            this.wishlistIds.set(next);
            sub.next({ created: false, detail: 'Quitado de favoritos.' });
            sub.complete();
          },
          error: e => sub.error(e),
        });
      });
    }
    return this.http.post<{ created: boolean; detail: string }>(
      `${this.base}/me/wishlist/`, { product_id: productId }
    ).pipe(tap(() => {
      const next = new Set(this.wishlistIds());
      next.add(productId);
      this.wishlistIds.set(next);
    }));
  }
}
