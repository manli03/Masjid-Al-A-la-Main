import { inject, InjectionToken } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Dialog } from '@capacitor/dialog';
import { Preferences } from '@capacitor/preferences';

export const UPDATE_RUNTIME = new InjectionToken('UPDATE_RUNTIME', {
  providedIn: 'root', factory: () => {
    const alerts = inject(AlertController);
    return { app: App, preferences: Preferences, dialog: {
      confirm: async (options: Parameters<typeof Dialog.confirm>[0]) => {
        const alert = await alerts.create({
          header: options.title, message: options.message, cssClass: 'app-update-alert',
          buttons: [{ text: options.cancelButtonTitle || 'Kemudian', role: 'cancel' },
            { text: options.okButtonTitle || 'Teruskan', role: 'confirm' }],
        });
        await alert.present();
        return { value: (await alert.onDidDismiss()).role === 'confirm' };
      },
      alert: async (options: Parameters<typeof Dialog.alert>[0]) => {
        const alert = await alerts.create({
          header: options.title, message: options.message, cssClass: 'app-update-alert',
          buttons: [options.buttonTitle || 'Faham'],
        });
        await alert.present();
        await alert.onDidDismiss();
      },
    } as typeof Dialog };
  },
});
export type UpdateRuntime = { app: typeof App; dialog: typeof Dialog; preferences: typeof Preferences };

export interface AppRelease {
  versionCode: number;
  versionName: string;
  size: number;
  notes: string;
}

export interface UpdateDownload {
  state: 'idle' | 'downloading' | 'paused' | 'verifying' | 'installing' | 'ready' | 'failed';
  versionCode?: number;
  versionName?: string;
  bytes?: number;
  total?: number;
  message?: string;
}

export interface AppUpdaterPlugin {
  addListener(event: 'downloadProgress', listener: (download: UpdateDownload) => void): Promise<PluginListenerHandle>;
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
