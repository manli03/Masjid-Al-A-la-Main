import { Capacitor } from '@capacitor/core';
import { PrayerNotificationsService } from './prayer-notifications.service';

describe('Notification permission consent', () => {
  let service: PrayerNotificationsService;
  let alerts: any;
  let request: jasmine.Spy;
  let permission: jasmine.Spy;
  let dismiss: jasmine.Spy;
  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    permission = jasmine.createSpy().and.resolveTo({ display: 'prompt' });
    request = jasmine.createSpy().and.resolveTo({ display: 'granted' });
    dismiss = jasmine.createSpy().and.resolveTo({ role: 'cancel' });
    alerts = { create: jasmine.createSpy().and.resolveTo({ present: async () => undefined, onDidDismiss: dismiss }) };
    service = new PrayerNotificationsService({} as any, {} as any, alerts, {
      checkPermissions: permission, requestPermissions: request,
      addListener: jasmine.createSpy().and.resolveTo({ remove: async () => undefined }),
    } as any);
    spyOn<any>(service, 'createPostNotificationChannel').and.resolveTo();
  });

  it('does not ask Android if the in-app explanation is declined', async () => {
    expect(await service.initializeNotifications()).toBeFalse();
    expect(request).not.toHaveBeenCalled();
  });
  it('requests Android permission only after in-app Allow', async () => {
    dismiss.and.resolveTo({ role: 'allow' });
    expect(await service.initializeNotifications()).toBeTrue();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('does not repeat a blocked system prompt and offers settings on user action', async () => {
    permission.and.resolveTo({ display: 'denied' });
    expect(await service.initializeNotifications()).toBeFalse();
    expect(request).not.toHaveBeenCalled();
    expect(alerts.create.calls.mostRecent().args[0].header).toBe('Kebenaran Notifikasi Diperlukan');
  });
  it('accepts only granted permission and does not stack settings on a fresh refusal', async () => {
    dismiss.and.resolveTo({ role: 'allow' });
    request.and.resolveTo({ display: 'denied' });
    expect(await service.initializeNotifications()).toBeFalse();
    expect(alerts.create).toHaveBeenCalledTimes(1);
  });
  it('uses an existing grant without prompting', async () => {
    permission.and.resolveTo({ display: 'granted' });
    expect(await service.initializeNotifications()).toBeTrue();
    expect(request).not.toHaveBeenCalled();
    expect(alerts.create).not.toHaveBeenCalled();
  });
  it('checks existing permission silently on startup', async () => {
    await service.checkPermissionAndSchedule();
    expect(request).not.toHaveBeenCalled();
    expect(alerts.create).not.toHaveBeenCalled();
  });
  it('rebuilds reminders after returning from notification or exact-alarm settings', async () => {
    permission.and.resolveTo({ display: 'granted' });
    const reschedule = spyOn(service, 'forceRescheduleNotifications').and.resolveTo();
    await service.checkPermissionAndSchedule(true);
    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });
});
