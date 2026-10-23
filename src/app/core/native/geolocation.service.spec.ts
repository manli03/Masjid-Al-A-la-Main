import { Capacitor } from '@capacitor/core';
import { LocationService } from './geolocation.service';

describe('LocationService GPS enable prompt', () => {
  let service: LocationService;
  let alerts: any;
  beforeEach(() => {
    alerts = { create: jasmine.createSpy().and.resolveTo({
      present: jasmine.createSpy().and.resolveTo(),
      onDidDismiss: jasmine.createSpy().and.resolveTo({ role: 'cancel' }),
    }) };
    service = new LocationService(alerts);
  });
  it('explains disabled location and offers to open location settings', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    spyOn(service, 'isEnabled').and.resolveTo(false);
    const openSettings = spyOn<any>(service, 'openLocationSettings').and.resolveTo();
    expect(await service.ensureLocationEnabled(true)).toBeFalse();
    const options = alerts.create.calls.mostRecent().args[0];
    expect(options.header).toBe('Aktifkan Lokasi (GPS)');
    expect(options.message).toContain('perlu dihidupkan');
    expect(openSettings).not.toHaveBeenCalled();
    options.buttons[1].handler();
    expect(openSettings).toHaveBeenCalled();
  });
  it('does not show an alert during an automatic refresh', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    spyOn(service, 'isEnabled').and.resolveTo(false);
    expect(await service.ensureLocationEnabled()).toBeFalse();
    expect(alerts.create).not.toHaveBeenCalled();
  });
  it('continues without an alert when location is already enabled', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    spyOn(service, 'isEnabled').and.resolveTo(true);
    expect(await service.ensureLocationEnabled(true)).toBeTrue();
    expect(alerts.create).not.toHaveBeenCalled();
  });
  it('leaves browser location permission to geolocation', async () => {
    spyOn(Capacitor, 'getPlatform').and.returnValue('web');
    const nativeCheck = spyOn(service, 'isEnabled');
    expect(await service.ensureLocationEnabled(true)).toBeTrue();
    expect(nativeCheck).not.toHaveBeenCalled();
  });
  it('does not trigger browser permission when in-app consent is declined', async () => {
    spyOn(navigator.permissions, 'query').and.resolveTo({ state: 'prompt' } as PermissionStatus);
    const position = spyOn(navigator.geolocation, 'getCurrentPosition');
    await expectAsync(service.getCurrentLocation()).toBeRejectedWith('Permintaan lokasi dibatalkan');
    expect(position).not.toHaveBeenCalled();
  });
  it('keeps automatic location refresh silent when permission is undecided', async () => {
    spyOn(navigator.permissions, 'query').and.resolveTo({ state: 'prompt' } as PermissionStatus);
    const position = spyOn(navigator.geolocation, 'getCurrentPosition');
    await expectAsync(service.getCurrentLocation(undefined, false)).toBeRejected();
    expect(alerts.create).not.toHaveBeenCalled();
    expect(position).not.toHaveBeenCalled();
  });
  it('does not repeat blocked browser requests', async () => {
    spyOn(navigator.permissions, 'query').and.resolveTo({ state: 'denied' } as PermissionStatus);
    const position = spyOn(navigator.geolocation, 'getCurrentPosition');
    await expectAsync(service.getCurrentLocation()).toBeRejectedWith('Kebenaran lokasi ditolak');
    expect(position).not.toHaveBeenCalled();
    expect(alerts.create).not.toHaveBeenCalled();
  });
  it('starts geolocation only after in-app Allow', async () => {
    spyOn(navigator.permissions, 'query').and.resolveTo({ state: 'prompt' } as PermissionStatus);
    alerts.create.and.resolveTo({ present: async () => undefined, onDidDismiss: async () => ({ role: 'allow' }) });
    const position = { coords: { latitude: 3.1, longitude: 101.6 } } as GeolocationPosition;
    const getPosition = spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(success => success(position));
    expect(await service.getCurrentLocation()).toBe(position);
    expect(getPosition).toHaveBeenCalledTimes(1);
  });
});
