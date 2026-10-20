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
});
