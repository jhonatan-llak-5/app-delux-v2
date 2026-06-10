import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileValidatorService, FileKind } from '@shared/services/file-validator.service';
import { NotifyService } from '@shared/services/notify.service';

@Component({
  selector: 'dlx-file-upload',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-lg border border-slate-200 p-4 dark:border-[#334155] dark:bg-[#0b1220]/40">
      <span class="eg-label">{{ label }}</span>
      <div class="mt-3 flex items-center gap-4">
        <div class="flex items-center justify-center overflow-hidden rounded-lg
                    border border-dashed border-slate-300 bg-slate-50
                    dark:border-[#334155] dark:bg-[#0b1220]"
             [style.height.px]="previewSize" [style.width.px]="previewSize">
          @if (preview()) {
            <img [src]="preview()" alt="Nuevo" [style.max-height.px]="previewSize - 8"
                 [style.max-width.px]="previewSize - 8" class="object-contain" />
          } @else if (currentUrl) {
            <img [src]="currentUrl" alt="Actual" [style.max-height.px]="previewSize - 8"
                 [style.max-width.px]="previewSize - 8" class="object-contain" />
          } @else {
            <span class="text-xs text-slate-400">{{ emptyText }}</span>
          }
        </div>
        <div class="space-y-2">
          <label class="eg-btn-secondary cursor-pointer">
            <input type="file" class="hidden" [accept]="accept" (change)="onSelected($event)" />
            <i class="fa-solid fa-upload"></i> {{ buttonText }}
          </label>
          @if (selected(); as file) {
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{{ file.name }}</p>
            <button type="button" (click)="clear()"
                    class="text-xs font-semibold text-rose-600 hover:underline">
              Quitar selección
            </button>
          } @else {
            <p class="text-xs text-slate-400">{{ helpText }}</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class DlxFileUploadComponent {
  private validator = inject(FileValidatorService);
  private notify = inject(NotifyService);

  @Input({ required: true }) label = '';
  @Input() kind: FileKind = 'image';
  @Input() accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
  @Input() currentUrl?: string | null;
  @Input() buttonText = 'Subir';
  @Input() emptyText = 'Sin archivo';
  @Input() helpText = '';
  @Input() previewSize = 96;
  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileCleared = new EventEmitter<void>();

  selected = signal<File | null>(null);
  preview = signal<string | null>(null);

  onSelected(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = this.validator.validate(file, this.kind);
    if (!res.ok) {
      this.notify.warning('Archivo no válido', { description: res.reason });
      return;
    }
    this.selected.set(file);
    const r = new FileReader();
    r.onload = () => this.preview.set(r.result as string);
    r.readAsDataURL(file);
    this.fileSelected.emit(file);
  }

  clear() {
    this.selected.set(null);
    this.preview.set(null);
    this.fileCleared.emit();
  }
}
