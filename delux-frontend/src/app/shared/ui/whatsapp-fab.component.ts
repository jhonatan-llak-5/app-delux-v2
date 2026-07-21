import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandingService } from '@core/services/branding.service';

/** Botón flotante de WhatsApp (esquina inferior derecha). Solo se muestra
 *  si hay un número de WhatsApp configurado en el branding. */
@Component({
  selector: 'dlx-whatsapp-fab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (branding.whatsappNumber()) {
      <a [href]="branding.whatsappLink()" target="_blank" rel="noopener"
         aria-label="Escríbenos por WhatsApp"
         class="fixed bottom-5 right-5 z-[45] flex items-center justify-center
                w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/40
                hover:scale-110 hover:shadow-2xl transition-transform duration-200">
        <span class="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-ping"></span>
        <i class="fa-brands fa-whatsapp text-2xl relative"></i>
      </a>
    }
  `,
})
export class WhatsappFabComponent {
  branding = inject(BrandingService);
}
