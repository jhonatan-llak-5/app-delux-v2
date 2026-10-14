import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { Order } from '@features/superadmin/services/order.service';
import {
  ReceiptBusiness, buildReceiptPayload, printVoucherPDF,
} from '@shared/utils/voucher-pdf.util';

interface PrintConfig {
  mode: 'BROWSER' | 'DIRECT';
  agent_url: string;
  agent_token: string;
}

/** Cuánto se espera a NovaPrint antes de darlo por ausente. */
const PING_TIMEOUT_MS = 1200;
const PRINT_TIMEOUT_MS = 6000;

/**
 * Imprime el comprobante de venta.
 *
 * Dos caminos, los dos terminan en papel:
 *
 *   BROWSER  el de siempre — jsPDF abre el diálogo de impresión.
 *   DIRECT   se manda a NovaPrint, el agente que corre en la PC de caja, y
 *            sale directo a la térmica sin ventana de por medio.
 *
 * La regla de oro: si el agente no está, no responde o devuelve error, se
 * imprime por el navegador igual. Una caja nunca se queda sin poder entregar
 * el comprobante porque un programa auxiliar esté cerrado.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  private http = inject(HttpClient);
  private cfg: PrintConfig | null = null;
  private cfgPromise: Promise<PrintConfig> | null = null;

  /** Último camino usado, para que la pantalla pueda avisar si hubo respaldo. */
  readonly lastFallback = signal(false);

  private async config(): Promise<PrintConfig> {
    if (this.cfg) return this.cfg;
    if (!this.cfgPromise) {
      this.cfgPromise = firstValueFrom(
        this.http.get<PrintConfig>(`${environment.apiUrl}/admin/settings/receipt-print/`)
      ).then(c => (this.cfg = c)).catch(() => {
        // Sin permiso (cliente) o backend viejo: se imprime por el navegador.
        this.cfg = { mode: 'BROWSER', agent_url: '', agent_token: '' };
        return this.cfg;
      });
    }
    return this.cfgPromise;
  }

  /** Olvida la configuración en caché. Lo llama Ajustes al guardar. */
  reload(): void {
    this.cfg = null;
    this.cfgPromise = null;
  }

  /** ¿Está NovaPrint escuchando? Responde rápido para no trabar la venta. */
  private async agentAlive(url: string): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
      const r = await fetch(`${url.replace(/\/+$/, '')}/ping`, { signal: ctrl.signal });
      clearTimeout(t);
      return r.ok;
    } catch {
      return false;
    }
  }

  /**
   * Imprime. Devuelve 'DIRECT' si salió por la térmica y 'BROWSER' si se usó
   * el diálogo (sea porque así está configurado o porque hubo que recurrir a él).
   */
  async print(order: Order, biz?: Partial<ReceiptBusiness>): Promise<'DIRECT' | 'BROWSER'> {
    const cfg = await this.config();
    this.lastFallback.set(false);

    if (cfg.mode !== 'DIRECT' || !cfg.agent_url) {
      printVoucherPDF(order, biz);
      return 'BROWSER';
    }

    const base = cfg.agent_url.replace(/\/+$/, '');
    if (await this.agentAlive(base)) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PRINT_TIMEOUT_MS);
        const r = await fetch(`${base}/print`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-NovaPrint-Token': cfg.agent_token || '',
          },
          body: JSON.stringify(buildReceiptPayload(order, biz)),
        });
        clearTimeout(t);
        if (r.ok) return 'DIRECT';
        console.warn('[NovaPrint] respondió', r.status, '— se imprime por el navegador');
      } catch (e) {
        console.warn('[NovaPrint] no se pudo imprimir en directo:', e);
      }
    }

    // Respaldo: el diálogo de siempre.
    this.lastFallback.set(true);
    printVoucherPDF(order, biz);
    return 'BROWSER';
  }
}
