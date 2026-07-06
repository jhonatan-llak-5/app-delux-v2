import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminService, PlatformSettings } from '@features/superadmin/services/admin.service';
import { NotifyService } from '@shared/services/notify.service';
import { parseApiError } from '@shared/utils/api-error.util';
import { FileValidatorService } from '@shared/services/file-validator.service';
import { BrandingService } from '@core/services/branding.service';
import { DlxToggleComponent } from '@shared/ui/toggle.component';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DlxToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-settings.component.html',
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
  deunaQrFile = signal<File | null>(null);
  deunaQrPreview = signal<string | null>(null);

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
    affiliate_commission_rate: [10, [Validators.min(0), Validators.max(100)]],
    affiliate_min_payout: [0, [Validators.min(0)]],
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
    // Transferencia bancaria
    transfer_enabled: [true],
    bank_name: [''],
    bank_account_type: [''],
    bank_account_holder: [''],
    bank_account_number: [''],
    bank_account_document: [''],
    bank_contact_email: ['', [Validators.email]],
    bank_contact_whatsapp: [''],
    transfer_instructions: [''],
    // DE UNA
    deuna_enabled: [false],
    deuna_instructions: [''],
  });

  ngOnInit() { this.loadSettings(); }
  setTab(id: TabId) { this.tab.set(id); }


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

  onDeunaQrSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = this.validator.validate(file, 'image');
    if (!res.ok) { this.notify.warning('QR inválido', { description: res.reason }); return; }
    this.deunaQrFile.set(file);
    const r = new FileReader();
    r.onload = () => this.deunaQrPreview.set(r.result as string);
    r.readAsDataURL(file);
  }
  clearDeunaQr() { this.deunaQrFile.set(null); this.deunaQrPreview.set(null); }
  deunaSavedQr(): string | null { return (this.settings() as any)?.deuna_qr_url || null; }

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
    const hasFiles = !!this.logoFile() || !!this.faviconFile() || !!this.deunaQrFile();
    if (hasFiles) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === undefined) continue;
        fd.append(k, typeof v === 'boolean' ? String(v) : String(v));
      }
      if (this.logoFile()) fd.append('site_logo', this.logoFile()!);
      if (this.faviconFile()) fd.append('site_favicon', this.faviconFile()!);
      if (this.deunaQrFile()) fd.append('deuna_qr', this.deunaQrFile()!);
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
    this.clearDeunaQr();
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
