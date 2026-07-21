import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '@core/services/theme.service';
import { BrandingService } from '@core/services/branding.service';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/checkout/services/cart.service';
import { SearchOverlayComponent } from '@shared/components/search-overlay/search-overlay.component';
import { ZoneService } from '@shared/services/zone.service';

@Component({
  selector: 'dlx-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SearchOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './public-navbar.component.html',
})
export class PublicNavbarComponent {
  private readonly STAFF_ROLES = ['SUPERADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER', 'SALESPERSON'];

  theme = inject(ThemeService);
  cart = inject(CartService);
  zone = inject(ZoneService);
  branding = inject(BrandingService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject(ElementRef);

  searchOpen = signal(false);
  open = signal(false);
  accountOpen = signal(false);
  scrolled = signal(false);
  isHome = signal(false);
  /** El hero de Inicio es navy: el navbar va transparente + texto blanco arriba. */
  overHero = computed(() => this.isHome() && !this.scrolled());

  constructor() {
    this.isHome.set(this.isHomeUrl(this.router.url));
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.isHome.set(this.isHomeUrl(e.urlAfterRedirects));
    });
  }
  private isHomeUrl(u: string): boolean {
    const path = (u || '/').split('?')[0].split('#')[0];
    return path === '/' || path === '';
  }

  userName  = computed(() => this.auth.user()?.full_name ?? 'Usuario');
  userEmail = computed(() => this.auth.user()?.email ?? '');
  initials  = computed(() => {
    const n = this.userName();
    return n.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'U';
  });
  isStaff = computed(() => {
    const r = this.auth.user()?.role;
    return !!r && this.STAFF_ROLES.includes(r);
  });
  panelRoute = computed(() => {
    const r = this.auth.user()?.role;
    if (r === 'SALESPERSON') return '/app/admin/seller';
    if (r === 'AFFILIATE') return '/app/affiliate';
    return '/app/admin/overview';
  });
  hasPanel = computed(() => {
    const r = this.auth.user()?.role;
    return !!r && r !== 'CUSTOMER';
  });
  roleLabel = computed(() => {
    const r = this.auth.user()?.role;
    return ({
      SUPERADMIN: 'Superadmin', TENANT_ADMIN: 'Admin tienda',
      BRANCH_MANAGER: 'Gerente sucursal', SALESPERSON: 'Vendedor', AFFILIATE: 'Afiliado',
    } as Record<string, string>)[r ?? ''] ?? 'Cliente';
  });

  get hasToken(): boolean {
    return typeof window !== 'undefined' && !!localStorage.getItem('dlx_access_token');
  }

  toggle() { this.open.update(v => !v); this.lockScroll(this.open()); }
  close() { this.open.set(false); this.lockScroll(false); }
  private lockScroll(on: boolean) {
    if (typeof document !== 'undefined') document.body.style.overflow = on ? 'hidden' : '';
  }

  logout() {
    this.accountOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/']);
  }

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set(typeof window !== 'undefined' && window.scrollY > 30);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.accountOpen()) return;
    const el = this.host.nativeElement as HTMLElement;
    if (!el.contains(ev.target as Node)) this.accountOpen.set(false);
  }
}
