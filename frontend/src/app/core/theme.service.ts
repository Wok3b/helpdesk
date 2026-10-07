import { effect, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'helpdesk.dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal<boolean>(initialDark());

  constructor() {
    effect(() => {
      const dark = this.dark();
      document.documentElement.classList.toggle('app-dark', dark);
      try {
        localStorage.setItem(STORAGE_KEY, String(dark));
      } catch {
        // Private mode: the choice just isn't remembered.
      }
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
  }
}

function initialDark(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
