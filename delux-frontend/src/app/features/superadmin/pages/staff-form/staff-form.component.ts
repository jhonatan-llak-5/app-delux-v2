import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DlxFieldErrorComponent } from '@shared/ui/field-error.component';
import { DlxPriceInputComponent } from '@shared/ui/price-input.component';
import { DlxInputComponent } from '@shared/ui/input.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { StaffService, StaffPayload, SalesMetrics } from '@features/superadmin/services/staff.service';
import { AdminService, AdminBranch } from '@features/superadmin/services/admin.service';
import { parseApiError } from '@shared/utils/api-error.util';

@Component({
  selector: 'dlx-staff-form',
  standalone: true,
  imports: [DlxFieldErrorComponent, DlxPriceInputComponent, DlxInputComponent, CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './staff-form.component.html',
})
export class StaffFormComponent implements OnInit {
  private svc = inject(StaffService);
  private adminSvc = inject(AdminService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  branches = signal<AdminBranch[]>([]);
  staffId = signal<number | null>(null);
  isEdit = computed(() => this.staffId() !== null);
  saving = signal(false);
  error = signal<string | null>(null);
  fieldErrors = signal<Record<string, string>>({});
  fe(k: string): string { return this.fieldErrors()[k] || ''; }
  metrics = signal<SalesMetrics | null>(null);
  createdCreds = signal<{ email: string; password: string; generated: boolean; emailed: boolean } | null>(null);

  payload: StaffPayload = {
    email: '', full_name: '', phone: '', document_id: '',
    role: 'SALESPERSON', branch: null as any,
    commission_rate: 0, monthly_salary: 0, hire_date: null,
    password: '',
  };

  ngOnInit() {
    this.adminSvc.listBranches().subscribe(r => this.branches.set(r.results || []));
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.staffId.set(+id);
      this.svc.get(+id).subscribe(s => {
        this.payload = {
          email: s.email, full_name: s.full_name,
          phone: s.phone, document_id: s.document_id,
          role: s.role, branch: s.branch!,
          commission_rate: +s.commission_rate,
          monthly_salary: +s.monthly_salary,
          hire_date: s.hire_date,
        };
      });
      this.svc.metrics(+id).subscribe(m => this.metrics.set(m));
    }
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    this.fieldErrors.set({});
    const body = { ...this.payload };
    if (!body.password) delete body.password;
    const obs = this.isEdit()
      ? this.svc.update(this.staffId()!, body)
      : this.svc.create(body);
    obs.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (this.isEdit()) {
          this.router.navigate(['/app/admin/users']);
        } else {
          // Mostrar credenciales una sola vez.
          this.createdCreds.set({
            email: res?.email || this.payload.email,
            password: res?.temp_password || this.payload.password || '(definida por ti)',
            generated: !!res?.password_generated,
            emailed: !!res?.credentials_emailed,
          });
        }
      },
      error: e => {
        this.saving.set(false);
        const p = parseApiError(e);
        this.fieldErrors.set(p.fieldErrors);
        this.error.set(Object.keys(p.fieldErrors).length ? null : (p.message || 'Error al guardar'));
      },
    });
  }

  copy(text: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  goToList() { this.router.navigate(['/app/admin/users']); }

  createAnother() {
    this.createdCreds.set(null);
    this.payload = {
      email: '', full_name: '', phone: '', document_id: '',
      role: 'SALESPERSON', branch: null as any,
      commission_rate: 0, monthly_salary: 0, hire_date: null, password: '',
    };
  }
}
