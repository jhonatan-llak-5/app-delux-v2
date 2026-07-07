import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';

export interface CartLine {
  variant_id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  product_slug: string;
  sku: string;
  size: string;
  color: string;
  unit_price: number;
  quantity: number;
  max_stock: number;
  brand_name?: string;
}

const BASE_KEY = 'dlx_cart_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  private auth = inject(AuthService);

  /** Clave de almacenamiento propia de la cuenta actual (o 'guest' si anónimo). */
  private ownerKey = signal<string>(this.keyForCurrentUser());
  lines = signal<CartLine[]>(this.loadFromStorage(this.ownerKey()));

  subtotal = computed(() =>
    this.lines().reduce((s, l) => s + l.unit_price * l.quantity, 0)
  );
  itemCount = computed(() => this.lines().reduce((s, l) => s + l.quantity, 0));

  constructor() {
    // Al cambiar de identidad (login / logout / cambio de cuenta) se recarga el
    // carrito PROPIO de esa cuenta, para que nunca se mezclen carritos de
    // cuentas distintas ni el de un usuario anónimo.
    effect(() => {
      const key = this.keyForCurrentUser();   // reacciona a auth.user()
      if (key !== this.ownerKey()) {
        this.ownerKey.set(key);
        this.lines.set(this.loadFromStorage(key));
      }
    }, { allowSignalWrites: true });
  }

  private keyForCurrentUser(): string {
    const id = this.auth.user()?.id;
    return `${BASE_KEY}::${id ?? 'guest'}`;
  }

  private loadFromStorage(key: string): CartLine[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private persist() {
    try { localStorage.setItem(this.ownerKey(), JSON.stringify(this.lines())); } catch {}
  }

  add(line: Omit<CartLine, 'quantity'>, qty = 1) {
    const idx = this.lines().findIndex(l => l.variant_id === line.variant_id);
    if (idx >= 0) {
      const next = [...this.lines()];
      next[idx] = { ...next[idx], quantity: Math.min(next[idx].quantity + qty, next[idx].max_stock) };
      this.lines.set(next);
    } else {
      this.lines.update(list => [...list, { ...line, quantity: qty }]);
    }
    this.persist();
  }

  changeQty(idx: number, delta: number) {
    const list = [...this.lines()];
    const item = list[idx];
    const next = item.quantity + delta;
    if (next < 1) return;
    if (next > item.max_stock) return;
    list[idx] = { ...item, quantity: next };
    this.lines.set(list);
    this.persist();
  }

  remove(idx: number) {
    const list = [...this.lines()];
    list.splice(idx, 1);
    this.lines.set(list);
    this.persist();
  }

  clear() {
    this.lines.set([]);
    this.persist();
  }
}
