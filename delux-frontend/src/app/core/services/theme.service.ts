import { Injectable, computed, signal } from '@angular/core';

type ThemeMode = 'dark' | 'light';
const KEY = 'dlx_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _mode = signal<ThemeMode>(this.readInitial());
  /** Tema forzado por contexto (ej: publico/auth siempre claro). null = usa preferencia del usuario. */
  private _forced = signal<ThemeMode | null>(null);

  readonly mode = computed(() => this._mode());
  /** Tema efectivamente aplicado (forzado si existe, sino la preferencia). */
  readonly effective = computed(() => this._forced() ?? this._mode());
  readonly isDark = computed(() => this.effective() === 'dark');

  constructor() {
    if (typeof document !== 'undefined') this.applyEffective();
  }

  toggle(): void {
    const next: ThemeMode = this._mode() === 'dark' ? 'light' : 'dark';
    this.setMode(next);
  }

  setMode(m: ThemeMode): void {
    this._mode.set(m);
    if (typeof window !== 'undefined') localStorage.setItem(KEY, m);
    this.applyEffective();
  }

  /** Fuerza un tema por contexto (ej: 'light' en publico). Pasar null libera el forzado. */
  force(m: ThemeMode | null): void {
    this._forced.set(m);
    this.applyEffective();
  }

  private applyEffective(): void {
    if (typeof document === 'undefined') return;
    this.apply(this._forced() ?? this._mode());
  }

  private apply(m: ThemeMode): void {
    const root = document.documentElement;
    if (m === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.dataset['theme'] = m;
    root.style.colorScheme = m;
  }

  private readInitial(): ThemeMode {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem(KEY) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  }
}
