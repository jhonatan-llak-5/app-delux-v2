import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BrandingService } from '@core/services/branding.service';

@Component({
  selector: 'dlx-affiliate-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-[820px] mx-auto px-6 md:px-10 py-16 md:py-24">
      <div class="mb-10">
        <span class="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10
                     px-4 py-1.5 text-[12px] font-semibold tracking-widest uppercase text-emerald-600 dark:text-emerald-400 mb-5">
          <i class="fa-solid fa-hand-holding-dollar"></i> Programa de afiliados
        </span>
        <h1 class="font-bold text-[34px] md:text-[46px] tracking-[-0.03em] leading-[1.1] text-ink-950 dark:text-white">
          Términos del programa de afiliados
        </h1>
        <p class="text-ink-600 dark:text-white/55 text-[16px] mt-4 leading-relaxed">
          Gana comisiones compartiendo productos de {{ platform() }}. Estos son los términos que rigen el programa.
        </p>
      </div>

      <div class="space-y-8 text-ink-700 dark:text-white/70 text-[15px] leading-relaxed">
        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">1. Quién puede participar</h2>
          <p>Cualquier persona puede registrarse como Vendedor Afiliado creando una cuenta gratuita y verificando su correo con el código de activación. Al activarse recibes un código único de afiliado (por ejemplo, VEND0001).</p>
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">2. Cómo ganas comisiones</h2>
          <p>Comparte los enlaces de productos que incluyen tu código. Cuando un cliente compra a través de tu enlace, la venta se atribuye a ti y ganas una comisión del <strong class="text-emerald-600 dark:text-emerald-400">{{ rate() }}%</strong> sobre el valor de los productos del pedido.</p>
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">3. Atribución (últimos 30 días)</h2>
          <p>La atribución funciona por "último clic": si un cliente usa tu enlace, tu código queda registrado en su dispositivo por 30 días. Si otro afiliado comparte un enlace más reciente que el cliente use, la venta se atribuye a ese último enlace.</p>
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">4. Cuándo se aprueba la comisión</h2>
          <p>La comisión se genera automáticamente cuando el pedido se marca como <strong>Pagado</strong> o <strong>Entregado</strong>. Si el pedido se cancela o se devuelve, la comisión asociada se anula.</p>
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">5. Pago de comisiones</h2>
          <p>Los pagos son procesados manualmente por la tienda (en efectivo o transferencia) y quedan registrados en tu historial. Cuando recibes un pago, te notificamos por correo.</p>
          @if (minPayout() > 0) {
            <p class="mt-2">El monto mínimo acumulado para solicitar un pago es de <strong>{{ money(minPayout()) }}</strong>.</p>
          }
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">6. Buenas prácticas</h2>
          <p>No está permitido el spam, la publicidad engañosa ni el uso de marcas de terceros de forma indebida. El incumplimiento puede resultar en la suspensión de la cuenta y la anulación de comisiones pendientes.</p>
        </div>

        <div>
          <h2 class="font-bold text-[19px] text-ink-950 dark:text-white mb-2">7. Cambios en el programa</h2>
          <p>{{ platform() }} puede actualizar el porcentaje de comisión, el mínimo de pago y estos términos en cualquier momento. Las comisiones ya generadas conservan el porcentaje con el que fueron creadas.</p>
        </div>
      </div>

      <div class="mt-12 flex flex-col sm:flex-row gap-3">
        <a [routerLink]="['/auth/register']" [queryParams]="{ type: 'affiliate' }"
           class="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full
                  bg-emerald-500 text-white font-bold text-[15px] hover:bg-emerald-400 transition">
          Quiero ser afiliado
          <i class="fa-solid fa-arrow-right"></i>
        </a>
        <a routerLink="/"
           class="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full
                  border border-ink-300 dark:border-white/20 text-ink-950 dark:text-white font-semibold text-[15px]
                  hover:border-ink-950 dark:hover:border-white transition">
          Volver al inicio
        </a>
      </div>
    </section>
  `,
})
export class AffiliateTermsComponent {
  private branding = inject(BrandingService);
  platform = () => this.branding.siteName();
  rate = () => this.branding.affiliateCommissionRate();
  minPayout = () => this.branding.affiliateMinPayout();
  money(v: number): string { return '$' + (Math.round((v || 0) * 100) / 100).toFixed(2); }
}
