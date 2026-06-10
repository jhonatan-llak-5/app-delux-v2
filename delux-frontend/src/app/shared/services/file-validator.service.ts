import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { PlatformSettings } from '@features/superadmin/services/admin.service';

export type FileKind = 'image' | 'file' | 'video';

export interface FileValidationResult {
  ok: boolean;
  reason?: string;       // mensaje user-friendly si falla
  ext?: string;          // extension detectada
  sizeMb?: number;       // tamaño en MB
}

/**
 * FileValidatorService — singleton que carga PlatformSettings al bootstrap
 * y expone validate() para cualquier upload del frontend.
 *
 *   const result = validator.validate(file, 'image');
 *   if (!result.ok) notify.warning(result.reason);
 */
@Injectable({ providedIn: 'root' })
export class FileValidatorService {
  private http = inject(HttpClient);

  /** Config cargada (null hasta primer fetch). */
  config = signal<Partial<PlatformSettings> | null>(null);

  /** Límites en bytes, computados desde config (con fallbacks razonables). */
  limits = computed(() => {
    const c = this.config();
    return {
      imageBytes:   (c?.max_image_upload_mb ?? 5)   * 1024 * 1024,
      fileBytes:    (c?.max_file_upload_mb  ?? 10)  * 1024 * 1024,
      videoBytes:   (c?.max_video_upload_mb ?? 500) * 1024 * 1024,
      imageExts:    csv(c?.allowed_image_extensions ?? 'png,jpg,jpeg,webp,svg,avif,gif'),
      fileExts:     csv(c?.allowed_file_extensions  ?? 'pdf,doc,docx,xls,xlsx,csv,txt,zip'),
      videoExts:    csv(c?.allowed_video_extensions ?? 'mp4,webm,mov,avi,mkv'),
      imageMb:      c?.max_image_upload_mb ?? 5,
      fileMb:       c?.max_file_upload_mb  ?? 10,
      videoMb:      c?.max_video_upload_mb ?? 500,
    };
  });

  /** Llamar una vez al iniciar la app (APP_INITIALIZER o en AppComponent). */
  async loadConfig(): Promise<void> {
    try {
      const res = await this.http.get<PlatformSettings>(
        `${environment.apiUrl}/admin/settings/public-config/`
      ).toPromise().catch(() => null);
      if (res) {
        this.config.set(res);
        return;
      }
      // Fallback: intentar endpoint admin (sólo si está auth)
      const res2 = await this.http.get<PlatformSettings>(
        `${environment.apiUrl}/admin/settings/`
      ).toPromise().catch(() => null);
      if (res2) this.config.set(res2);
    } catch {
      // Si falla, los limits() usan los defaults
    }
  }

  /** Permite que la página settings actualice los valores en vivo. */
  setConfig(cfg: Partial<PlatformSettings>) {
    this.config.set(cfg);
  }

  /** Valida un File contra la categoría indicada. */
  validate(file: File, kind: FileKind): FileValidationResult {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const sizeMb = file.size / (1024 * 1024);
    const L = this.limits();

    const allowed = kind === 'image' ? L.imageExts
                  : kind === 'video' ? L.videoExts
                  : L.fileExts;
    const maxBytes = kind === 'image' ? L.imageBytes
                   : kind === 'video' ? L.videoBytes
                   : L.fileBytes;
    const maxMb = kind === 'image' ? L.imageMb
                : kind === 'video' ? L.videoMb
                : L.fileMb;

    if (!allowed.includes(ext)) {
      return {
        ok: false,
        ext, sizeMb,
        reason: `Tipo no permitido (.${ext}). Permitidos: ${allowed.join(', ')}`,
      };
    }
    if (file.size > maxBytes) {
      return {
        ok: false,
        ext, sizeMb,
        reason: `Archivo demasiado grande (${sizeMb.toFixed(1)} MB). Máximo: ${maxMb} MB`,
      };
    }
    return { ok: true, ext, sizeMb };
  }
}

function csv(s: string): string[] {
  return s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}
