import { ChangeDetectionStrategy, Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Guía paso a paso (mismo estilo visual que el tour) para configurar la
 * impresora de etiquetas térmica (4BARCODE 4B-2054TA) en Windows.
 *
 * A diferencia del tour general —que resalta elementos del DOM y solo muestra
 * texto— esta guía es un modal propio que incluye "capturas" recreadas en SVG
 * (nítidas, no fotos) de los diálogos de Windows. Queda también como respaldo
 * de referencia para el cliente.
 *
 * Uso desde el padre:
 *   <dlx-printer-setup-guide #guide />
 *   <button (click)="guide.open()">Configurar impresora</button>
 */
@Component({
  selector: 'dlx-printer-setup-guide',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-0 z-[9999] grid place-items-center p-4" role="dialog" aria-modal="true">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-[#020617]/70 backdrop-blur-[1px]" (click)="close()"></div>

        <!-- Tarjeta -->
        <div class="relative w-[620px] max-w-[calc(100vw-2rem)] max-h-[92vh] overflow-hidden
                    bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10
                    rounded-2xl shadow-2xl shadow-black/30 animate-guide-pop flex flex-col">

          <!-- Barra de progreso -->
          <div class="h-1 bg-slate-100 dark:bg-white/10 shrink-0">
            <div class="h-full bg-gradient-to-r from-[var(--dash-primary)] to-[#3b82f6] transition-all duration-300"
                 [style.width.%]="progress()"></div>
          </div>

          <!-- Encabezado -->
          <div class="flex items-start gap-3 px-5 pt-4 shrink-0">
            <div class="w-10 h-10 shrink-0 rounded-xl bg-[var(--dash-primary)]/10 dark:bg-[#3b82f6]/15
                        grid place-items-center text-[var(--dash-primary)] dark:text-[#60a5fa]">
              <i class="fa-solid {{ steps[index()].icon }}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/40">
                Configurar impresora · Paso {{ index() + 1 }} de {{ total }}
              </p>
              <h3 class="font-bold text-[16px] leading-tight text-ink-950 dark:text-white mt-0.5">
                {{ steps[index()].title }}
              </h3>
            </div>
            <button (click)="close()" aria-label="Cerrar"
                    class="w-7 h-7 -mr-1 grid place-items-center rounded-lg text-slate-400
                           hover:text-ink-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition">
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <!-- Cuerpo desplazable -->
          <div class="px-5 py-4 overflow-y-auto">
            <!-- Captura recreada (SVG) -->
            <div class="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
              @switch (index()) {
                @case (0) {
                  <svg viewBox="0 0 620 300" class="w-full block" xmlns="http://www.w3.org/2000/svg">
                    <rect width="620" height="300" fill="#20242e"/>
                    <text x="28" y="42" fill="#e6e9ef" font-family="Segoe UI, Arial" font-size="20" font-weight="700">4BARCODE 4B-2054TA</text>
                    <text x="28" y="76" fill="#c8ccd4" font-family="Segoe UI, Arial" font-size="14" font-weight="600">Administrar el dispositivo</text>
                    <text x="28" y="104" fill="#9aa0ab" font-family="Segoe UI, Arial" font-size="12.5">Estado de la impresora:  Inactivo</text>
                    <text x="28" y="140" fill="#c3c8d1" font-family="Segoe UI, Arial" font-size="13">Abrir cola de impresión</text>
                    <text x="28" y="166" fill="#c3c8d1" font-family="Segoe UI, Arial" font-size="13">Imprimir una página de prueba</text>
                    <text x="28" y="192" fill="#c3c8d1" font-family="Segoe UI, Arial" font-size="13">Ejecutar el solucionador de problemas</text>
                    <text x="28" y="218" fill="#c3c8d1" font-family="Segoe UI, Arial" font-size="13">Propiedades de impresora</text>
                    <!-- resaltado -->
                    <rect x="16" y="230" width="300" height="30" rx="7" fill="#3b82f6" fill-opacity="0.16" stroke="#3b82f6" stroke-width="1.6"/>
                    <text x="28" y="250" fill="#ffffff" font-family="Segoe UI, Arial" font-size="13" font-weight="700">Preferencias de impresión</text>
                    <text x="28" y="286" fill="#c3c8d1" font-family="Segoe UI, Arial" font-size="13">Propiedades de hardware</text>
                    <!-- puntero -->
                    <path d="M340 244 l22 8 -9 3 6 12 -5 2 -6 -12 -6 7 z" fill="#ffffff" stroke="#1f2937" stroke-width="1"/>
                  </svg>
                }
                @case (1) {
                  <svg viewBox="0 0 620 320" class="w-full block" xmlns="http://www.w3.org/2000/svg">
                    <rect width="620" height="320" fill="#f0f0f0"/>
                    <rect x="0" y="0" width="620" height="34" fill="#e7eaf0"/>
                    <text x="16" y="22" fill="#2b3240" font-family="Segoe UI, Arial" font-size="12.5" font-weight="600">Preferencias de impresión de 4BARCODE 4B-2054TA</text>
                    <!-- Tabs -->
                    <rect x="14" y="44" width="120" height="26" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="24" y="61" fill="#1f2937" font-family="Segoe UI, Arial" font-size="12" font-weight="700">Preparar página</text>
                    <text x="150" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Gráficos</text>
                    <text x="224" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Material</text>
                    <text x="292" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Opciones</text>
                    <!-- Grupo Material -->
                    <rect x="14" y="80" width="592" height="118" rx="4" fill="none" stroke="#c4c9d2"/>
                    <text x="26" y="78" fill="#374151" font-family="Segoe UI, Arial" font-size="12" font-weight="600">Material</text>
                    <text x="30" y="112" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Nombre:</text>
                    <rect x="92" y="98" width="450" height="24" rx="3" fill="#fff8d6" stroke="#3b82f6" stroke-width="1.8"/>
                    <text x="102" y="115" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">50 x 30  (50.0 mm x 30.0 mm)</text>
                    <!-- botones -->
                    <rect x="92" y="140" width="120" height="26" rx="4" fill="#eef2ff" stroke="#3b82f6" stroke-width="1.6"/>
                    <text x="126" y="158" fill="#1d4ed8" font-family="Segoe UI, Arial" font-size="12" font-weight="700">Nuevo…</text>
                    <rect x="224" y="140" width="120" height="26" rx="4" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="262" y="158" fill="#374151" font-family="Segoe UI, Arial" font-size="12">Editar…</text>
                    <rect x="356" y="140" width="120" height="26" rx="4" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="392" y="158" fill="#374151" font-family="Segoe UI, Arial" font-size="12">Borrar…</text>
                    <!-- Orientación -->
                    <text x="26" y="228" fill="#374151" font-family="Segoe UI, Arial" font-size="12" font-weight="600">Orientación</text>
                    <circle cx="40" cy="252" r="6" fill="#ffffff" stroke="#3b82f6" stroke-width="1.8"/>
                    <circle cx="40" cy="252" r="3" fill="#3b82f6"/>
                    <text x="56" y="256" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">Vertical</text>
                    <circle cx="180" cy="252" r="6" fill="#ffffff" stroke="#9aa0ab" stroke-width="1.5"/>
                    <text x="196" y="256" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12.5">Horizontal</text>
                    <text x="26" y="298" fill="#6b7280" font-family="Segoe UI, Arial" font-size="11.5" font-style="italic">Ancho 50.0 mm · Alto 30.0 mm</text>
                  </svg>
                }
                @case (2) {
                  <svg viewBox="0 0 620 300" class="w-full block" xmlns="http://www.w3.org/2000/svg">
                    <rect width="620" height="300" fill="#f0f0f0"/>
                    <rect x="0" y="0" width="620" height="34" fill="#e7eaf0"/>
                    <text x="16" y="22" fill="#2b3240" font-family="Segoe UI, Arial" font-size="12.5" font-weight="600">Preferencias de impresión de 4BARCODE 4B-2054TA</text>
                    <!-- Tabs -->
                    <text x="24" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Preparar página</text>
                    <text x="150" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Gráficos</text>
                    <rect x="212" y="44" width="82" height="26" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="224" y="61" fill="#1f2937" font-family="Segoe UI, Arial" font-size="12" font-weight="700">Material</text>
                    <text x="308" y="61" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Opciones</text>
                    <!-- Grupo -->
                    <rect x="14" y="82" width="592" height="150" rx="4" fill="none" stroke="#c4c9d2"/>
                    <text x="26" y="80" fill="#374151" font-family="Segoe UI, Arial" font-size="12" font-weight="600">Valores de material</text>
                    <text x="30" y="116" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Método:</text>
                    <rect x="150" y="102" width="392" height="24" rx="3" fill="#fff8d6" stroke="#3b82f6" stroke-width="1.8"/>
                    <text x="160" y="119" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">Térmica directa</text>
                    <path d="M527 110 l10 0 -5 8 z" fill="#374151"/>
                    <text x="30" y="156" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Tipo:</text>
                    <rect x="150" y="142" width="392" height="24" rx="3" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="160" y="159" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5">Etiquetas con espacios</text>
                    <path d="M527 150 l10 0 -5 8 z" fill="#374151"/>
                    <text x="30" y="196" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Altura del espacio:</text>
                    <rect x="150" y="182" width="90" height="24" rx="3" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="160" y="199" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5">3.0 mm</text>
                    <text x="26" y="264" fill="#6b7280" font-family="Segoe UI, Arial" font-size="11.5" font-style="italic">La impresora usa rollo térmico (sin tinta) con separación entre etiquetas.</text>
                  </svg>
                }
                @case (3) {
                  <svg viewBox="0 0 620 260" class="w-full block" xmlns="http://www.w3.org/2000/svg">
                    <rect width="620" height="260" fill="#f0f0f0"/>
                    <rect x="0" y="0" width="620" height="34" fill="#e7eaf0"/>
                    <text x="16" y="22" fill="#2b3240" font-family="Segoe UI, Arial" font-size="12.5" font-weight="600">Preferencias de impresión de 4BARCODE 4B-2054TA</text>
                    <rect x="20" y="70" width="580" height="96" rx="6" fill="#ffffff" stroke="#dfe3ea"/>
                    <text x="44" y="112" fill="#374151" font-family="Segoe UI, Arial" font-size="13">Se guardan el material 50×30 y el método térmico.</text>
                    <text x="44" y="136" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">Windows recordará esta configuración para la impresora.</text>
                    <!-- footer botones -->
                    <rect x="300" y="200" width="92" height="30" rx="4" fill="#eef2ff" stroke="#3b82f6" stroke-width="1.8"/>
                    <text x="330" y="220" fill="#1d4ed8" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">Aceptar</text>
                    <rect x="402" y="200" width="92" height="30" rx="4" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="428" y="220" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Cancelar</text>
                    <rect x="504" y="200" width="92" height="30" rx="4" fill="#eef2ff" stroke="#3b82f6" stroke-width="1.8"/>
                    <text x="534" y="220" fill="#1d4ed8" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">Aplicar</text>
                  </svg>
                }
                @default {
                  <svg viewBox="0 0 620 280" class="w-full block" xmlns="http://www.w3.org/2000/svg">
                    <rect width="620" height="280" fill="#ffffff"/>
                    <rect x="0" y="0" width="620" height="40" fill="#f3f4f6"/>
                    <text x="20" y="26" fill="#111827" font-family="Segoe UI, Arial" font-size="13" font-weight="700">Imprimir</text>
                    <text x="440" y="26" fill="#6b7280" font-family="Segoe UI, Arial" font-size="12">2 hojas de papel</text>
                    <!-- Destino -->
                    <text x="30" y="86" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Destino</text>
                    <rect x="30" y="98" width="340" height="30" rx="4" fill="#fff8d6" stroke="#3b82f6" stroke-width="1.8"/>
                    <text x="42" y="118" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">4BARCODE 4B-2054TA</text>
                    <path d="M352 111 l10 0 -5 8 z" fill="#374151"/>
                    <text x="30" y="160" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Páginas</text>
                    <rect x="30" y="172" width="340" height="30" rx="4" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="42" y="192" fill="#111827" font-family="Segoe UI, Arial" font-size="12.5">Todo</text>
                    <!-- vista previa etiqueta -->
                    <rect x="410" y="70" width="170" height="140" rx="6" fill="#f9fafb" stroke="#e5e7eb"/>
                    <rect x="426" y="86" width="138" height="24" rx="3" fill="#ffffff" stroke="#e5e7eb"/>
                    <text x="434" y="103" fill="#111827" font-family="Segoe UI, Arial" font-size="9" font-weight="800">DELUX</text>
                    <rect x="512" y="88" width="46" height="20" fill="#000000"/>
                    <text x="518" y="102" fill="#ffffff" font-family="Segoe UI, Arial" font-size="10" font-weight="800">$25.00</text>
                    <g fill="#111827">
                      <rect x="430" y="120" width="3" height="34"/><rect x="436" y="120" width="2" height="34"/><rect x="441" y="120" width="4" height="34"/><rect x="448" y="120" width="2" height="34"/><rect x="453" y="120" width="3" height="34"/><rect x="459" y="120" width="5" height="34"/><rect x="467" y="120" width="2" height="34"/><rect x="472" y="120" width="3" height="34"/><rect x="478" y="120" width="4" height="34"/><rect x="485" y="120" width="2" height="34"/><rect x="490" y="120" width="3" height="34"/><rect x="496" y="120" width="5" height="34"/><rect x="504" y="120" width="2" height="34"/><rect x="509" y="120" width="4" height="34"/><rect x="516" y="120" width="2" height="34"/><rect x="521" y="120" width="3" height="34"/><rect x="527" y="120" width="4" height="34"/><rect x="534" y="120" width="2" height="34"/><rect x="539" y="120" width="3" height="34"/><rect x="545" y="120" width="5" height="34"/><rect x="553" y="120" width="2" height="34"/>
                    </g>
                    <text x="495" y="170" fill="#111827" font-family="Segoe UI, Arial" font-size="8" text-anchor="middle">P00000050</text>
                    <text x="495" y="182" fill="#111827" font-family="Segoe UI, Arial" font-size="8" text-anchor="middle" font-weight="600">Zapatillas VENUS</text>
                    <!-- botones -->
                    <rect x="410" y="228" width="80" height="30" rx="4" fill="#2563eb"/>
                    <text x="436" y="248" fill="#ffffff" font-family="Segoe UI, Arial" font-size="12.5" font-weight="700">Imprimir</text>
                    <rect x="500" y="228" width="80" height="30" rx="4" fill="#ffffff" stroke="#c4c9d2"/>
                    <text x="524" y="248" fill="#374151" font-family="Segoe UI, Arial" font-size="12.5">Cancelar</text>
                  </svg>
                }
              }
            </div>

            <!-- Texto del paso -->
            <p class="text-[13.5px] leading-relaxed text-slate-600 dark:text-white/70 mt-4"
               [innerHTML]="steps[index()].body"></p>

            <!-- Dots -->
            <div class="flex items-center gap-1.5 mt-4">
              @for (s of steps; track $index) {
                <button (click)="goTo($index)" [attr.aria-label]="'Ir al paso ' + ($index + 1)"
                        class="h-1.5 rounded-full transition-all"
                        [class.w-5]="$index === index()" [class.w-1.5]="$index !== index()"
                        [style.background]="$index === index() ? '#3b82f6' : 'rgba(148,163,184,0.4)'"></button>
              }
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-white/10 shrink-0">
            <button (click)="close()"
                    class="text-[12.5px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-white/70 transition">
              Cerrar
            </button>
            <div class="flex items-center gap-2">
              @if (!isFirst()) {
                <button (click)="prev()"
                        class="h-9 px-3.5 rounded-lg text-[13px] font-semibold text-slate-600 dark:text-white/70
                               hover:bg-slate-100 dark:hover:bg-white/10 transition">
                  Atrás
                </button>
              }
              <button (click)="next()"
                      class="h-9 px-4 rounded-lg text-[13px] font-semibold text-white
                             bg-[var(--dash-primary)] hover:bg-[var(--dash-primary-d)] transition
                             inline-flex items-center gap-2">
                {{ isLast() ? 'Entendido' : 'Siguiente' }}
                <i class="fa-solid {{ isLast() ? 'fa-check' : 'fa-arrow-right' }} text-[11px]"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes guide-pop {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    .animate-guide-pop { animation: guide-pop .22s cubic-bezier(.16,1,.3,1); }
  `],
})
export class PrinterSetupGuideComponent {
  visible = signal(false);
  index = signal(0);

  readonly steps = [
    {
      icon: 'fa-print',
      title: 'Abre las preferencias de la impresora',
      body: 'En Windows entra en <b>Configuración → Bluetooth y dispositivos → Impresoras y escáneres</b>, elige <b>«4BARCODE 4B-2054TA»</b> y abre <b>«Preferencias de impresión»</b>. Solo hay que hacerlo una vez por computador.',
    },
    {
      icon: 'fa-ruler-combined',
      title: 'Crea el material de 50 × 30 mm',
      body: 'En la pestaña <b>«Preparar página»</b>, junto a <b>Material</b> pulsa <b>«Nuevo…»</b> y crea uno con <b>Ancho 50.0 mm</b> y <b>Alto 30.0 mm</b>. Ponle de nombre «50 x 30». En <b>Orientación</b> deja <b>«Vertical»</b>. <i>(Esta es la medida real de la etiqueta del sistema.)</i>',
    },
    {
      icon: 'fa-fire',
      title: 'Método: Térmica directa',
      body: 'Ve a la pestaña <b>«Material»</b>. En <b>Método</b> selecciona <b>«Térmica directa»</b> y en <b>Tipo</b> «Etiquetas con espacios» (separación ≈ 3 mm). Esta impresora no usa tinta.',
    },
    {
      icon: 'fa-floppy-disk',
      title: 'Guarda la configuración',
      body: 'Pulsa <b>«Aplicar»</b> y luego <b>«Aceptar»</b>. La configuración queda guardada en Windows para esta impresora, así no tendrás que repetirla.',
    },
    {
      icon: 'fa-tags',
      title: 'Imprime desde aquí',
      body: 'Selecciona los productos y pulsa <b>«Imprimir»</b>. En el diálogo del navegador elige como destino <b>«4BARCODE 4B-2054TA»</b> y confirma. ¡Listo! Las etiquetas saldrán con el tamaño correcto.',
    },
  ];
  readonly total = this.steps.length;

  open(): void { this.index.set(0); this.visible.set(true); }
  close(): void { this.visible.set(false); }
  next(): void { this.index() < this.total - 1 ? this.index.update(i => i + 1) : this.close(); }
  prev(): void { if (this.index() > 0) this.index.update(i => i - 1); }
  goTo(i: number): void { this.index.set(i); }
  isFirst(): boolean { return this.index() === 0; }
  isLast(): boolean { return this.index() === this.total - 1; }
  progress(): number { return ((this.index() + 1) / this.total) * 100; }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (!this.visible()) return;
    if (ev.key === 'Escape') this.close();
    else if (ev.key === 'ArrowRight') this.next();
    else if (ev.key === 'ArrowLeft') this.prev();
  }
}
