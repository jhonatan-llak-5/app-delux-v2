import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { KioskService, KioskProduct, KioskSearchItem, KioskFeatured } from './kiosk.service';
import { KioskResultCardComponent } from './components/kiosk-result-card.component';
import { BrandingService } from '@core/services/branding.service';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'dlx-kiosk',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, KioskResultCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-[#0a0e17] text-slate-900 dark:text-white transition-colors">

      @if (locked()) {
        <div class="flex-1 grid place-items-center p-6">
          <div class="w-full max-w-sm text-center rounded-3xl p-10
                      bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl">
            <div class="w-16 h-16 rounded-2xl mx-auto mb-5 grid place-items-center
                        bg-gradient-to-br from-[#1e40af] to-[#3b82f6] text-white shadow-lg shadow-[#1e40af]/30">
              <i class="fa-solid fa-lock text-2xl"></i>
            </div>
            <h2 class="text-xl font-bold">Kiosko bloqueado</h2>
            <p class="text-sm text-slate-500 dark:text-white/50 mb-5">Ingresa el PIN de {{ branchName() || 'la sucursal' }}.</p>
            <input [(ngModel)]="pin" (keyup.enter)="unlock()" type="password" inputmode="numeric"
                   class="w-full h-14 text-center text-3xl tracking-[0.5em] rounded-2xl
                          bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/15
                          text-slate-900 dark:text-white focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20"
                   placeholder="••••" />
            @if (pinError()) { <p class="text-rose-500 text-sm mt-3">{{ pinError() }}</p> }
            <button (click)="unlock()"
                    class="w-full h-14 mt-5 rounded-2xl text-white font-bold text-lg
                           bg-gradient-to-r from-[#1e40af] to-[#2563eb] hover:from-[#1d4ed8] hover:to-[#3b82f6] transition shadow-lg shadow-[#1e40af]/25">
              Desbloquear
            </button>
          </div>
        </div>
      } @else {
        <!-- Header flotante (solo en maximizado; aparece al pasar el mouse por arriba) -->
        @if (expanded() && !lightboxOpen()) {
          <div class="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-72 h-12 group">
            <div class="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-slate-300/70 dark:bg-white/25 group-hover:opacity-0 transition-opacity"></div>
            <div class="fixed top-0 left-0 right-0 px-5 py-3 flex items-center justify-between gap-3
                        bg-white/85 dark:bg-[#0d1320]/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/10 shadow-lg
                        -translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <div class="flex items-center gap-3 min-w-0">
                @if (branding.logoUrl()) {
                  <img [src]="branding.logoUrl()" [alt]="branding.siteName()" class="h-8 w-auto object-contain dark:hidden" />
                  <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()" class="h-8 w-auto object-contain hidden dark:block" />
                }
                @if (branchName()) { <span class="text-xs text-slate-500 dark:text-white/40 truncate">{{ branchName() }}</span> }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button (click)="openSearch()" title="Buscar" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition"><i class="fa-solid fa-magnifying-glass"></i></button>
                <button (click)="cameraOn() ? stopCamera() : startCamera()" title="Escanear" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition"><i class="fa-solid" [class.fa-camera]="!cameraOn()" [class.fa-xmark]="cameraOn()"></i></button>
                <button (click)="theme.toggle()" title="Tema claro/oscuro" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition"><i class="fa-solid" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i></button>
                <button (click)="goHome()" title="Inicio del kiosko" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition"><i class="fa-solid fa-house"></i></button>
                <button (click)="toggleExpand()" title="Minimizar" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition"><i class="fa-solid fa-compress"></i></button>
              </div>
            </div>
          </div>
        }

        <div [ngClass]="expanded()
               ? 'fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-[#0a0e17] px-3 sm:px-5 lg:px-8 py-3'
               : 'w-full max-w-[1500px] mx-auto px-4 md:px-8 pt-5 pb-8'">
          <!-- Barra superior (solo modo normal) -->
          @if (!expanded()) {
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3 min-w-0">
              @if (branding.logoUrl()) {
                <img [src]="branding.logoUrl()" [alt]="branding.siteName()" class="h-8 w-auto object-contain dark:hidden" />
                <img [src]="branding.logoUrlDark()" [alt]="branding.siteName()" class="h-8 w-auto object-contain hidden dark:block" />
              }
              @if (branchName()) {
                <span class="text-xs text-slate-500 dark:text-white/40 truncate">{{ branchName() }}</span>
              }
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button (click)="theme.toggle()" title="Tema claro/oscuro" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition">
                <i class="fa-solid" [class.fa-sun]="theme.isDark()" [class.fa-moon]="!theme.isDark()"></i>
              </button>
              <button (click)="goHome()" title="Inicio del kiosko" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition">
                <i class="fa-solid fa-house"></i>
              </button>
              <button (click)="toggleExpand()" title="Maximizar" class="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20 transition">
                <i class="fa-solid fa-expand"></i>
              </button>
            </div>
          </div>
          }

          <!-- Búsqueda + escaneo -->
          @if (!expanded()) {
          <div class="flex flex-col sm:flex-row gap-3 mb-7">
            <div class="relative flex-1">
              <i class="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 text-lg"></i>
              <input [(ngModel)]="query" (keyup.enter)="doSearch()"
                     class="w-full h-16 pl-14 pr-4 rounded-2xl text-lg
                            bg-white dark:bg-white/5 border border-slate-300 dark:border-white/15
                            text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40
                            focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20 transition"
                     placeholder="Busca por nombre, descripción o código…" autofocus />
            </div>
            <button (click)="doSearch()"
                    class="h-16 px-8 rounded-2xl text-white font-bold text-lg shadow-lg shadow-[#1e40af]/25
                           bg-gradient-to-r from-[#1e40af] to-[#2563eb] hover:from-[#1d4ed8] hover:to-[#3b82f6] transition">
              Buscar
            </button>
            <button (click)="cameraOn() ? stopCamera() : startCamera()"
                    class="h-16 px-8 rounded-2xl font-bold text-lg inline-flex items-center justify-center gap-2 transition
                           border-2 border-[#1e40af] text-[#1e40af] dark:text-[#7aa2ff] dark:border-[#3b82f6]
                           hover:bg-[#1e40af]/5 dark:hover:bg-[#3b82f6]/10">
              <i class="fa-solid" [class.fa-camera]="!cameraOn()" [class.fa-xmark]="cameraOn()"></i>
              {{ cameraOn() ? 'Cerrar' : 'Escanear' }}
            </button>
          </div>
          }

          <!-- Cámara -->
          @if (cameraOn()) {
            <div class="rounded-3xl overflow-hidden bg-black mb-7 relative shadow-2xl">
              <video #video class="w-full max-h-[55vh] object-contain" muted playsinline></video>
              <div class="absolute inset-0 border-4 border-white/30 m-12 rounded-2xl pointer-events-none"></div>
              <p class="absolute bottom-3 left-0 right-0 text-center text-white/80">Apunta al código de barras o QR</p>
            </div>
          }
          @if (camError()) {
            <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 mb-7">
              <i class="fa-solid fa-triangle-exclamation"></i> {{ camError() }}
            </div>
          }

          @if (loading()) {
            <div class="text-center text-slate-400 dark:text-white/40 py-16"><i class="fa-solid fa-spinner fa-spin text-3xl"></i></div>
          }

          <!-- Modo atracción (carrusel) -->
          @if (showAttract()) {
            <div class="relative w-full overflow-hidden rounded-[2rem] cursor-pointer select-none bg-ink-950"
                 [ngClass]="expanded() ? 'min-h-[calc(100vh-1.5rem)]' : 'min-h-[80vh]'"
                 (click)="featured()[slide()] && loadById(featured()[slide()].id)">
              <!-- Fondo degradado editorial -->
              <div class="absolute inset-0" style="background:radial-gradient(120% 120% at 15% 10%, #3b1d8f 0%, #1a1145 45%, #0a0a18 100%)"></div>
              <div class="absolute -left-32 top-1/4 w-[30rem] h-[30rem] rounded-full bg-violet-600/30 blur-[130px]"></div>
              <div class="absolute right-0 -bottom-28 w-[28rem] h-[28rem] rounded-full bg-fuchsia-600/20 blur-[130px]"></div>

              @for (p of featured(); track p.id; let i = $index) {
                <div class="absolute inset-0 transition-opacity duration-700 flex items-center"
                     [class.opacity-100]="i === slide()" [class.opacity-0]="i !== slide()"
                     [class.pointer-events-none]="i !== slide()">
                  <div class="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 items-center px-8 md:px-16 py-16">
                    <!-- Imagen -->
                    <div class="relative order-2 lg:order-1 grid place-items-center min-h-[16rem]">
                      <span class="absolute z-0 font-black text-white/[0.06] leading-none select-none text-[12rem] md:text-[20rem]">{{ pad2(i + 1) }}</span>
                      <div class="relative z-10 w-[82%] max-w-md aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 rotate-[-3deg]">
                        @if (p.image) { <img [src]="p.image" [alt]="p.name" class="w-full h-full object-cover" (error)="onImgErr($event)" /> }
                        @else { <div class="w-full h-full grid place-items-center bg-white/5"><i class="fa-solid fa-box text-6xl text-white/15"></i></div> }
                      </div>
                    </div>
                    <!-- Texto -->
                    <div class="order-1 lg:order-2 text-white">
                      <div class="flex items-center gap-3 mb-5">
                        <span class="h-px w-12 bg-white/40"></span>
                        <span class="text-xs font-bold tracking-[0.4em] text-white/60 uppercase">Destacado</span>
                      </div>
                      <p class="text-sm md:text-base uppercase tracking-[0.3em] text-violet-300/80 mb-3">{{ p.brand }}</p>
                      <h3 class="text-5xl md:text-7xl font-black leading-[0.95] drop-shadow-xl">{{ p.name }}</h3>
                      <div class="mt-7">
                        <p class="text-[11px] uppercase tracking-[0.3em] text-white/50">Precio</p>
                        <p class="text-4xl md:text-6xl font-black mt-1">{{ money(withIva(p.base_price)) }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              }

              @if (featured().length > 1) {
                <button (click)="$event.stopPropagation(); prevSlide()" title="Anterior"
                        class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 grid place-items-center rounded-full
                               bg-white/10 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-xl transition">
                  <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button (click)="$event.stopPropagation(); nextSlide()" title="Siguiente"
                        class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 grid place-items-center rounded-full
                               bg-white/10 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-xl transition">
                  <i class="fa-solid fa-chevron-right"></i>
                </button>
              }
              <span class="absolute top-6 left-6 z-20 text-white/85 text-sm bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/15">
                <i class="fa-solid fa-hand-pointer"></i> Toca un producto para ver su stock
              </span>
              <div class="absolute bottom-6 left-0 right-0 z-20 flex justify-center flex-wrap gap-2 px-6">
                @for (p of featured(); track p.id; let i = $index) {
                  <button (click)="$event.stopPropagation(); goToSlide(i)" title="Ir al producto {{ i + 1 }}"
                          class="h-2.5 rounded-full transition-all" [ngClass]="i === slide() ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'"></button>
                }
              </div>
            </div>
            <p class="text-center text-slate-400 dark:text-white/40 mt-6">Escanea o busca un producto para ver precio y stock.</p>
          }

          <!-- Detalle de producto -->
          @if (detail(); as d) {
            @if (d.found) {
              <div class="rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10">
                <!-- Hero -->
                <div class="flex flex-col md:flex-row">
                  <div class="md:w-96 lg:w-[28rem] shrink-0 relative min-h-[22rem] grid place-items-center overflow-hidden group
                              bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/5 dark:to-white/[0.02]"
                       [class.cursor-zoom-in]="galleryImages(d).length > 0"
                       (click)="galleryImages(d).length && openLightbox(galleryImages(d), 0)">
                    @if (d.image) { <img [src]="d.image" [alt]="d.name" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" (error)="onImgErr($event)" /> }
                    @else { <i class="fa-solid fa-box text-7xl text-slate-300 dark:text-white/15"></i> }
                    @if (galleryImages(d).length) {
                      <span class="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur
                                   bg-black/45 text-white flex items-center gap-1.5 opacity-90">
                        <i class="fa-solid fa-magnifying-glass-plus"></i>
                        @if (galleryImages(d).length > 1) { {{ galleryImages(d).length }} fotos } @else { Ampliar }
                      </span>
                    }
                    <span class="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur shadow"
                          [ngClass]="(d.total_available || 0) > 0 ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'">
                      <i class="fa-solid" [class.fa-circle-check]="(d.total_available || 0) > 0" [class.fa-circle-xmark]="(d.total_available || 0) === 0"></i>
                      {{ (d.total_available || 0) > 0 ? 'Disponible' : 'Agotado' }}
                    </span>
                  </div>
                  <div class="p-7 md:p-9 flex-1 flex flex-col">
                    <p class="text-xs uppercase tracking-[0.25em] text-[#1e40af] dark:text-[#7aa2ff] font-bold">{{ d.brand }} · {{ d.category }}</p>
                    <h2 class="text-3xl md:text-4xl lg:text-5xl font-black mt-2 leading-[1.05]">{{ d.name }}</h2>
                    @if (d.description) { <p class="text-slate-500 dark:text-white/50 mt-3 leading-relaxed max-w-prose">{{ d.description }}</p> }

                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-auto pt-6">
                      <div class="rounded-2xl p-4 bg-gradient-to-br from-[#1e40af] to-[#2563eb] text-white shadow-lg shadow-[#1e40af]/20">
                        <p class="text-[11px] uppercase tracking-widest text-white/70">Precio</p>
                        <p class="text-3xl md:text-4xl font-black mt-1 leading-none">{{ money(withIva(d.base_price)) }}</p>
                        @if (taxRate() > 0) { <p class="text-[10px] text-white/60 mt-1">IVA {{ taxRate() }}% incl.</p> }
                      </div>
                      <div class="rounded-2xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <p class="text-[11px] uppercase tracking-widest text-slate-400 dark:text-white/40">Disponible</p>
                        <p class="text-3xl md:text-4xl font-black mt-1 leading-none"
                           [ngClass]="(d.total_available || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">{{ d.total_available }}</p>
                        <p class="text-[10px] text-slate-400 dark:text-white/40 mt-1">unidades</p>
                      </div>
                      <div class="rounded-2xl p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 col-span-2 sm:col-span-1">
                        <p class="text-[11px] uppercase tracking-widest text-slate-400 dark:text-white/40">Variantes</p>
                        <p class="text-3xl md:text-4xl font-black mt-1 leading-none">{{ (d.variants || []).length }}</p>
                        <p class="text-[10px] text-slate-400 dark:text-white/40 mt-1">tallas / colores</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Existencias -->
                <div class="border-t border-slate-100 dark:border-white/10 p-6 md:p-7 bg-slate-50/60 dark:bg-black/10">
                  <p class="text-sm font-bold text-slate-600 dark:text-white/70 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <i class="fa-solid fa-warehouse text-[#1e40af] dark:text-[#7aa2ff]"></i> Existencias por talla
                  </p>
                  <div class="space-y-2.5">
                    @for (v of d.variants || []; track v.id) {
                      <div class="rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center gap-3"
                           [ngClass]="v.id === d.matched_variant_id
                             ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 ring-1 ring-amber-300 dark:ring-amber-500/30'
                             : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'">
                        <div class="flex items-center gap-3 sm:w-56 shrink-0">
                          <div class="w-11 h-11 rounded-xl grid place-items-center font-bold text-sm shrink-0"
                               [ngClass]="v.available > 0 ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-white/10 text-slate-400'">
                            {{ v.size || '—' }}
                          </div>
                          <div class="min-w-0">
                            <p class="font-bold truncate">{{ v.color || 'Único' }}</p>
                            @if (v.id === d.matched_variant_id) {
                              <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400"><i class="fa-solid fa-barcode"></i> Escaneado</span>
                            }
                          </div>
                        </div>
                        <div class="sm:w-28 shrink-0">
                          <p class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/40">Precio</p>
                          <p class="font-extrabold text-[#1e40af] dark:text-[#7aa2ff]">{{ money(withIva(v.price)) }}</p>
                        </div>
                        <div class="sm:w-24 shrink-0">
                          <p class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/40">Disp.</p>
                          <p class="font-extrabold" [ngClass]="v.available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">{{ v.available }} u.</p>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex flex-wrap gap-1.5">
                            @for (s of v.stocks; track s.branch) {
                              <span class="px-2.5 py-1 rounded-full text-xs font-medium"
                                    [ngClass]="s.available > 0 ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-white/40'">
                                {{ s.branch }}: {{ s.available }}
                              </span>
                            }
                            @if (!v.stocks.length) { <span class="text-slate-400 dark:text-white/30 text-xs">Sin stock</span> }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </div>
              <button (click)="clear()" class="mt-5 text-[#1e40af] dark:text-[#7aa2ff] font-bold inline-flex items-center gap-2 hover:underline">
                <i class="fa-solid fa-arrow-left"></i> Nueva consulta
              </button>
            } @else {
              <div class="text-center py-16 text-slate-400 dark:text-white/40">
                <i class="fa-solid fa-circle-question text-5xl mb-4"></i>
                <p class="text-lg">No encontramos el producto{{ d.code ? ' con código ' + d.code : '' }}.</p>
                <button (click)="clear()" class="mt-4 text-[#1e40af] dark:text-[#7aa2ff] font-bold hover:underline">Intentar de nuevo</button>
              </div>
            }
          }

          <!-- Resultados de búsqueda -->
          @if (!detail() && results().length) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              @for (r of results(); track r.id) {
                <dlx-kiosk-result-card [item]="r" (select)="loadById(r.id)" />
              }
            </div>
          }

          @if (!detail() && !results().length && !loading() && searched()) {
            <p class="text-center text-slate-400 dark:text-white/40 py-16 text-lg">Sin resultados. Prueba con otro nombre o código.</p>
          }

          <!-- Popup de búsqueda (typeahead) -->
          @if (searchOpen()) {
            <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-10" (click)="closeSearch()">
              <div class="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
                   (click)="$event.stopPropagation()">
                <div class="relative border-b border-slate-100 dark:border-white/10">
                  <i class="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 text-lg"></i>
                  <input #popupInput [(ngModel)]="query" (ngModelChange)="onSearchType($event)" (keyup.enter)="doSearch(); closeSearch()"
                         class="w-full h-16 pl-14 pr-12 text-lg bg-transparent text-slate-900 dark:text-white
                                placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none"
                         placeholder="Busca por nombre, descripción o código…" autofocus />
                  <button (click)="closeSearch()" class="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="max-h-[60vh] overflow-y-auto">
                  @if (loading()) {
                    <div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
                  } @else if (results().length) {
                    @for (r of results(); track r.id) {
                      <dlx-kiosk-result-card [item]="r" [compact]="true" (select)="loadById(r.id); closeSearch()" />
                    }
                  } @else if (searched()) {
                    <p class="p-8 text-center text-slate-400 dark:text-white/40">Sin resultados.</p>
                  } @else {
                    <p class="p-8 text-center text-slate-400 dark:text-white/40">Escribe para buscar un producto.</p>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Lightbox / álbum de galería -->
          @if (lightboxOpen()) {
            <div class="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col" (click)="closeLightbox()">
              <!-- Barra superior -->
              <div class="flex items-center justify-between px-5 py-4 text-white/90" (click)="$event.stopPropagation()">
                <span class="text-sm font-semibold tracking-wide">{{ lightboxIndex() + 1 }} / {{ lightboxImages().length }}</span>
                <div class="flex items-center gap-2">
                  <button (click)="lbZoomToggle()" [title]="lbZoom() ? 'Alejar' : 'Acercar'"
                          class="w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition">
                    <i class="fa-solid" [class.fa-magnifying-glass-plus]="!lbZoom()" [class.fa-magnifying-glass-minus]="lbZoom()"></i>
                  </button>
                  <button (click)="closeLightbox()" title="Cerrar"
                          class="w-11 h-11 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition">
                    <i class="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
              </div>
              <!-- Imagen principal -->
              <div class="flex-1 relative grid place-items-center overflow-hidden px-4"
                   (click)="$event.stopPropagation()"
                   (mousemove)="onZoomMove($event)" (mouseleave)="onZoomLeave()">
                @if (lightboxImages().length > 1) {
                  <button (click)="lbPrev()" title="Anterior"
                          class="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 grid place-items-center rounded-full bg-white/10 hover:bg-white/25 border border-white/20 text-white text-2xl transition">
                    <i class="fa-solid fa-chevron-left"></i>
                  </button>
                  <button (click)="lbNext()" title="Siguiente"
                          class="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 grid place-items-center rounded-full bg-white/10 hover:bg-white/25 border border-white/20 text-white text-2xl transition">
                    <i class="fa-solid fa-chevron-right"></i>
                  </button>
                }
                <img [src]="lightboxImages()[lightboxIndex()]" [alt]="''"
                     class="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150 ease-out"
                     [style.transform]="lbZoom() ? 'scale(2.2)' : 'scale(1)'"
                     [style.transformOrigin]="lbOrigin()"
                     [class.cursor-zoom-in]="!lbZoom()" [class.cursor-zoom-out]="lbZoom()"
                     (click)="lbZoomToggle()" (error)="onImgErr($event)" />
              </div>
              <!-- Miniaturas -->
              @if (lightboxImages().length > 1) {
                <div class="flex gap-2 overflow-x-auto px-5 py-4 justify-center" (click)="$event.stopPropagation()">
                  @for (img of lightboxImages(); track img; let i = $index) {
                    <button (click)="lbGo(i)"
                            class="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition"
                            [ngClass]="i === lightboxIndex() ? 'border-white' : 'border-white/10 opacity-60 hover:opacity-100'">
                      <img [src]="img" alt="" class="w-full h-full object-cover" (error)="onImgErr($event)" />
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class KioskComponent implements OnInit, OnDestroy {
  private svc = inject(KioskService);
  private route = inject(ActivatedRoute);
  branding = inject(BrandingService);
  theme = inject(ThemeService);

  token = signal<string | null>(null);
  branchName = signal<string | null>(null);
  locked = signal(false);
  pinError = signal<string | null>(null);
  pin = '';
  private pendingCode: string | null = null;

  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  query = '';
  loading = signal(false);
  searched = signal(false);
  results = signal<KioskSearchItem[]>([]);
  detail = signal<KioskProduct | null>(null);
  featured = signal<KioskFeatured[]>([]);
  slide = signal(0);
  expanded = signal(false);
  searchOpen = signal(false);
  private searchTimer: any = null;
  lightboxOpen = signal(false);
  lightboxImages = signal<string[]>([]);
  lightboxIndex = signal(0);
  lbZoom = signal(false);
  lbOrigin = signal('50% 50%');
  private attractTimer: any = null;

  cameraOn = signal(false);
  camError = signal<string | null>(null);
  private stream?: MediaStream;
  private rafId: any = null;
  private detector: any = null;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    this.token.set(token);
    this.pendingCode = this.route.snapshot.queryParamMap.get('code');
    if (token) {
      this.svc.info(token).subscribe({
        next: (i) => {
          if (i.found) this.branchName.set(i.branch_name || null);
          const unlocked = typeof window !== 'undefined' && sessionStorage.getItem('dlx_kiosk_' + token) === '1';
          if (i.found && i.pin_required && !unlocked) this.locked.set(true);
          else this.afterUnlock();
        },
        error: () => this.afterUnlock(),
      });
    } else {
      this.afterUnlock();
    }
    this.svc.featured().subscribe({
      next: (r) => { this.featured.set(r.results); this.startAttract(); },
      error: () => {},
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.fsHandler);
    }
  }

  private startAttract(): void {
    if (this.attractTimer) clearInterval(this.attractTimer);
    if (this.featured().length < 2) return;
    this.attractTimer = setInterval(() => {
         this.slide.update(i => (i + 1) % Math.max(this.featured().length, 1));
    }, 4500);
  }

  showAttract(): boolean {
    return !this.locked() && !this.detail() && this.results().length === 0
      && !this.loading() && !this.cameraOn() && this.query.trim() === ''
      && this.featured().length > 0;
  }

  private afterUnlock(): void {
    if (this.pendingCode) { this.lookup(this.pendingCode); this.pendingCode = null; }
  }

  unlock(): void {
    const t = this.token();
    if (!t) return;
    this.svc.unlock(t, this.pin).subscribe({
      next: () => {
        if (typeof window !== 'undefined') sessionStorage.setItem('dlx_kiosk_' + t, '1');
        this.locked.set(false); this.pin = ''; this.pinError.set(null);
        this.afterUnlock();
      },
      error: () => this.pinError.set('PIN incorrecto.'),
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.attractTimer) clearInterval(this.attractTimer);
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', this.fsHandler);
  }

  doSearch(): void {
    const q = this.query.trim();
    if (!q) return;
    this.detail.set(null);
    this.loading.set(true);
    this.searched.set(true);
    this.svc.search(q).subscribe({
      next: (r) => { this.results.set(r.results); this.loading.set(false); },
      error: () => { this.results.set([]); this.loading.set(false); },
    });
  }

  lookup(code: string): void {
    this.results.set([]);
    this.loading.set(true);
    this.svc.product({ code }).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: () => { this.detail.set({ found: false, code }); this.loading.set(false); },
    });
  }

  loadById(id: number): void {
    this.loading.set(true);
    this.svc.product({ id }).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clear(): void {
    this.detail.set(null);
    this.results.set([]);
    this.query = '';
    this.searched.set(false);
  }
  goHome(): void {
    this.clear();
    this.closeSearch();
    this.camError.set(null);
    if (this.cameraOn()) this.stopCamera();
    this.slide.set(0);
    this.startAttract();
  }

  money(v: string | number | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return '$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
  }
  pad2(n: number): string { return String(n).padStart(2, '0'); }
  private fsHandler = () => {
    const fs = typeof document !== 'undefined' && !!document.fullscreenElement;
    this.expanded.set(fs);
  };
  toggleExpand(): void {
    const goingFs = !this.expanded();
    this.expanded.set(goingFs);
    if (typeof document === 'undefined') return;
    try {
      if (goingFs) {
        const el: any = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
      } else if (document.fullscreenElement) {
        (document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen)?.call(document);
      }
    } catch { /* fullscreen no disponible: queda el maximizado por CSS */ }
  }
  openSearch(): void { this.searchOpen.set(true); }
  closeSearch(): void { this.searchOpen.set(false); }
  // ── Carrusel ──
  nextSlide(): void { const n = this.featured().length; if (n) this.slide.update(i => (i + 1) % n); }
  prevSlide(): void { const n = this.featured().length; if (n) this.slide.update(i => (i - 1 + n) % n); }
  goToSlide(i: number): void { this.slide.set(i); }
  // ── Galería / lightbox ──
  galleryImages(d: KioskProduct): string[] {
    if (d.images && d.images.length) return d.images;
    return d.image ? [d.image] : [];
  }
  openLightbox(images: string[], start = 0): void {
    if (!images.length) return;
    this.lightboxImages.set(images);
    this.lightboxIndex.set(start);
    this.lbZoom.set(false);
    this.lightboxOpen.set(true);
  }
  closeLightbox(): void { this.lightboxOpen.set(false); this.lbZoom.set(false); }
  lbNext(): void { const n = this.lightboxImages().length; if (n) { this.lightboxIndex.update(i => (i + 1) % n); this.lbZoom.set(false); this.lbOrigin.set('50% 50%'); } }
  lbPrev(): void { const n = this.lightboxImages().length; if (n) { this.lightboxIndex.update(i => (i - 1 + n) % n); this.lbZoom.set(false); this.lbOrigin.set('50% 50%'); } }
  lbGo(i: number): void { this.lightboxIndex.set(i); this.lbZoom.set(false); }
  lbZoomToggle(): void { this.lbZoom.update(v => !v); }
  onZoomMove(ev: MouseEvent): void {
    const el = ev.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100));
    this.lbOrigin.set(x + '% ' + y + '%');
    this.lbZoom.set(true);
  }
  onZoomLeave(): void { this.lbZoom.set(false); }
  onSearchType(v: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = (v || '').trim();
    if (q.length < 2) { return; }
    this.searchTimer = setTimeout(() => this.doSearch(), 300);
  }
  onImgErr(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img.dataset['ph'] === '1') return;
    img.dataset['ph'] = '1';
    img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#ffffff55" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><rect x="32" y="44" width="56" height="40" rx="6"/><circle cx="60" cy="64" r="11"/><path d="M44 44l5-9h22l5 9"/></g></svg>');
    img.classList.add('object-contain', 'p-10', 'opacity-60');
    img.classList.remove('object-cover');
  }
  /** Precio final con IVA para mostrar al público. */
  withIva(v: string | number | undefined): number {
    const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
    return (+n || 0) * (1 + (this.branding.taxRate() || 0) / 100);
  }
  taxRate(): number { return +this.branding.taxRate() || 0; }

  async startCamera(): Promise<void> {
    this.camError.set(null);
    const w: any = window;
    if (typeof window === 'undefined' || !('BarcodeDetector' in w)) {
      this.camError.set('Tu navegador no soporta escaneo por cámara. Usa la búsqueda por texto (o prueba Chrome en Android).');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.camError.set('No se pudo acceder a la cámara. Revisa permisos (el sitio debe estar en HTTPS).');
      return;
    }
    this.detector = new w.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
    this.cameraOn.set(true);
    setTimeout(() => {
      const v = this.videoRef?.nativeElement;
      if (v && this.stream) { v.srcObject = this.stream; v.play().catch(() => {}); this.scanLoop(); }
    }, 60);
  }

  private async scanLoop(): Promise<void> {
    const v = this.videoRef?.nativeElement;
    if (!v || !this.cameraOn() || !this.detector) return;
    try {
      const codes = await this.detector.detect(v);
      if (codes && codes.length) { this.onCode(codes[0].rawValue || ''); return; }
    } catch { /* frame sin código */ }
    this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  stopCamera(): void {
    this.cameraOn.set(false);
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }

  private onCode(raw: string): void {
    this.stopCamera();
    let code = (raw || '').trim();
    const m = code.match(/[?&]code=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
    if (code) this.lookup(code);
  }
}
