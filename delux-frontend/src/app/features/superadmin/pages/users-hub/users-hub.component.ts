import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersListComponent } from '@features/superadmin/pages/users-list/users-list.component';

type Tab = 'sistema' | 'clientes';

/**
 * Módulo unificado de Usuarios. Clasifica las cuentas en dos grupos claros:
 *  - Sistema: el equipo interno (administradores, gerentes, vendedores).
 *  - Clientes: las cuentas con rol Cliente de la plataforma.
 * Cada cuenta pertenece a un único grupo según su rol (sin duplicados).
 */
@Component({
  selector: 'dlx-users-hub',
  standalone: true,
  imports: [CommonModule, UsersListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5">
      <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Usuarios</h1>
      <p class="text-slate-500 text-sm mt-1">
        Equipo interno y clientes de la plataforma, separados con claridad.
      </p>
    </div>

    <div class="flex flex-wrap gap-1 p-1 mb-5 rounded-xl bg-slate-100 dark:bg-white/5 w-fit">
      @for (t of tabs; track t.key) {
        <button (click)="tab.set(t.key)"
                class="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition"
                [class.bg-white]="tab() === t.key"
                [class.shadow-sm]="tab() === t.key"
                [class.text-ink-950]="tab() === t.key"
                [class.dark:bg-white/10]="tab() === t.key"
                [class.dark:text-white]="tab() === t.key"
                [class.text-slate-500]="tab() !== t.key">
          <i class="fa-solid {{ t.icon }} text-xs"></i> {{ t.label }}
        </button>
      }
    </div>

    @switch (tab()) {
      @case ('sistema')  { <dlx-users-list scope="system" /> }
      @case ('clientes') { <dlx-users-list scope="clients" /> }
    }
  `,
})
export class UsersHubComponent {
  tab = signal<Tab>('sistema');
  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'sistema',  label: 'Sistema',  icon: 'fa-user-tie' },
    { key: 'clientes', label: 'Clientes', icon: 'fa-user-group' },
  ];
}
