import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, CategoryService, CategoryTreeNode } from '@features/superadmin/services/category.service';
import { CategoryFormModalComponent } from '@features/superadmin/components/category-form-modal/category-form-modal.component';

@Component({
  selector: 'dlx-categories-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <i class="fa-solid fa-folder-tree"></i>
          <span class="uppercase tracking-widest font-semibold">Catálogo</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">Categorías</h1>
        <p class="text-slate-500 text-sm mt-1">
          Organiza el catálogo en árbol jerárquico. {{ totalCount() }} categorías en total.
        </p>
      </div>
      <div class="flex gap-2">
        <button (click)="reload()" class="btn-secondary text-sm" [disabled]="loading()">
          <i class="fa-solid" [class.fa-arrows-rotate]="!loading()" [class.fa-spinner]="loading()" [class.fa-spin]="loading()"></i>
          Actualizar
        </button>
        <button (click)="openCreate(null)"
                class="px-4 py-2.5 rounded-lg bg-ink-950 text-white text-sm font-semibold
                       hover:bg-ink-900 transition flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> Nueva categoría
        </button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Raíces</p>
        <p class="text-2xl font-bold mt-1">{{ rootCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Subcategorías</p>
        <p class="text-2xl font-bold mt-1">{{ subCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Activas</p>
        <p class="text-2xl font-bold text-emerald-600 mt-1">{{ activeCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-widest text-slate-500 font-semibold">Inactivas</p>
        <p class="text-2xl font-bold text-slate-400 mt-1">{{ inactiveCount() }}</p>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="card p-4 mb-4 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-64">
        <i class="fa-solid fa-magnifying-glass text-sm absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input [ngModel]="search()" (ngModelChange)="search.set($event)"
               placeholder="Buscar categoría por nombre o slug..."
               class="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-transparent
                      focus:bg-white focus:border-slate-300 focus:outline-none text-sm" />
      </div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" [(ngModel)]="onlyActive" (change)="reload()" class="w-4 h-4 accent-emerald-500" />
        <span>Solo activas</span>
      </label>
      <button (click)="expandAll()" class="text-xs text-slate-500 hover:text-ink-950">
        <i class="fa-solid fa-angles-down"></i> Expandir todo
      </button>
      <button (click)="collapseAll()" class="text-xs text-slate-500 hover:text-ink-950">
        <i class="fa-solid fa-angles-up"></i> Colapsar todo
      </button>
    </div>

    <!-- Tree -->
    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="px-6 py-16 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-2xl mb-3"></i>
          <p>Cargando árbol...</p>
        </div>
      } @else if (tree().length === 0) {
        <div class="px-6 py-16 text-center text-slate-400">
          <i class="fa-solid fa-folder-tree text-3xl mb-3"></i>
          <p class="mb-3">Aún no hay categorías.</p>
          <button (click)="openCreate(null)" class="btn-secondary text-sm">
            <i class="fa-solid fa-plus"></i> Crear primera categoría
          </button>
        </div>
      } @else {
        <ul class="divide-y divide-slate-100">
          @for (root of filteredTree(); track root.id) {
            <ng-container *ngTemplateOutlet="treeNode; context: { $implicit: root, depth: 0 }"></ng-container>
          }
        </ul>
      }
    </div>

    <ng-template #treeNode let-node let-depth="depth">
      <li>
        <div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition group"
             [style.paddingLeft.px]="20 + depth * 28">

          <!-- Expand toggle -->
          @if (node.children?.length) {
            <button (click)="toggle(node.id)"
                    class="w-6 h-6 grid place-items-center rounded hover:bg-slate-200 transition"
                    [attr.aria-label]="isExpanded(node.id) ? 'Colapsar' : 'Expandir'">
              <i class="fa-solid fa-chevron-right text-xs text-slate-500 transition-transform"
                 [class.rotate-90]="isExpanded(node.id)"></i>
            </button>
          } @else {
            <span class="w-6 h-6"></span>
          }

          <!-- Icon -->
          <div class="w-9 h-9 rounded-lg grid place-items-center text-sm"
               [class.bg-ink-950]="depth === 0"
               [class.text-white]="depth === 0"
               [class.bg-slate-100]="depth > 0"
               [class.text-slate-600]="depth > 0">
            @if (node.icon) {
              <i class="fa-solid {{ node.icon }}"></i>
            } @else {
              <i class="fa-solid fa-folder"></i>
            }
          </div>

          <!-- Name + meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm truncate">{{ node.name }}</span>
              @if (!node.is_active) {
                <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  Inactiva
                </span>
              }
              @if (node.children?.length) {
                <span class="text-[10px] font-mono text-slate-400">
                  {{ node.children.length }} sub
                </span>
              }
            </div>
            <div class="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
              /{{ node.slug }} · orden {{ node.sort_order }}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button (click)="openCreate(node.id)"
                    class="w-8 h-8 grid place-items-center rounded-lg hover:bg-emerald-100 hover:text-emerald-700 transition text-slate-500"
                    title="Crear subcategoría">
              <i class="fa-solid fa-plus text-xs"></i>
            </button>
            <button (click)="openEdit(node)"
                    class="w-8 h-8 grid place-items-center rounded-lg hover:bg-sky-100 hover:text-sky-700 transition text-slate-500"
                    title="Editar">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button (click)="toggleActive(node)"
                    class="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-100 hover:text-amber-700 transition text-slate-500"
                    [title]="node.is_active ? 'Desactivar' : 'Activar'">
              <i class="fa-solid" [class.fa-eye]="node.is_active" [class.fa-eye-slash]="!node.is_active" [class.text-xs]="true"></i>
            </button>
            <button (click)="remove(node)"
                    class="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose-100 hover:text-rose-700 transition text-slate-500"
                    title="Eliminar">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>

        @if (isExpanded(node.id) && node.children?.length) {
          <ul class="bg-slate-50/40">
            @for (child of node.children; track child.id) {
              <ng-container *ngTemplateOutlet="treeNode; context: { $implicit: child, depth: depth + 1 }"></ng-container>
            }
          </ul>
        }
      </li>
    </ng-template>

    @if (showModal()) {
      <dlx-category-form-modal
        [category]="editing()"
        [defaultParent]="defaultParent()"
        (close)="closeModal()"
        (saved)="onSaved()" />
    }
  `,
})
export class CategoriesTreeComponent implements OnInit {
  private service = inject(CategoryService);

  tree = signal<CategoryTreeNode[]>([]);
  loading = signal(true);
  search = signal('');
  onlyActive = false;

  expandedIds = signal<Set<number>>(new Set());
  showModal = signal(false);
  editing = signal<Category | null>(null);
  defaultParent = signal<number | null>(null);

  totalCount = computed(() => this.flatten(this.tree()).length);
  rootCount = computed(() => this.tree().length);
  subCount = computed(() => this.flatten(this.tree()).length - this.tree().length);
  activeCount = computed(() => this.flatten(this.tree()).filter(n => n.is_active).length);
  inactiveCount = computed(() => this.flatten(this.tree()).filter(n => !n.is_active).length);

  filteredTree = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.tree();
    // Devuelve solo árboles que contengan match (en cualquier nivel)
    const filter = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
      const out: CategoryTreeNode[] = [];
      for (const n of nodes) {
        const matchesSelf = n.name.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q);
        const filteredChildren = filter(n.children || []);
        if (matchesSelf || filteredChildren.length) {
          out.push({ ...n, children: filteredChildren });
        }
      }
      return out;
    };
    return filter(this.tree());
  });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.service.tree(this.onlyActive).subscribe({
      next: r => {
        this.tree.set(r.results);
        this.loading.set(false);
        // Expandir raíces por defecto
        const ids = new Set<number>();
        r.results.forEach(n => ids.add(n.id));
        this.expandedIds.set(ids);
      },
      error: () => this.loading.set(false),
    });
  }

  flatten(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
    const out: CategoryTreeNode[] = [];
    const walk = (xs: CategoryTreeNode[]) => xs.forEach(n => { out.push(n); if (n.children) walk(n.children); });
    walk(nodes);
    return out;
  }

  isExpanded(id: number): boolean { return this.expandedIds().has(id); }

  toggle(id: number): void {
    const set = new Set(this.expandedIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.expandedIds.set(set);
  }

  expandAll(): void {
    const set = new Set<number>();
    this.flatten(this.tree()).forEach(n => set.add(n.id));
    this.expandedIds.set(set);
  }

  collapseAll(): void { this.expandedIds.set(new Set()); }

  openCreate(parentId: number | null): void {
    this.editing.set(null);
    this.defaultParent.set(parentId);
    this.showModal.set(true);
  }

  openEdit(node: CategoryTreeNode): void {
    // Convertir tree node a Category (suficiente para edición)
    const cat: Category = {
      id: node.id, name: node.name, slug: node.slug,
      parent: node.parent, parent_name: null,
      icon: node.icon, sort_order: node.sort_order,
      is_active: node.is_active, children_count: node.children?.length || 0,
      created_at: '', updated_at: '',
    };
    this.editing.set(cat);
    this.defaultParent.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editing.set(null);
    this.defaultParent.set(null);
  }

  onSaved(): void {
    this.closeModal();
    this.reload();
  }

  toggleActive(node: CategoryTreeNode): void {
    this.service.toggleActive(node.id).subscribe(() => this.reload());
  }

  remove(node: CategoryTreeNode): void {
    const subs = node.children?.length ? ` y sus ${node.children.length} subcategorías` : '';
    if (!confirm(`¿Eliminar "${node.name}"${subs}? Esta acción no se puede deshacer.`)) return;
    this.service.delete(node.id).subscribe({
      next: () => this.reload(),
      error: e => alert('No se pudo eliminar: ' + (e?.error?.detail || 'error')),
    });
  }
}
