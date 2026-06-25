import { Injectable, signal } from '@angular/core';

/**
 * Estado del splash de intro. Permite que otros componentes (p. ej. el
 * selector de ciudad) esperen a que el splash termine antes de aparecer.
 */
@Injectable({ providedIn: 'root' })
export class SplashService {
  /** true cuando el splash terminó (o decidió no mostrarse en esta sesión). */
  readonly done = signal(false);

  markDone(): void {
    this.done.set(true);
  }
}
