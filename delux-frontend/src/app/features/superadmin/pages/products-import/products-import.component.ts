import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DlxButtonComponent } from '@shared/ui/button.component';
import { DlxCardComponent } from '@shared/ui/card.component';
import { DlxPageHeaderComponent } from '@shared/ui/page-header.component';
import { NotifyService } from '@shared/services/notify.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import {
  ImportRow,
  ProductsImportService,
  RowStatus,
} from '@features/superadmin/services/products-import.service';

type Step = 1 | 2 | 3 | 4;

@Component({
  selector: 'dlx-products-import',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    DlxButtonComponent, DlxCardComponent, DlxPageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products-import.component.html',
})
export class ProductsImportComponent {
  private svc = inject(ProductsImportService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private adminSvc = inject(AdminService);
  private auth = inject(AuthService);

  // Sucursal(es) destino del stock (paso 2, obligatorio).
  branches = signal<AdminBranch[]>([]);
  selectedBranchCodes = signal<string[]>([]);
  branchLocked = signal(false);

  constructor() {
    this.adminSvc.listBranches().subscribe(r => {
      let list = r.results || [];
      const u = this.auth.user();
      if ((u?.role === 'BRANCH_MANAGER' || u?.role === 'SALESPERSON') && u.branch_id) {
        list = list.filter(b => b.id === u.branch_id);
        this.branchLocked.set(true);
        if (list.length) this.selectedBranchCodes.set([list[0].code]);
      }
      this.branches.set(list);
    });
  }

  isBranchSel(code: string): boolean { return this.selectedBranchCodes().includes(code); }
  toggleBranch(code: string): void {
    if (this.branchLocked()) return;
    const cur = this.selectedBranchCodes();
    this.selectedBranchCodes.set(cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code]);
  }

  step = signal<Step>(1);
  loading = signal(false);

  // Paso 2
  xlsxFile = signal<File | null>(null);
  rows = signal<ImportRow[]>([]);
  summary = signal<{ total: number; ok: number; warning: number; error: number } | null>(null);
  filter = signal<'all' | RowStatus>('all');
  showOnlyProblems = signal(false);

  // Paso 3
  zipFile = signal<File | null>(null);
  zipDragOver = signal(false);

  // Paso 4 (resultado)
  result = signal<{ created_count: number; skipped_count: number; created: any[]; skipped: any[] } | null>(null);

  // Filtros computados
  filteredRows = computed(() => {
    const f = this.filter();
    const all = this.rows();
    if (f === 'all') return all;
    return all.filter(r => r._status === f);
  });

  validRowsCount = computed(() => this.rows().filter(r => r._status !== 'error').length);

  // ---- Paso 1: descarga plantilla ----
  downloadTemplate() {
    this.loading.set(true);
    this.svc.downloadTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'delux-productos-plantilla.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.loading.set(false);
        this.notify.success('Plantilla descargada', { description: 'Edítala y vuelve para subirla.' });
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.fromServerError(err, 'No se pudo descargar la plantilla.');
      },
    });
  }

  goStep2() {
    this.step.set(2);
  }

  // ---- Paso 2: upload + dry-run ----
  onXlsxSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      this.notify.error('Formato inválido', { description: 'Solo se aceptan archivos .xlsx' });
      return;
    }
    this.xlsxFile.set(f);
    this.runDryRun(f);
  }

  runDryRun(f: File) {
    this.loading.set(true);
    this.svc.dryRun(f).subscribe({
      next: (res) => {
        this.rows.set(res.rows);
        this.summary.set(res.summary);
        this.loading.set(false);
        if (res.summary.error > 0) {
          this.notify.warning(`${res.summary.error} fila(s) con errores`, { description: 'Revisa el detalle abajo.' });
        } else if (res.summary.warning > 0) {
          this.notify.info(`${res.summary.warning} fila(s) con avisos`, { description: 'Puedes continuar.' });
        } else {
          this.notify.success(`${res.summary.ok} fila(s) válidas`, { description: 'Listo para continuar.' });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.fromServerError(err, 'Error procesando el archivo.');
      },
    });
  }

  clearXlsx() {
    this.xlsxFile.set(null);
    this.rows.set([]);
    this.summary.set(null);
  }

  goStep3() {
    if (this.validRowsCount() === 0) {
      this.notify.error('Nada que importar', { description: 'Todas las filas tienen errores.' });
      return;
    }
    this.step.set(3);
  }

  // ---- Paso 3: ZIP opcional ----
  onZipSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.acceptZip(f);
  }

  onZipDrop(ev: DragEvent) {
    ev.preventDefault();
    this.zipDragOver.set(false);
    const f = ev.dataTransfer?.files?.[0] ?? null;
    this.acceptZip(f);
  }

  onZipDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.zipDragOver.set(true);
  }

  onZipDragLeave() {
    this.zipDragOver.set(false);
  }

  private acceptZip(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      this.notify.error('Formato inválido', { description: 'Sube un archivo .zip.' });
      return;
    }
    this.zipFile.set(f);
  }

  clearZip() {
    this.zipFile.set(null);
  }

  // ---- Paso 3 → Commit ----
  doCommit() {
    const rows = this.rows().filter(r => r._status !== 'error');
    if (rows.length === 0) {
      this.notify.error('Sin filas válidas para importar.');
      return;
    }
    this.loading.set(true);
    this.svc.commit(rows, this.zipFile(), this.selectedBranchCodes()).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        this.step.set(4);
        this.notify.success(`${res.created_count} producto(s) creados`,
          res.skipped_count > 0 ? { description: `${res.skipped_count} omitidos.` } : undefined);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.fromServerError(err, 'Error en commit.');
      },
    });
  }

  // ---- Paso 4 → navegar ----
  goToProducts() {
    this.router.navigate(['/app/admin/products']);
  }

  resetAll() {
    this.step.set(1);
    this.xlsxFile.set(null);
    this.zipFile.set(null);
    this.rows.set([]);
    this.summary.set(null);
    this.result.set(null);
  }

  // ---- helpers UI ----
  rowBadgeClass(s: RowStatus): string {
    return s === 'ok'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : s === 'warning'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  }

  rowRowClass(s: RowStatus): string {
    return s === 'error'
      ? 'bg-rose-50/60 dark:bg-rose-500/5'
      : s === 'warning'
        ? 'bg-amber-50/40 dark:bg-amber-500/5'
        : '';
  }
}
