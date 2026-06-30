import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService, PlatformSettings } from '@features/superadmin/services/admin.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { FileValidatorService } from '@shared/services/file-validator.service';
import { BrandingService } from '@core/services/branding.service';

type TabId = 'email' | 'recaptcha' | 'brand' | 'uploads' | 'payments';
type ExtControl = 'allowed_image_extensions' | 'allowed_file_extensions' | 'allowed_video_extensions';
interface ExtensionOption { ext: string; label: string; }

const IMAGE_EXTENSIONS: ExtensionOption[] = [
  { ext: 'png',  label: 'PNG' },
  { ext: 'jpg',  label: 'JPG' },
  { ext: 'jpeg', label: 'JPEG' },
  { ext: 'webp', label: 'WEBP' },
  { ext: 'svg',  label: 'SVG' },
  { ext: 'avif', label: 'AVIF' },
  { ext: 'gif',  label: 'GIF' },
];
const FILE_EXTENSIONS: ExtensionOption[] = [
  { ext: 'pdf',  label: 'PDF' },
  { ext: 'doc',  label: 'DOC' },
  { ext: 'docx', label: 'DOCX' },
  { ext: 'xls',  label: 'XLS' },
  { ext: 'xlsx', label: 'XLSX' },
  { ext: 'csv',  label: 'CSV' },
  { ext: 'txt',  label: 'TXT' },
  { ext: 'zip',  label: 'ZIP' },
];
const VIDEO_EXTENSIONS: ExtensionOption[] = [
  { ext: 'mp4',  label: 'MP4' },
  { ext: 'webm', label: 'WEBM' },
  { ext: 'mov',  label: 'MOV' },
  { ext: 'avi',  label: 'AVI' },
  { ext: 'mkv',  label: 'MKV' },
];

