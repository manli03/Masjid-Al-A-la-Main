import { InjectionToken } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { Preferences } from '@capacitor/preferences';

export const UPDATE_RUNTIME = new InjectionToken('UPDATE_RUNTIME', {
  providedIn: 'root', factory: () => ({ app: App, dialog: Dialog, preferences: Preferences }),
});
export type UpdateRuntime = { app: typeof App; dialog: typeof Dialog; preferences: typeof Preferences };

export interface AppRelease {
  versionCode: number;
  versionName: string;
  size: number;
  notes: string;
}

export interface UpdateDownload {
  state: 'idle' | 'downloading' | 'paused' | 'ready' | 'failed';
  versionCode?: number;
  versionName?: string;
  bytes?: number;
  total?: number;
  message?: string;
}

export interface AppUpdaterPlugin {
  getRelease(): Promise<{ release?: AppRelease }>;
  startDownload(): Promise<void>;
  getDownload(): Promise<UpdateDownload>;
  install(): Promise<{ permissionRequired: boolean }>;
  openInstallSettings(): Promise<void>;
}

export const APP_UPDATER = new InjectionToken<AppUpdaterPlugin>('APP_UPDATER', {
  providedIn: 'root',
  factory: () => registerPlugin<AppUpdaterPlugin>('AppUpdater'),
});
