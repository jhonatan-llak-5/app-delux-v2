import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, forwardRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FileValidatorService } from '@shared/services/file-validator.service';
import { NotifyService } from '@shared/services/notify.service';
import { ProductService } from '@features/superadmin/services/product.service';

export interface DlxImageItem {
  url: string;          // URL pública o data: URL si es local
  file?: File;          // archivo si fue drag&drop / file picker
  isMain?: boolean;
  caption?: string;
}

/**
 * <dlx-image-uploader [(ngModel)]="images" [maxImages]="10" />
 *
 * Mixto: acepta drag&drop / file picker (validados vía FileValidatorService)
 * + URL pública (input + botón Añadir).
 * No requiere imágenes; max configurable. Marca la primera como `isMain`.
 */
@Component({
  selector: 'dlx-image-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DlxImageUploaderComponent), multi: true },
  ],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      @if (label) {
        <div class="flex items-center justify-between">
          <span class="eg-label !mb-0">{{ label }}</span>
          <span class="text-xs" [style.color]="'var(--dash-text-muted)'">
            {{ images().length }} / {{ maxImages }}
          </span>
        </div>
      }

      <!-- Galería -->
      @if (images().length > 0) {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          @for (img of images(); track img.url; let i = $index) {
            <div class="relative group aspect-square rounded-xl overflow-hidden
                        border-2 transition"
                 [style.border-color]="img.isMain ? 'var(--dash-primary)' : 'var(--dash-border)'">
              @if (img.isMain) {
                <span class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest
                             bg-[var(--dash-primary)] text-white">
                  Main
                </span>
              }
              <img [src]="img.url" [alt]="'Imagen ' + (i + 1)"
                   class="w-full h-full object-cover bg-[var(--dash-hover)]"
                   (error)="onImgErr($event)" />
              <!-- Overlay con acciones -->
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition
                          flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                @if (!img.isMain) {
                  <button type="button" (click)="setMain(i)" title="Marcar como principal"
                          class="w-8 h-8 rounded-md bg-white/95 text-ink-950 grid place-items-center hover:bg-white">
                    <i class="fa-solid fa-star text-xs"></i>
                  </button>
                }
                @if (i > 0) {
                  <button type="button" (click)="move(i, i-1)" title="Mover arriba"
                          class="w-8 h-8 rounded-md bg-white/95 text-ink-950 grid place-items-center hover:bg-white">
                    <i class="fa-solid fa-arrow-left text-xs"></i>
                  </button>
                }
                @if (i < images().length - 1) {
                  <button type="button" (click)="move(i, i+1)" title="Mover abajo"
                          class="w-8 h-8 rounded-md bg-white/95 text-ink-950 grid place-items-center hover:bg-white">
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                }
                <button type="button" (click)="remove(i)" title="Eliminar"
                        class="w-8 h-8 rounded-md bg-rose-600 text-white grid place-items-center hover:bg-rose-700">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Drop zone -->
      @if (images().length < maxImages) {
        <div
          class="relative rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer"
          [style.border-color]="dragging() ? 'var(--dash-primary)' : 'var(--dash-border)'"
          [style.background-color]="dragging() ? 'var(--dash-primary-l)' : 'var(--dash-hover)'"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          <input #fileInput type="file" multiple [accept]="accept" class="hidden"
                 (change)="onFilesPicked($event)" />
          <div class="w-12 h-12 mx-auto rounded-full grid place-items-center mb-3"
               [style.background-color]="'var(--dash-card)'">
            <i class="fa-solid fa-cloud-arrow-up text-lg"
               [style.color]="'var(--dash-primary)'"></i>
          </div>
          <p class="text-sm font-semibold" [style.color]="'var(--dash-text)'">
            @if (uploading()) { <i class="fa-solid fa-spinner fa-spin"></i> Subiendo imagen… }
            @else { Arrastra imágenes aquí o haz clic para seleccionar }
          </p>
          <p class="text-xs mt-1" [style.color]="'var(--dash-text-muted)'">
            {{ acceptLabel }} · máx {{ validator.limits().imageMb }} MB c/u
          </p>
        </div>

        <!-- Tomar foto (cámara en móvil/tablet) -->
        <button type="button" class="eg-btn-secondary w-full" (click)="cameraInput.click()">
          <i class="fa-solid fa-camera"></i> Tomar foto
        </button>
        <input #cameraInput type="file" accept="image/*" capture="environment" class="hidden" (change)="onFilesPicked($event)" />

        <!-- Añadir por URL -->
        <div class="flex gap-2">
          <div class="flex-1 relative">
            <i class="fa-solid fa-link absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px]"
               [style.color]="'var(--dash-text-soft)'"></i>
            <input type="url" [(ngModel)]="urlInput"
                   placeholder="https://imagen.com/foto.jpg (opcional)"
                   class="eg-input has-icon-left"
                   (keyup.enter)="addUrl()" />
          </div>
          <button type="button" class="eg-btn-secondary" (click)="addUrl()" [disabled]="!urlInput.trim()">
            <i class="fa-solid fa-plus"></i> Añadir URL
          </button>
        </div>
      }

      @if (!images().length && optional) {
        <p class="text-xs text-center" [style.color]="'var(--dash-text-soft)'">
          Las imágenes son opcionales. Puedes guardar el producto sin ellas.
        </p>
      }
    </div>
  `,
})
export class DlxImageUploaderComponent implements ControlValueAccessor {
  private validatorSvc = inject(FileValidatorService);
  private notify = inject(NotifyService);
  private uploads = inject(ProductService);
  uploading = signal(false);

  validator = this.validatorSvc;

  @Input() label = 'Galería de imágenes';
  @Input() maxImages = 10;
  @Input() accept = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif';
  @Input() acceptLabel = 'PNG, JPG, WEBP, SVG, GIF, AVIF';
  @Input() optional = true;
  @Output() changed = new EventEmitter<DlxImageItem[]>();

  images = signal<DlxImageItem[]>([]);
  dragging = signal(false);
  urlInput = '';

  private onChangeFn: (v: DlxImageItem[]) => void = () => {};
  private onTouchedFn = () => {};

  writeValue(v: DlxImageItem[] | null) {
    this.images.set(v ?? []);
    this.syncMain();
  }
  registerOnChange(fn: any) { this.onChangeFn = fn; }
  registerOnTouched(fn: any) { this.onTouchedFn = fn; }

  private emit() {
    this.onChangeFn(this.images());
    this.changed.emit(this.images());
    this.onTouchedFn();
  }

  private syncMain() {
    const arr = this.images();
    if (arr.length === 0) return;
    if (!arr.some(i => i.isMain)) {
      arr[0].isMain = true;
      this.images.set([...arr]);
    }
  }

  // ─── Drag & drop ───
  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(true);
  }
  onDragLeave(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
  }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.dragging.set(false);
    const files = ev.dataTransfer?.files;
    if (files?.length) this.addFiles(Array.from(files));
  }

  // ─── Selector de archivos ───
  onFilesPicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  private addFiles(files: File[]) {
    const room = this.maxImages - this.images().length;
    const toAdd = files.slice(0, room);
    if (files.length > room) {
      this.notify.warning(`Sólo se añadirán ${room} imágenes`, {
        description: `Máximo permitido: ${this.maxImages}`,
      });
    }
    let added = 0;
    let pending = toAdd.length;
    toAdd.forEach(file => {
      const res = this.validator.validate(file, 'image');
      if (!res.ok) {
        this.notify.warning(`${file.name} no válida`, { description: res.reason });
        if (--pending === 0 && added > 0) this.emit();
        return;
      }
      this.uploading.set(true);
      this.uploads.uploadImage(file).subscribe({
        next: r => {
          const arr = [...this.images(), { url: r.url, isMain: this.images().length === 0 }];
          this.images.set(arr);
          added++;
          if (--pending === 0) { this.emit(); this.uploading.set(false); }
        },
        error: e => {
          this.notify.warning(`No se pudo subir ${file.name}`);
          if (--pending === 0) { if (added > 0) this.emit(); this.uploading.set(false); }
        },
      });
    });
  }

  // ─── Añadir por URL ───
  addUrl() {
    const url = this.urlInput.trim();
    if (!url) return;
    if (this.images().length >= this.maxImages) {
      this.notify.warning('Máximo alcanzado');
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:')) {
      this.notify.warning('URL inválida', { description: 'Debe empezar con http:// o https://' });
      return;
    }
    const arr = [...this.images(), { url, isMain: this.images().length === 0 }];
    this.images.set(arr);
    this.urlInput = '';
    this.emit();
  }

  // ─── Acciones galería ───
  setMain(idx: number) {
    const arr = this.images().map((img, i) => ({ ...img, isMain: i === idx }));
    this.images.set(arr);
    this.emit();
  }

  move(from: number, to: number) {
    if (to < 0 || to >= this.images().length) return;
    const arr = [...this.images()];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    // Si la moved era main, sigue siendo main
    this.images.set(arr);
    this.emit();
  }

  remove(idx: number) {
    const arr = this.images().filter((_, i) => i !== idx);
    // Si quitamos la main y aún quedan imágenes, marcar la primera
    if (arr.length && !arr.some(i => i.isMain)) arr[0].isMain = true;
    this.images.set(arr);
    this.emit();
  }

  onImgErr(ev: Event) {
    (ev.target as HTMLImageElement).src =
      'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'>' +
      '<rect width=\'100\' height=\'100\' fill=\'%23e2e8f0\'/>' +
      '<text x=\'50\' y=\'55\' text-anchor=\'middle\' fill=\'%2394a3b8\' font-size=\'12\'>error</text></svg>';
  }
}
