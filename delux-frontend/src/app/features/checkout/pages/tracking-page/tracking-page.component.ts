import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShippingService, PublicTracking } from '@shared/services/shipping.service';

@Component({
  selector: 'dlx-tracking-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[1100px] mx-auto px-6 md:px-10 pt-32 pb-24 bg-white dark:bg-ink-950 min-h-screen">
      <p class="eyebrow">/ Tracking</p>
      <h1 class="display-xl text-4xl md:text-6xl mt-4 mb-3 leading-[0.95] text-ink-950 dark:text-white tracking-[-0.03em]">
        Rastrea tu pedido
      </h1>
      <p class="text-ink-700 dark:text-white/60 max-w-xl mb-10">
        Ingresa el código que te enviamos por email cuando despachamos tu compra.
      </p>

      <form (ngSubmit)="search()" class="flex flex-col sm:flex-row gap-3 mb-12 max-w-2xl">
        <input [(ngModel)]="code" name="code" placeholder="DLX-TR-260606-ABCD1234"
               class="flex-1 px-4 py-4 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-200 dark:border-white/10 text-sm font-mono uppercase focus:outline-none focus:border-ink-950 dark:focus:border-white" />
        <button type="submit" [disabled]="!code || loading()"
                class="btn-accent text-sm font-semibold px-8 py-4 disabled:opacity-50">
          @if (loading()) { <i class="fa-solid fa-spinner fa-spin"></i> }
          @else { <i class="fa-solid fa-magnifying-glass"></i> Rastrear }
        </button>
      </form>

      @if (error()) {
        <div class="editorial-card p-6 border-rose-300 dark:border-rose-500/30">
          <p class="text-rose-600"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
        </div>
      }

      @if (tracking(); as t) {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Card de estado actual -->
          <div class="lg:col-span-1">
            <div class="editorial-card p-6">
              <div class="w-16 h-16 rounded-2xl grid place-items-center mb-4"
                   [ngClass]="statusColor(t.status)">
                <i class="fa-solid {{ statusIcon(t.status) }} text-2xl"></i>
              </div>
              <p class="eyebrow">{{ t.carrier }}</p>
              <h2 class="display-xl text-2xl md:text-3xl mt-2 text-ink-950 dark:text-white tracking-[-0.03em]">
                {{ t.status_label }}
              </h2>
              <p class="text-sm text-ink-700 dark:text-white/60 mt-3">
                Destinatario: <span class="font-semibold text-ink-950 dark:text-white">{{ t.recipient_name }}</span>
              </p>
              <p class="text-sm text-ink-700 dark:text-white/60">
                Ciudad: <span class="font-semibold text-ink-950 dark:text-white">{{ t.city }}</span>
              </p>
              @if (t.estimated_delivery) {
                <p class="text-sm text-ink-700 dark:text-white/60 mt-2">
                  Entrega estimada: <span class="font-semibold">{{ t.estimated_delivery | date:'mediumDate' }}</span>
                </p>
              }
              <p class="mt-4 pt-4 border-t border-ink-200 dark:border-white/10 text-xs text-ink-500 dark:text-white/50 font-mono">
                Orden: {{ t.order_code }}<br/>Tracking: {{ t.tracking_code }}
              </p>
            </div>
          </div>

          <!-- Timeline -->
          <div class="lg:col-span-2">
            <div class="editorial-card p-6">
              <h3 class="font-bold text-ink-950 dark:text-white mb-6">Historial</h3>
              @if (t.events.length === 0) {
                <p class="text-ink-500 dark:text-white/50 text-sm">Aún no hay eventos registrados.</p>
              } @else {
                <ol class="relative border-l-2 border-ink-200 dark:border-white/10 ml-3 space-y-6">
                  @for (e of t.events; track e.created_at; let i = $index) {
                    <li class="ml-6">
                      <span class="absolute -left-3 w-6 h-6 rounded-full grid place-items-center"
                            [ngClass]="i === 0 ? statusColor(e.status) : 'bg-ink-200 dark:bg-white/10 text-ink-700 dark:text-white/50'">
                        <i class="fa-solid {{ statusIcon(e.status) }} text-[10px]"></i>
                      </span>
                      <div [class.opacity-60]="i !== 0">
                        <p class="text-[10px] uppercase tracking-widest font-semibold text-ink-500 dark:text-white/50">
                          {{ e.created_at | date:'medium' }}
                        </p>
                        <p class="font-bold text-ink-950 dark:text-white mt-1">{{ e.status_label }}</p>
                        <p class="text-sm text-ink-700 dark:text-white/60">{{ e.description }}</p>
                        @if (e.location) {
                          <p class="text-xs text-ink-500 dark:text-white/40 mt-1">
                            <i class="fa-solid fa-location-dot"></i> {{ e.location }}
                          </p>
                        }
                      </div>
                    </li>
                  }
                </ol>
              }
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class TrackingPageComponent implements OnInit {
  private svc = inject(ShippingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  code = '';
  tracking = signal<PublicTracking | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit() {
    const c = this.route.snapshot.paramMap.get('code') || this.route.snapshot.queryParamMap.get('code');
    if (c) { this.code = c; this.search(); }
  }

  search() {
    if (!this.code) return;
    this.loading.set(true);
    this.error.set(null);
    this.tracking.set(null);
    this.svc.publicTrack(this.code.trim().toUpperCase()).subscribe({
      next: t => { this.tracking.set(t); this.loading.set(false); },
      error: e => {
        this.loading.set(false);
        this.error.set(e?.error?.detail || 'Código no encontrado');
      },
    });
  }

  statusColor(s: string) {
    return ({
      CREATED: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/70',
      PREPARING: 'bg-amber-100 text-amber-700',
      SHIPPED: 'bg-sky-100 text-sky-700',
      IN_TRANSIT: 'bg-violet-100 text-violet-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      FAILED: 'bg-rose-100 text-rose-700',
      RETURNED: 'bg-rose-100 text-rose-700',
    } as any)[s] || 'bg-slate-200 text-slate-700';
  }
  statusIcon(s: string) {
    return ({
      CREATED: 'fa-box',
      PREPARING: 'fa-boxes-packing',
      SHIPPED: 'fa-truck-fast',
      IN_TRANSIT: 'fa-truck',
      DELIVERED: 'fa-circle-check',
      FAILED: 'fa-circle-xmark',
      RETURNED: 'fa-rotate-left',
    } as any)[s] || 'fa-box';
  }
}
