import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';
import { APP_UPDATER, AppRelease, AppUpdaterPlugin, UpdateDownload, UPDATE_RUNTIME, UpdateRuntime } from './app-updater.plugin';

@Injectable({ providedIn: 'root' })
export class CheckUpdateService implements OnDestroy {
  readonly supported = Capacitor.getPlatform() === 'android';
  readonly download$ = new BehaviorSubject<UpdateDownload>({ state: 'idle' });
  readonly checking$ = new BehaviorSubject(false);
  private active = true;
  private busy = false;
  private started = false;
  private timer?: ReturnType<typeof setTimeout>;
  private listener?: PluginListenerHandle;
  private awaitingPermission = false;
  private lastCheck = 0;
  private readonly reminderKey = 'app-update-last-prompt';

  constructor(@Inject(APP_UPDATER) private native: AppUpdaterPlugin,
    @Inject(UPDATE_RUNTIME) private runtime: UpdateRuntime) {}

  async initialize(): Promise<void> {
    if (!this.supported || this.started) return;
    this.started = true;
    try {
      this.listener = await this.runtime.app.addListener('appStateChange', ({ isActive }) => {
        this.active = isActive;
        clearTimeout(this.timer);
        if (isActive) void this.tick();
      });
      this.active = (await this.runtime.app.getState()).isActive;
      this.schedule(15000);
    } catch (error) {
      this.started = false;
      console.warn('Updater initialization failed:', error);
    }
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer);
    if (this.started && this.active) this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (!this.active) return;
    await this.checkForUpdate();
    const state = this.download$.value.state;
    this.schedule(state === 'downloading' || state === 'paused' ? 2000 : 60000);
  }

  async checkForUpdate(manual = false): Promise<void> {
    if (!this.supported || this.busy || !this.active) return;
    this.busy = true;
    this.checking$.next(true);
    try {
      const download = await this.native.getDownload();
      this.download$.next(download);
      if (download.state === 'ready') {
        const shown = await this.runtime.preferences.get({ key: 'app-update-install-prompt' });
        if (this.awaitingPermission && this.active) {
          this.awaitingPermission = false;
          await this.installReady(true);
        } else if (await this.mayPrompt(manual) ||
          (this.active && shown.value !== String(download.versionCode))) {
          await this.promptInstall(download);
        }
        return;
      }
      if (download.state === 'downloading' || download.state === 'paused') return;
      if (download.state === 'failed') {
        if (await this.mayPrompt(manual)) {
          await this.markPrompt();
          await this.runtime.dialog.alert({ title: 'Muat Turun Gagal', message: download.message ||
            'Muat turun tidak dapat diselesaikan. Sila cuba lagi melalui Tetapan.' });
        }
        if (!manual) return;
      }
      // Limit public GitHub API requests on foreground polling and app resumes.
      if (!manual && Date.now() - this.lastCheck < 6 * 60 * 60 * 1000) return;
      const previous = await this.runtime.preferences.get({ key: 'app-update-last-check' });
      if (!manual && Date.now() - Number(previous.value || 0) < 6 * 60 * 60 * 1000) return;
      if (!(await this.mayPrompt(manual))) return;
      const { release } = await this.native.getRelease();
      this.lastCheck = Date.now();
      await this.runtime.preferences.set({ key: 'app-update-last-check', value: String(this.lastCheck) });
      if (release && this.active) {
        await this.promptDownload(release);
      } else if (!release && manual && this.active) {
        await this.runtime.dialog.alert({ title: 'Kemas Kini', message: 'Aplikasi anda sudah menggunakan versi terkini.' });
      }
    } catch (error) {
      console.warn('Update check failed:', error);
      this.lastCheck = Date.now() - 6 * 60 * 60 * 1000 + 15 * 60 * 1000;
      if (manual && this.active) {
        await this.runtime.dialog.alert({ title: 'Semakan Gagal', message:
          'Tidak dapat menyemak kemas kini. Sila semak sambungan Internet dan cuba lagi.' });
      }
    } finally {
      this.busy = false;
      this.checking$.next(false);
      if (manual || this.awaitingPermission) this.schedule(2000);
    }
  }

  private async mayPrompt(manual: boolean): Promise<boolean> {
    if (!this.active) return false;
    if (manual) return true;
    const { value } = await this.runtime.preferences.get({ key: this.reminderKey });
    return value !== new Date().toDateString();
  }

  private markPrompt(): Promise<void> {
    return this.runtime.preferences.set({ key: this.reminderKey, value: new Date().toDateString() });
  }

  private async promptDownload(release: AppRelease): Promise<void> {
    await this.markPrompt();
    const { value } = await this.runtime.dialog.confirm({
      title: 'Kemas Kini Aplikasi Tersedia',
      message: `Versi ${release.versionName} (${(release.size / 1048576).toFixed(1)} MB) tersedia.` +
        (release.notes ? `\n\n${release.notes.slice(0, 1200)}` : '') +
        '\n\nAdakah anda mahu memuat turunnya sekarang?',
      okButtonTitle: 'Muat Turun', cancelButtonTitle: 'Kemudian',
    });
    if (!value || !this.active) return;
    try {
      await this.native.startDownload();
    } catch (error) {
      console.warn('Cannot start update download:', error);
      if (this.active) await this.runtime.dialog.alert({ title: 'Muat Turun Gagal', message:
        'Tidak dapat memulakan muat turun. Semak sambungan Internet dan ruang storan, kemudian cuba lagi melalui Tetapan.' });
      return;
    }
    this.download$.next({ state: 'downloading', versionCode: release.versionCode,
      versionName: release.versionName, bytes: 0, total: release.size });
    await this.runtime.preferences.remove({ key: 'app-update-install-prompt' });
    this.schedule(2000);
  }

  private async promptInstall(download: UpdateDownload): Promise<void> {
    if (!this.active) return;
    await this.runtime.preferences.set({ key: 'app-update-install-prompt', value: String(download.versionCode) });
    await this.markPrompt();
    const { value } = await this.runtime.dialog.confirm({
      title: 'Kemas Kini Sedia Dipasang',
      message: `Versi ${download.versionName} telah dimuat turun dan disahkan. Pasang sekarang?`,
      okButtonTitle: 'Pasang Sekarang', cancelButtonTitle: 'Kemudian',
    });
    if (value) await this.installReady();
  }

  private async installReady(returnedFromSettings = false): Promise<void> {
    if (!this.active) return;
    try {
      await this.requestInstallation(returnedFromSettings);
    } catch (error) {
      this.awaitingPermission = false;
      console.warn('Cannot install update:', error);
      if (this.active) await this.runtime.dialog.alert({ title: 'Pemasangan Gagal', message:
        'Tidak dapat membuka pemasang Android. Sila cuba lagi melalui Tetapan.' });
    }
  }

  private async requestInstallation(returnedFromSettings: boolean): Promise<void> {
    const result = await this.native.install();
    if (!result.permissionRequired || !this.active || returnedFromSettings) return;
    const { value } = await this.runtime.dialog.confirm({
      title: 'Benarkan Pemasangan',
      message: 'Benarkan pemasangan daripada aplikasi Masjid A’la dalam tetapan Android. Kembali ke aplikasi untuk meneruskan pemasangan.',
      okButtonTitle: 'Buka Tetapan', cancelButtonTitle: 'Kemudian',
    });
    if (value) {
      this.awaitingPermission = true;
      await this.native.openInstallSettings();
    }
  }

  ngOnDestroy(): void {
    this.started = false;
    clearTimeout(this.timer);
    void this.listener?.remove();
  }
}
