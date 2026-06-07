import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CheckoutService } from '@features/checkout/services/checkout.service';

@Component({
  selector: 'dlx-payphone-sandbox',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-100 dark:from-ink-900 dark:via-ink-950 dark:to-violet-900/20 grid place-items-center p-6">
      <div class="w-full max-w-md bg-white dark:bg-ink-900 rounded-2xl shadow-2xl overflow-hidden">
        <div class="bg-gradient-to-br from-violet-600 to-violet-700 text-white p-6">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">
              <i class="fa-solid fa-mobile-screen text-2xl"></i>
            </div>
            <div>
              <p class="text-xs uppercase tracking-widest text-violet-100">PayPhone Sandbox</p>
              <h1 class="text-xl font-bold">Confirmar pago</h1>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-5">
          <p class="text-sm text-slate-600 dark:text-white/70">
            Estás en modo sandbox. Simula el resultado del pago para probar el flujo de la tienda.
          </p>

          <div class="p-4 rounded-lg bg-slate-50 dark:bg-white/5 space-y-1">
            <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Referencia</p>
            <p class="font-mono text-sm font-bold">{{ reference() }}</p>
          </div>

          <div class="space-y-2">
            <button (click)="confirm(true)" [disabled]="processing()"
                    class="w-full px-5 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm uppercase tracking-widest transition disabled:opacity-50 flex items-center justify-center gap-2">
              @if (processing()) { <i class="fa-solid fa-spinner fa-spin"></i> } @else {
                <i class="fa-solid fa-circle-check"></i> Pago aprobado
              }
            </button>
            <button (click)="confirm(false)" [disabled]="processing()"
                    class="w-full px-5 py-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm uppercase tracking-widest transition disabled:opacity-50 flex items-center justify-center gap-2">
              <i class="fa-solid fa-circle-xmark"></i> Pago rechazado
            </button>
          </div>

          <p class="text-[10px] text-slate-400 text-center mt-2">
            En producción, esta pantalla la maneja PayPhone directamente.
          </p>
        </div>
      </div>
    </section>
  `,
})
export class PayPhoneSandboxComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private checkout = inject(CheckoutService);

  reference = signal('');
  paymentId = signal<number | null>(null);
  processing = signal(false);

  ngOnInit() {
    this.reference.set(this.route.snapshot.queryParamMap.get('ref') || '');
    const pid = this.route.snapshot.queryParamMap.get('payment');
    this.paymentId.set(pid ? +pid : null);
  }

  confirm(success: boolean) {
    if (!this.paymentId()) return;
    this.processing.set(true);
    this.checkout.confirmPayPhone(this.paymentId()!, success).subscribe({
      next: r => {
        this.processing.set(false);
        this.router.navigate(['/checkout/result'], {
          queryParams: { success, code: r.order_code },
        });
      },
      error: () => this.processing.set(false),
    });
  }
}
