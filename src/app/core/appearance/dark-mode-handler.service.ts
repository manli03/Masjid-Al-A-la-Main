import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class DarkModeHandlerService {
  paletteToggle = false;
  darkModePreference: string = 'system';
  private systemThemeMediaQuery!: MediaQueryList;
  private systemThemeListener!: (e: MediaQueryListEvent) => void;

  constructor() {
    this.initializeSystemThemeListener();
  }

  async loadDarkModePreference() {
    try {
      const { value } = await Preferences.get({ key: 'dark_mode_preference' });
      console.log('Loaded dark mode preference:', value);
      if (value) {
        this.darkModePreference = value;
      } else {
        this.darkModePreference = 'system';
        await this.saveDarkModePreference('system');
      }
      this.applyDarkMode();
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
      this.darkModePreference = 'system';
      this.applyDarkMode();
    }
  }

  async changeDarkMode(preference: string) {
    console.log('Changing dark mode preference to:', preference);
    this.darkModePreference = preference;
    await this.saveDarkModePreference(preference);
    this.applyDarkMode();
  }

  private async saveDarkModePreference(preference: string) {
    try {
      await Preferences.set({ key: 'dark_mode_preference', value: preference });
      console.log('Saved dark mode preference:', preference);
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  }

  private applyDarkMode() {
    const element = document.documentElement;
    console.log('Applying dark mode, preference:', this.darkModePreference);

    if (this.darkModePreference === 'dark') {
      element.classList.add('ion-palette-dark');
      this.paletteToggle = true;
      console.log('Dark mode applied');
    } else if (this.darkModePreference === 'light') {
      element.classList.remove('ion-palette-dark');
      this.paletteToggle = false;
      console.log('Light mode applied');
    } else {
      // System preference
      const prefersDark =
        this.systemThemeMediaQuery?.matches ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      element.classList.toggle('ion-palette-dark', prefersDark);
      this.paletteToggle = prefersDark;
      console.log('System mode applied, dark:', prefersDark);
    }
  }

  private initializeSystemThemeListener() {
    // Initialize the media query for system theme detection
    this.systemThemeMediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)',
    );

    // Create the listener function
    this.systemThemeListener = (e: MediaQueryListEvent) => {
      console.log('System theme changed to:', e.matches ? 'dark' : 'light');
      // Only apply if user has selected 'system' preference
      if (this.darkModePreference === 'system') {
        const element = document.documentElement;
        element.classList.toggle('ion-palette-dark', e.matches);
        this.paletteToggle = e.matches;
        console.log('Applied system theme change');
      }
    };

    // Add the listener
    this.systemThemeMediaQuery.addEventListener(
      'change',
      this.systemThemeListener,
    );
    console.log('System theme listener initialized');
  }

  // Get current theme state
  getCurrentTheme(): 'light' | 'dark' {
    if (this.darkModePreference === 'dark') {
      return 'dark';
    } else if (this.darkModePreference === 'light') {
      return 'light';
    } else {
      // System preference
      return this.systemThemeMediaQuery?.matches ? 'dark' : 'light';
    }
  }

  // Get preference setting (system/light/dark)
  getPreference(): string {
    return this.darkModePreference;
  }

  // Check if dark mode is currently active
  isDarkMode(): boolean {
    return this.paletteToggle;
  }

  // Cleanup method - call this when the service is destroyed (optional)
  destroy() {
    if (this.systemThemeMediaQuery && this.systemThemeListener) {
      this.systemThemeMediaQuery.removeEventListener(
        'change',
        this.systemThemeListener,
      );
      console.log('System theme listener removed');
    }
  }
}
