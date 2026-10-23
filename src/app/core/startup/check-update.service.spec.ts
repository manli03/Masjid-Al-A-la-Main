import { Capacitor } from '@capacitor/core';
import { Dialog } from '@capacitor/dialog';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { CheckUpdateService } from './check-update.service';
import { AppUpdaterPlugin, AppRelease, UpdateRuntime } from './app-updater.plugin';

describe('CheckUpdateService', () => {
  let service: CheckUpdateService;
  let native: jasmine.SpyObj<AppUpdaterPlugin>;
  let storage: Map<string, string>;
  let confirm: jasmine.Spy;
  let runtime: UpdateRuntime;
  const release: AppRelease = { versionCode: 9, versionName: '1.2.3', size: 1048576, notes: 'Pembetulan' };

  beforeEach(() => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    runtime = {
      app: jasmine.createSpyObj<typeof App>('App', ['addListener', 'getState']),
      dialog: jasmine.createSpyObj<typeof Dialog>('Dialog', ['confirm', 'alert']),
      preferences: jasmine.createSpyObj<typeof Preferences>('Preferences', ['get', 'set', 'remove']),
    };
    storage = new Map();
    (runtime.preferences.get as jasmine.Spy).and.callFake(async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null }));
    (runtime.preferences.set as jasmine.Spy).and.callFake(async ({ key, value }: { key: string; value: string }) => { storage.set(key, value); });
    (runtime.preferences.remove as jasmine.Spy).and.callFake(async ({ key }: { key: string }) => { storage.delete(key); });
    confirm = runtime.dialog.confirm as jasmine.Spy;
    confirm.and.resolveTo({ value: false });
    (runtime.dialog.alert as jasmine.Spy).and.resolveTo();
    native = jasmine.createSpyObj<AppUpdaterPlugin>('AppUpdater',
      ['addListener', 'getRelease', 'getDownload', 'startDownload', 'install', 'openInstallSettings']);
    native.addListener.and.resolveTo({ remove: async () => undefined });
    native.getDownload.and.resolveTo({ state: 'idle' });
    native.getRelease.and.resolveTo({ release });
    native.startDownload.and.resolveTo();
    native.install.and.resolveTo({ permissionRequired: false });
    native.openInstallSettings.and.resolveTo();
    service = new CheckUpdateService(native, runtime);
  });

  afterEach(() => service.ngOnDestroy());

  it('asks before downloading and honours Later across service instances', async () => {
    await service.checkForUpdate();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(native.startDownload).not.toHaveBeenCalled();
    service.ngOnDestroy();
    service = new CheckUpdateService(native, runtime);
    await service.checkForUpdate();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('downloads only after consent', async () => {
    confirm.and.resolveTo({ value: true });
    await service.checkForUpdate();
    expect(native.startDownload).toHaveBeenCalledTimes(1);
    expect(service.download$.value.state).toBe('downloading');
    expect(native.install).not.toHaveBeenCalled();
  });

  it('does not offer another release while the downloaded file is being verified', async () => {
    native.getDownload.and.resolveTo({ state: 'verifying', versionCode: 9 });
    await service.checkForUpdate(true);
    expect(native.getRelease).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('automatically opens installer after verification even when the download prompt was today', async () => {
    storage.set('app-update-last-prompt', new Date().toDateString());
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9, versionName: '1.2.3' });
    await service.checkForUpdate();
    expect(confirm).not.toHaveBeenCalled();
    expect(native.install).toHaveBeenCalledTimes(1);
    await service.checkForUpdate();
    expect(native.install).toHaveBeenCalledTimes(1);
  });

  it('reminds again the next day for a downloaded update', async () => {
    storage.set('app-update-last-prompt', 'yesterday');
    storage.set('app-update-install-prompt', '9');
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9, versionName: '1.2.3' });
    await service.checkForUpdate();
    expect(native.install).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('manual checks bypass daily reminders and server-check throttling', async () => {
    storage.set('app-update-last-prompt', new Date().toDateString());
    storage.set('app-update-last-check', String(Date.now()));
    await service.checkForUpdate(true);
    expect(native.getRelease).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('restores a running download without prompting or starting another', async () => {
    native.getDownload.and.resolveTo({ state: 'downloading', bytes: 20, total: 100 });
    await service.checkForUpdate(true);
    expect(service.download$.value.bytes).toBe(20);
    expect(native.getRelease).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('allows a manual retry after download failure', async () => {
    native.getDownload.and.resolveTo({ state: 'failed', message: 'Offline' });
    confirm.and.resolveTo({ value: true });
    await service.checkForUpdate(true);
    expect(runtime.dialog.alert).toHaveBeenCalled();
    expect(native.startDownload).toHaveBeenCalledTimes(1);
  });

  it('opens permission settings only after settings consent', async () => {
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9, versionName: '1.2.3' });
    native.install.and.resolveTo({ permissionRequired: true });
    confirm.and.resolveTo({ value: false });
    await service.checkForUpdate(true);
    expect(native.install).toHaveBeenCalledTimes(1);
    expect(native.openInstallSettings).not.toHaveBeenCalled();
    confirm.and.resolveTo({ value: true });
    await service.checkForUpdate(true);
    expect(native.openInstallSettings).toHaveBeenCalledTimes(1);
  });

  it('does not prompt or install when backgrounded', async () => {
    let onState: (state: { isActive: boolean }) => void = () => undefined;
    (runtime.app.addListener as jasmine.Spy).and.callFake(((_event: string, callback: typeof onState) => {
      onState = callback;
      return Promise.resolve({ remove: async () => undefined });
    }) as typeof App.addListener);
    (runtime.app.getState as jasmine.Spy).and.resolveTo({ isActive: true });
    await service.initialize();
    onState({ isActive: false });
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9 });
    await service.checkForUpdate(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(native.install).not.toHaveBeenCalled();
  });

  it('throttles repeated checks and keeps automatic network failures quiet', async () => {
    native.getRelease.and.rejectWith(new Error('Offline'));
    spyOn(console, 'warn');
    await service.checkForUpdate();
    await service.checkForUpdate();
    expect(native.getRelease).toHaveBeenCalledTimes(1);
    expect(runtime.dialog.alert).not.toHaveBeenCalled();
    expect(service.checking$.value).toBeFalse();
  });

  it('continues installation after returning from permission settings without another prompt', async () => {
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9, versionName: '1.2.3' });
    native.install.and.resolveTo({ permissionRequired: true });
    confirm.and.resolveTo({ value: true });
    await service.checkForUpdate(true);
    expect(native.openInstallSettings).toHaveBeenCalledTimes(1);
    native.install.and.resolveTo({ permissionRequired: false });
    await service.checkForUpdate();
    expect(native.install).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('reports failure to start a consented download', async () => {
    confirm.and.resolveTo({ value: true });
    native.startDownload.and.rejectWith(new Error('Storage full'));
    spyOn(console, 'warn');
    await service.checkForUpdate();
    expect(runtime.dialog.alert).toHaveBeenCalled();
    expect(service.download$.value.state).toBe('idle');
  });

  it('reports installer failures after consent', async () => {
    native.getDownload.and.resolveTo({ state: 'ready', versionCode: 9, versionName: '1.2.3' });
    native.install.and.rejectWith(new Error('Installer unavailable'));
    confirm.and.resolveTo({ value: true });
    spyOn(console, 'warn');
    await service.checkForUpdate();
    expect(runtime.dialog.alert).toHaveBeenCalled();
    expect(service.download$.value.state).toBe('ready');
  });

  it('reports no available update on a manual check', async () => {
    native.getRelease.and.resolveTo({});
    await service.checkForUpdate(true);
    expect(runtime.dialog.alert).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows verification failures immediately even after today\'s download prompt', async () => {
    storage.set('app-update-last-prompt', new Date().toDateString());
    native.getDownload.and.resolveTo({ state: 'failed', versionCode: 10,
      message: 'Versi APK tidak sepadan dengan versi kemas kini.' });
    await service.checkForUpdate();
    expect(runtime.dialog.alert).toHaveBeenCalledTimes(1);
    expect(service.download$.value.message).toContain('Versi APK');
    expect(native.install).not.toHaveBeenCalled();
    await service.checkForUpdate();
    expect(runtime.dialog.alert).toHaveBeenCalledTimes(1);
  });

  it('publishes native verification progress to the app panel', async () => {
    let onProgress: Parameters<AppUpdaterPlugin['addListener']>[1] = () => undefined;
    native.addListener.and.callFake(async (_event, callback) => {
      onProgress = callback;
      return { remove: async () => undefined };
    });
    (runtime.app.addListener as jasmine.Spy).and.resolveTo({ remove: async () => undefined });
    (runtime.app.getState as jasmine.Spy).and.resolveTo({ isActive: true });
    await service.initialize();
    onProgress({ state: 'verifying', versionCode: 10, bytes: 100, total: 100 });
    expect(service.download$.value.state).toBe('verifying');
    expect(native.install).not.toHaveBeenCalled();
  });
});