@Component({
  selector: 'dlx-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eg-page space-y-6">

      <!-- Header -->
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span class="eg-section-label">Superadmin</span>
          <h1 class="eg-page-title">Configuración de plataforma</h1>
          <p class="eg-page-subtitle">Personaliza SMTP, marca, límites de archivos, pagos y más.</p>
        </div>
        <span class="eg-badge eg-badge-brand self-start sm:self-auto">
          <i class="fa-solid fa-shield-halved text-[10px]"></i> Solo superadmin
        </span>
      </header>

      <!-- Tabs estilo elitegroup (border-b + underline) -->
      <nav class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#334155]" aria-label="Configuración">
        @for (t of tabs; track t.id) {
          <button type="button" (click)="setTab(t.id)"
                  class="px-4 py-2.5 text-sm font-semibold transition flex items-center gap-2"
                  [class.border-b-2]="tab() === t.id"
                  [class.border-[#1e40af]]="tab() === t.id"
                  [class.text-[#1e3a8a]]="tab() === t.id"
                  [class.dark:text-blue-300]="tab() === t.id"
                  [class.dark:border-blue-500]="tab() === t.id"
                  [class.text-slate-500]="tab() !== t.id"
                  [class.dark:text-slate-400]="tab() !== t.id"
                  [class.hover:text-slate-700]="tab() !== t.id">
            <i class="fa-solid {{ t.icon }} text-[12px]"></i>
            {{ t.label }}
          </button>
        }
      </nav>

      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-5 pb-32">

        <!-- ═════ TAB EMAIL ═════ -->
        @if (tab() === 'email') {
          <!-- General -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Configuración SMTP</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Servidor de correo para activaciones, notificaciones y resets de contraseña.
              </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="eg-label">Envío activo</span>
                <div class="flex items-center gap-3 h-11 px-3.5 rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0b1220]">
                  <span class="eg-switch" [class.is-on]="form.value.email_active"
                        (click)="toggleBool('email_active')"></span>
                  <span class="text-sm text-slate-700 dark:text-slate-300">
                    {{ form.value.email_active ? 'Activado' : 'Desactivado' }}
                  </span>
                  <input type="checkbox" formControlName="email_active" class="hidden" />
                </div>
              </label>
              <label class="block">
                <span class="eg-label">Proveedor SMTP</span>
                <select class="eg-input" formControlName="email_provider">
                  <option value="custom">Custom</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                  <option value="office365">Office 365</option>
                  <option value="yahoo">Yahoo</option>
                  <option value="zoho">Zoho</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="mailgun">Mailgun</option>
                </select>
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
              <label class="block md:col-span-2">
                <span class="eg-label">Servidor SMTP</span>
                <input class="eg-input" formControlName="smtp_host" placeholder="smtp.gmail.com" />
              </label>
              <label class="block">
                <span class="eg-label">Puerto</span>
                <input class="eg-input" type="number" formControlName="smtp_port" />
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="eg-label">Usuario</span>
                <input class="eg-input" formControlName="smtp_username" placeholder="usuario@dominio.com" />
              </label>
              <label class="block">
                <span class="eg-label">
                  Contraseña
                  @if (settings()?.smtp_password_configured) {
                    <span class="eg-badge eg-badge-success ml-2">configurada</span>
                  }
                </span>
                <input class="eg-input" type="password" formControlName="smtp_password"
                       [placeholder]="settings()?.smtp_password_configured ? '••••••••' : 'App password'" />
              </label>
            </div>

            <div class="flex flex-wrap gap-5 pt-2">
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" formControlName="smtp_use_tls" class="w-4 h-4 accent-blue-600" />
                STARTTLS (587)
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" formControlName="smtp_use_ssl" class="w-4 h-4 accent-blue-600" />
                SSL (465)
              </label>
            </div>
          </section>

          <!-- Remitente -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Remitente y respuestas</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Datos del emisor que verán los destinatarios.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="block"><span class="eg-label">Nombre remitente</span>
                <input class="eg-input" formControlName="default_from_name" />
              </label>
              <label class="block"><span class="eg-label">Correo remitente</span>
                <input class="eg-input" type="email" formControlName="default_from_email" />
              </label>
              <label class="block"><span class="eg-label">Reply-To</span>
                <input class="eg-input" type="email" formControlName="email_reply_to" placeholder="contacto@dominio.com" />
              </label>
              <label class="block"><span class="eg-label">Email de soporte</span>
                <input class="eg-input" type="email" formControlName="support_email" />
              </label>
            </div>
          </section>

          <!-- Test email -->
          <section class="eg-card-padded space-y-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Enviar correo de prueba</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Verifica que tu configuración SMTP funcione.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input class="eg-input flex-1 min-w-[260px]" type="email"
                     [(ngModel)]="testEmailTo" [ngModelOptions]="{standalone:true}"
                     placeholder="destinatario@correo.com" />
              <button type="button" (click)="sendTestEmail()" [disabled]="testEmailing()" class="eg-btn-primary">
                @if (testEmailing()) { <i class="fa-solid fa-spinner fa-spin"></i> Enviando... }
                @else { <i class="fa-solid fa-paper-plane"></i> Enviar prueba }
              </button>
            </div>
          </section>
        }

        <!-- ═════ TAB reCAPTCHA ═════ -->
        @if (tab() === 'recaptcha') {
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Google reCAPTCHA</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Protege formularios públicos contra bots y spam.</p>
            </div>
            <label class="block"><span class="eg-label">Site key (pública)</span>
              <input class="eg-input font-mono text-[13px]" formControlName="recaptcha_site_key" placeholder="6Lc..." />
            </label>
            <label class="block">
              <span class="eg-label">
                Secret key
                @if (settings()?.recaptcha_secret_configured) {
                  <span class="eg-badge eg-badge-success ml-2">configurada</span>
                }
              </span>
              <input class="eg-input font-mono text-[13px]" type="password" formControlName="recaptcha_secret_key"
                     [placeholder]="settings()?.recaptcha_secret_configured ? '••••••••' : 'Clave secreta'" />
            </label>
          </section>
        }

        <!-- ═════ TAB MARCA ═════ -->
        @if (tab() === 'brand') {
          <!-- Identidad -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Identidad de marca</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Nombre y tagline que aparecen en navbar, emails y meta tags.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="block"><span class="eg-label">Nombre del sitio</span>
                <input class="eg-input" formControlName="site_name" />
              </label>
              <label class="block"><span class="eg-label">Tagline</span>
                <input class="eg-input" formControlName="platform_tagline" />
              </label>
              <label class="block"><span class="eg-label">IVA (%)</span>
                <input type="number" min="0" max="100" step="0.01" class="eg-input" formControlName="tax_rate" />
                <span class="text-[11px] text-slate-400 mt-1 block">Se usa para calcular el precio final con IVA (etiquetas, kiosko, formularios). Ej. 15.</span>
              </label>
            </div>
          </section>

          <!-- Logo -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Logo y favicon</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">PNG, JPG, WEBP o SVG. Máx {{ validator.limits().imageMb }} MB.</p>
            </div>

            <!-- Logo -->
            <div class="rounded-lg border border-slate-200 p-4 dark:border-[#334155] dark:bg-[#0b1220]/40">
              <span class="eg-label">Logo</span>
              <div class="mt-3 flex items-center gap-4">
                <div class="logo-frame flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg p-2">
                  @if (logoPreview()) {
                    <img [src]="logoPreview()" alt="Logo nuevo" class="max-h-full max-w-full object-contain" />
                  } @else if (settings()?.site_logo_url) {
                    <img [src]="settings()?.site_logo_url" alt="Logo actual" class="max-h-full max-w-full object-contain" />
                  } @else {
                    <span class="text-xs text-slate-400">Sin logo</span>
                  }
                </div>
                <div class="space-y-2">
                  <label class="eg-btn-secondary cursor-pointer">
                    <input type="file" class="hidden"
                           accept="image/png,image/jpeg,image/webp,image/svg+xml"
                           (change)="onLogoSelected($event)" />
                    Subir logo
                  </label>
                  @if (logoFile(); as file) {
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ file.name }}</p>
                    <button type="button" (click)="clearLogo()"
                            class="text-xs font-semibold text-rose-600 hover:underline">
                      Quitar selección
                    </button>
                  } @else {
                    <p class="text-xs text-slate-400">PNG, JPG, WEBP o SVG. Máx {{ validator.limits().imageMb }} MB.</p>
                  }
                </div>
              </div>
            </div>

            <!-- Favicon -->
            <div class="rounded-lg border border-slate-200 p-4 dark:border-[#334155] dark:bg-[#0b1220]/40">
              <span class="eg-label">Favicon</span>
              <div class="mt-3 flex items-center gap-4">
                <div class="logo-frame flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg p-2">
                  @if (faviconPreview()) {
                    <img [src]="faviconPreview()" alt="Favicon nuevo" class="max-h-12 max-w-12 object-contain" />
                  } @else if (settings()?.site_favicon_url) {
                    <img [src]="settings()?.site_favicon_url" alt="Favicon actual" class="max-h-12 max-w-12 object-contain" />
                  } @else {
                    <span class="text-xs text-slate-400">Sin favicon</span>
                  }
                </div>
                <div class="space-y-2">
                  <label class="eg-btn-secondary cursor-pointer">
                    <input type="file" class="hidden"
                           accept="image/x-icon,image/png,image/svg+xml"
                           (change)="onFaviconSelected($event)" />
                    Subir favicon
                  </label>
                  @if (faviconFile(); as file) {
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ file.name }}</p>
                    <button type="button" (click)="clearFavicon()"
                            class="text-xs font-semibold text-rose-600 hover:underline">
                      Quitar selección
                    </button>
                  } @else {
                    <p class="text-xs text-slate-400">ICO, PNG o SVG. Máx {{ validator.limits().imageMb }} MB.</p>
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- Contacto público -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Contacto público</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Canales visibles en footer y página de contacto.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="block"><span class="eg-label">WhatsApp soporte</span>
                <input class="eg-input" formControlName="whatsapp_contact_number" placeholder="+593 99 123 4567" />
              </label>
              <label class="block"><span class="eg-label">Email soporte público</span>
                <input class="eg-input" type="email" formControlName="support_email" />
              </label>
            </div>
          </section>
        }

        <!-- ═════ TAB SUBIDAS ═════ -->
        @if (tab() === 'uploads') {

          <!-- Límites MB -->
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Límites de subida</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Valor máximo (MB) por tipo de archivo aceptado en el frontend.
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <label class="block"><span class="eg-label">Imágenes (MB)</span>
                <input class="eg-input" type="number" formControlName="max_image_upload_mb" />
              </label>
              <label class="block"><span class="eg-label">Archivos (MB)</span>
                <input class="eg-input" type="number" formControlName="max_file_upload_mb" />
              </label>
              <label class="block"><span class="eg-label">Videos (MB)</span>
                <input class="eg-input" type="number" formControlName="max_video_upload_mb" />
              </label>
            </div>
          </section>

          <!-- Extensiones IMÁGENES (verde) -->
          <section class="eg-card-padded space-y-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Extensiones de imagen</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Activa o desactiva los formatos permitidos.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (option of imageExtensionOptions; track option.ext) {
                <button type="button"
                        class="rounded-full px-4 py-2 text-xs font-semibold transition"
                        [class.bg-emerald-600]="isImageExtEnabled(option.ext)"
                        [class.text-white]="isImageExtEnabled(option.ext)"
                        [class.bg-slate-100]="!isImageExtEnabled(option.ext)"
                        [class.text-slate-600]="!isImageExtEnabled(option.ext)"
                        [class.dark:bg-slate-800]="!isImageExtEnabled(option.ext)"
                        [class.dark:text-slate-300]="!isImageExtEnabled(option.ext)"
                        (click)="toggleImageExt(option.ext)">
                  .{{ option.label }}
                </button>
              }
            </div>
            <input class="eg-input font-mono text-[13px]" formControlName="allowed_image_extensions" />
          </section>

          <!-- Extensiones ARCHIVOS (ámbar) -->
          <section class="eg-card-padded space-y-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Extensiones de archivo</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Aplica a recursos descargables y documentos.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (option of fileExtensionOptions; track option.ext) {
                <button type="button"
                        class="rounded-full px-4 py-2 text-xs font-semibold transition"
                        [class.bg-amber-500]="isFileExtEnabled(option.ext)"
                        [class.text-white]="isFileExtEnabled(option.ext)"
                        [class.bg-slate-100]="!isFileExtEnabled(option.ext)"
                        [class.text-slate-600]="!isFileExtEnabled(option.ext)"
                        [class.dark:bg-slate-800]="!isFileExtEnabled(option.ext)"
                        [class.dark:text-slate-300]="!isFileExtEnabled(option.ext)"
                        (click)="toggleFileExt(option.ext)">
                  .{{ option.label }}
                </button>
              }
            </div>
            <input class="eg-input font-mono text-[13px]" formControlName="allowed_file_extensions" />
          </section>

          <!-- Extensiones VIDEO (violet) -->
          <section class="eg-card-padded space-y-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Extensiones de video</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Formatos aceptados para subidas de video.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (option of videoExtensionOptions; track option.ext) {
                <button type="button"
                        class="rounded-full px-4 py-2 text-xs font-semibold transition"
                        [class.bg-violet-600]="isVideoExtEnabled(option.ext)"
                        [class.text-white]="isVideoExtEnabled(option.ext)"
                        [class.bg-slate-100]="!isVideoExtEnabled(option.ext)"
                        [class.text-slate-600]="!isVideoExtEnabled(option.ext)"
                        [class.dark:bg-slate-800]="!isVideoExtEnabled(option.ext)"
                        [class.dark:text-slate-300]="!isVideoExtEnabled(option.ext)"
                        (click)="toggleVideoExt(option.ext)">
                  .{{ option.label }}
                </button>
              }
            </div>
            <input class="eg-input font-mono text-[13px]" formControlName="allowed_video_extensions" />
          </section>
        }

        <!-- ═════ TAB PAYMENTS ═════ -->
        @if (tab() === 'payments') {
          <section class="eg-card-padded space-y-5">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">PayPhone</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Procesador de pagos para el checkout web.</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="block">
                <span class="eg-label">PayPhone activo</span>
                <div class="flex items-center gap-3 h-11 px-3.5 rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0b1220]">
                  <span class="eg-switch" [class.is-on]="form.value.payphone_enabled"
                        (click)="toggleBool('payphone_enabled')"></span>
                  <span class="text-sm text-slate-700 dark:text-slate-300">
                    {{ form.value.payphone_enabled ? 'Activado' : 'Desactivado' }}
                  </span>
                  <input type="checkbox" formControlName="payphone_enabled" class="hidden" />
                </div>
              </label>
              <label class="block">
                <span class="eg-label">Modo Sandbox</span>
                <div class="flex items-center gap-3 h-11 px-3.5 rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#0b1220]">
                  <span class="eg-switch" [class.is-on]="form.value.payphone_sandbox"
                        (click)="toggleBool('payphone_sandbox')"></span>
                  <span class="text-sm text-slate-700 dark:text-slate-300">
                    {{ form.value.payphone_sandbox ? 'Pruebas (sin cobros)' : 'Producción' }}
                  </span>
                  <input type="checkbox" formControlName="payphone_sandbox" class="hidden" />
                </div>
              </label>
            </div>

            <label class="block"><span class="eg-label">Store ID</span>
              <input class="eg-input font-mono text-[13px]" formControlName="payphone_store_id" placeholder="store-12345" />
            </label>
            <label class="block">
              <span class="eg-label">
                Token
                @if (settings()?.payphone_token_masked) {
                  <span class="eg-badge eg-badge-success ml-2 font-mono">{{ settings()?.payphone_token_masked }}</span>
                }
              </span>
              <input class="eg-input font-mono text-[13px]" type="password" formControlName="payphone_token"
                     [placeholder]="settings()?.payphone_token_masked ? '••••••••' : 'API token'" />
            </label>
            <label class="block"><span class="eg-label">API URL</span>
              <input class="eg-input font-mono text-[13px]" formControlName="payphone_api_url" />
            </label>

            <div class="pt-3 border-t border-slate-100 dark:border-[#334155]">
              <button type="button" (click)="testPayPhone()" [disabled]="testingPay()" class="eg-btn-secondary">
                @if (testingPay()) { <i class="fa-solid fa-spinner fa-spin"></i> Probando... }
                @else { <i class="fa-solid fa-shield-halved"></i> Probar conexión PayPhone }
              </button>
            </div>
          </section>
        }

        <!-- ═════ STICKY FOOTER (idéntico a elitegroup) ═════ -->
        <div class="sticky bottom-4 z-20">
          <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95
                      p-3 shadow-xl shadow-slate-950/10 backdrop-blur
                      md:flex-row md:items-center md:justify-between
                      dark:border-[#334155] dark:bg-[#0f172a]/95">
            <div>
              <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {{ (form.dirty || logoFile() || faviconFile()) ? 'Cambios pendientes' : 'Configuración guardada' }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ (form.dirty || logoFile() || faviconFile())
                  ? 'Guarda antes de cambiar de sección o enviar pruebas.'
                  : 'Puedes enviar una prueba SMTP cuando el correo esté activo.' }}
              </p>
            </div>
            <button type="submit"
                    class="eg-btn-primary h-11 px-6 md:min-w-44"
                    [disabled]="form.invalid || saving() || (!form.dirty && !logoFile() && !faviconFile())">
              @if (saving()) { <i class="fa-solid fa-spinner fa-spin"></i> Guardando... }
              @else { Guardar cambios }
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class PlatformSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private admin = inject(AdminService);
  private notify = inject(NotifyService);
  validator = inject(FileValidatorService);
  private branding = inject(BrandingService);

  readonly imageExtensionOptions = IMAGE_EXTENSIONS;
  readonly fileExtensionOptions = FILE_EXTENSIONS;
  readonly videoExtensionOptions = VIDEO_EXTENSIONS;

  tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'email',     label: 'Email SMTP',  icon: 'fa-envelope' },
    { id: 'recaptcha', label: 'reCAPTCHA',   icon: 'fa-shield-halved' },
    { id: 'brand',     label: 'Marca',       icon: 'fa-palette' },
    { id: 'uploads',   label: 'Subidas',     icon: 'fa-upload' },
    { id: 'payments',  label: 'Pagos',       icon: 'fa-credit-card' },
  ];
  tab = signal<TabId>('email');

  settings = signal<PlatformSettings | null>(null);
  testEmailTo = '';
  testEmailing = signal(false);
  testingPay = signal(false);
  saving = signal(false);

  logoFile = signal<File | null>(null);
  logoPreview = signal<string | null>(null);
  faviconFile = signal<File | null>(null);
  faviconPreview = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email_active: [true],
    email_provider: ['custom'],
    smtp_host: [''],
    smtp_port: [587, [Validators.min(1), Validators.max(65535)]],
    smtp_username: [''],
    smtp_password: [''],
    smtp_use_tls: [true],
    smtp_use_ssl: [false],
    default_from_email: ['', [Validators.email]],
    default_from_name: ['Delux'],
    email_reply_to: [''],
    support_email: [''],
    recaptcha_site_key: [''],
    recaptcha_secret_key: [''],
    site_name: ['Delux'],
    platform_tagline: [''],
    whatsapp_contact_number: [''],
    tax_rate: [15, [Validators.min(0), Validators.max(100)]],
    max_image_upload_mb: [5, [Validators.min(1), Validators.max(50)]],
    max_file_upload_mb: [10, [Validators.min(1), Validators.max(200)]],
    max_video_upload_mb: [500, [Validators.min(1), Validators.max(5000)]],
    allowed_image_extensions: ['png,jpg,jpeg,webp,svg,avif,gif'],
    allowed_file_extensions: ['pdf,doc,docx,xls,xlsx,csv,txt,zip'],
    allowed_video_extensions: ['mp4,webm,mov,avi,mkv'],
    payphone_enabled: [false],
    payphone_sandbox: [true],
    payphone_store_id: [''],
    payphone_token: [''],
    payphone_api_url: ['https://pay.payphonetodoesposible.com/api'],
  });

  ngOnInit() { this.loadSettings(); }
  setTab(id: TabId) { this.tab.set(id); }

  toggleBool(key: 'email_active' | 'payphone_enabled' | 'payphone_sandbox') {
    const cur = (this.form.value as any)[key];
    this.form.patchValue({ [key]: !cur } as any);
    this.form.markAsDirty();
  }

  // ── Extension pills helpers ──
  toggleImageExt(ext: string) { this.toggleCsvValue('allowed_image_extensions', ext); }
  toggleFileExt(ext: string)  { this.toggleCsvValue('allowed_file_extensions',  ext); }
  toggleVideoExt(ext: string) { this.toggleCsvValue('allowed_video_extensions', ext); }
  isImageExtEnabled(ext: string): boolean {
    return this.parseCsv(this.form.controls.allowed_image_extensions.value).includes(ext);
  }
  isFileExtEnabled(ext: string): boolean {
    return this.parseCsv(this.form.controls.allowed_file_extensions.value).includes(ext);
  }
  isVideoExtEnabled(ext: string): boolean {
    return this.parseCsv(this.form.controls.allowed_video_extensions.value).includes(ext);
  }
  private parseCsv(value: string | null | undefined): string[] {
    return (value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  private toggleCsvValue(ctrl: ExtControl, ext: string) {
    const set = new Set(this.parseCsv(this.form.controls[ctrl].value));
    if (set.has(ext)) set.delete(ext); else set.add(ext);
    this.form.controls[ctrl].setValue([...set].join(','));
    this.form.markAsDirty();
  }

  loadSettings() {
    this.admin.getSettings().subscribe({
      next: s => {
        this.settings.set(s);
        const patch: any = { ...s };
        delete patch.smtp_password;
        delete patch.recaptcha_secret_key;
        delete patch.payphone_token;
        this.form.patchValue(patch, { emitEvent: false });
        this.form.markAsPristine();
        this.validator.setConfig(s);
      },
      error: e => this.notify.fromServerError(e, 'No se pudo cargar la configuración.'),
    });
  }

  onLogoSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = this.validator.validate(file, 'image');
    if (!res.ok) { this.notify.warning('Logo inválido', { description: res.reason }); return; }
    this.logoFile.set(file);
    const r = new FileReader();
    r.onload = () => this.logoPreview.set(r.result as string);
    r.readAsDataURL(file);
  }
  clearLogo() { this.logoFile.set(null); this.logoPreview.set(null); }

  onFaviconSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = this.validator.validate(file, 'image');
    if (!res.ok) { this.notify.warning('Favicon inválido', { description: res.reason }); return; }
    this.faviconFile.set(file);
    const r = new FileReader();
    r.onload = () => this.faviconPreview.set(r.result as string);
    r.readAsDataURL(file);
  }
  clearFavicon() { this.faviconFile.set(null); this.faviconPreview.set(null); }

  /** Mapea errores de validación del backend a los controles del form. */
  private applyServerErrors(e: unknown): void {
    const p = parseApiError(e);
    const keys = Object.keys(p.fieldErrors);
    keys.forEach(k => {
      const c = this.form.get(k);
      if (c) c.setErrors({ server: p.fieldErrors[k] });
    });
    if (keys.length) this.notify.error('Revisa estos campos: ' + keys.join(', '));
    else this.notify.fromServerError(e as any);
  }

  save() {
    this.saving.set(true);
    const raw: any = this.form.getRawValue();
    for (const k of ['smtp_password', 'recaptcha_secret_key', 'payphone_token']) {
      if (!raw[k]) delete raw[k];
    }
    const hasFiles = !!this.logoFile() || !!this.faviconFile();
    if (hasFiles) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === undefined) continue;
        fd.append(k, typeof v === 'boolean' ? String(v) : String(v));
      }
      if (this.logoFile()) fd.append('site_logo', this.logoFile()!);
      if (this.faviconFile()) fd.append('site_favicon', this.faviconFile()!);
      this.admin.updateSettingsMultipart(fd).subscribe({
        next: s => this.afterSave(s),
        error: e => { this.saving.set(false); this.applyServerErrors(e); },
      });
    } else {
      this.admin.updateSettings(raw).subscribe({
        next: s => this.afterSave(s),
        error: e => { this.saving.set(false); this.applyServerErrors(e); },
      });
    }
  }

  private afterSave(s: PlatformSettings) {
    this.settings.set(s);
    this.validator.setConfig(s);
    this.form.markAsPristine();
    this.clearLogo();
    this.clearFavicon();
    this.saving.set(false);
    // Refresca el branding global (logo, favicon, nombre) sin recargar la página.
    this.branding.load();
    this.notify.success('Configuración guardada');
  }

  sendTestEmail() {
    if (!this.testEmailTo) { this.notify.warning('Falta el destinatario'); return; }
    this.testEmailing.set(true);
    this.admin.testEmail(this.testEmailTo).subscribe({
      next: r => { this.testEmailing.set(false); this.notify.success(r.detail); },
      error: e => { this.testEmailing.set(false); this.notify.fromServerError(e, 'No se pudo enviar.'); },
    });
  }

  testPayPhone() {
    this.testingPay.set(true);
    this.admin.testPayPhone().subscribe({
      next: r => {
        this.testingPay.set(false);
        this.notify.success(r.detail, {
          description: `${r.sandbox ? 'Sandbox' : 'Producción'} · Store ${r.store_id}`,
        });
      },
      error: e => { this.testingPay.set(false); this.notify.fromServerError(e); },
    });
  }
}
