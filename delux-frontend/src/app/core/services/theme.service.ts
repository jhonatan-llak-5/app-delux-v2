import { Injectable, computed, signal } from '@angular/core';

type ThemeMode = 'dark' | 'light';
const KEY = 'dlx_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private _mode = signal<ThemeMode>(this.readInitial());
  readonly mode = computed(() => this._mode());
  readonly isDark = computed(() => this._mode() === 'dark');

  constructor() {
    if (typeof document !== 'undefined') this.apply(this._mode());
  }

  toggle(): void {
    const next: ThemeMode = this._mode() === 'dark' ? 'light' : 'dark';
    this._mode.set(next);
    if (typeof window !== 'undefined') localStorage.setItem(KEY, next);
    this.apply(next);
  }

  setMode(m: ThemeMode): void {
    this._mode.set(m);
    if (typeof window !== 'undefined') localStorage.setItem(KEY, m);
    this.apply(m);
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
    return 'dark'; // default Delux
  }
}
