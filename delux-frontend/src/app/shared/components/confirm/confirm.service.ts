import { Injectable, computed, signal } from '@angular/core';

export type ConfirmVariant = 'info' | 'warning' | 'danger' | 'success';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: string;
}

interface ActiveConfirm extends Required<Omit<ConfirmOptions, 'icon'>> {
  icon?: string;
}

/**
 * Servicio global de confirmación.
 *
 *   const ok = await this.confirm.ask({
 *     title: 'Eliminar producto',
 *     message: '¿Seguro? No se puede deshacer.',
 *     variant: 'danger', confirmText: 'Eliminar',
 *   });
 *   if (!ok) return;
 *
 * Reemplaza a window.confirm() con un modal elegante y consistente.
 * El host (<dlx-confirm-host />) se monta una sola vez en la raíz.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _open = signal(false);
  private _opts = signal<ActiveConfirm | null>(null);
  private _loading = signal(false);
  private resolver?: (v: boolean) => void;

  readonly open = computed(() => this._open());
  readonly opts = computed(() => this._opts());
  readonly loading = computed(() => this._loading());

  ask(options: ConfirmOptions): Promise<boolean> {
    this._opts.set({
      title: options.title,
      message: options.message ?? '',
      confirmText: options.confirmText ?? 'Confirmar',
      cancelText: options.cancelText ?? 'Cancelar',
      variant: options.variant ?? 'warning',
      icon: options.icon,
    });
    this._loading.set(false);
    this._open.set(true);
    return new Promise<boolean>((resolve) => { this.resolver = resolve; });
  }

  /** Botón confirmar. */
  accept(): void { this.close(true); }
  /** Botón cancelar / backdrop / Esc. */
  cancel(): void { this.close(false); }

  private close(value: boolean): void {
    this._open.set(false);
    const r = this.resolver;
    this.resolver = undefined;
    r?.(value);
  }
}
