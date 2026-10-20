import { of } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { calculateQiblaBearing, parseZoneBearing, QiblaService } from './qibla.service';
describe('Qibla calculation and sources', () => {
  let service: QiblaService;
  let location: any;
  let http: any;
  let stored: Record<string, string>;
  beforeEach(() => {
    stored = { yearlyPrayerTimes: JSON.stringify({ zone: 'wly01' }) };
    const preferences = {
      get: async ({ key }: { key: string }) => ({ value: stored[key] ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => { stored[key] = value; },
    };
    location = {
      ensureLocationEnabled: jasmine.createSpy().and.resolveTo(true),
      showOpenSettingsDialog: jasmine.createSpy().and.resolveTo(),
      getCurrentLocation: jasmine.createSpy().and.resolveTo({ coords: { latitude: 3.139, longitude: 101.6869, accuracy: 8 } }),
    };
    http = { get: jasmine.createSpy().and.returnValue(of({ status: 'OK!', bearing: '292&#176; 31&#8242; 16&#8243;' })) };
    service = new QiblaService(http, location, preferences as any);
  });
  it('matches known bearings across hemispheres and rejects invalid coordinates', () => {
    expect(calculateQiblaBearing(3.139, 101.6869)).toBeCloseTo(292.54, 1);
    expect(calculateQiblaBearing(40.7128, -74.006)).toBeCloseTo(58.48, 1);
    expect(calculateQiblaBearing(-33.8688, 151.2093)).toBeCloseTo(277.5, 1);
    expect(() => calculateQiblaBearing(NaN, 100)).toThrow();
    expect(() => calculateQiblaBearing(91, 100)).toThrow();
  });
  it('parses HTML encoded bearings and validates minutes', () => {
    expect(parseZoneBearing('292&#176; 31&#8242; 16&#8243;')).toBeCloseTo(292.521111, 5);
    expect(parseZoneBearing('291° 30′ 0″')).toBe(291.5);
    expect(parseZoneBearing('292° 60′ 0″')).toBeNull();
    expect(parseZoneBearing(undefined)).toBeNull();
  });
  it('requests fresh high accuracy GPS without a network request', async () => {
    expect((await service.getTarget('gps')).source).toBe('gps');
    expect(location.getCurrentLocation).toHaveBeenCalledWith({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    expect(http.get).not.toHaveBeenCalled();
  });
  it('honours manual zones and reuses only that zones cached bearing', async () => {
    stored['qiblaLocationMode'] = 'zone';
    expect((await service.getTarget()).zone).toBe('WLY01');
    await service.getTarget();
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(location.getCurrentLocation).not.toHaveBeenCalled();
    stored['yearlyPrayerTimes'] = JSON.stringify({ zone: 'sbh07' });
    await service.getTarget();
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get.calls.mostRecent().args[0]).toContain('zone=SBH07');
  });
  it('labels GPS fallback and fails instead of inventing a bearing', async () => {
    location.getCurrentLocation.and.rejectWith('permission denied');
    expect((await service.getTarget('gps')).fallback).toBeTrue();
    stored = {};
    http.get.and.returnValue(of({ status: 'ERROR', bearing: '' }));
    await expectAsync(service.getTarget('zone')).toBeRejected();
  });
  it('prompts to enable GPS on selection and explains the zone fallback when disabled', async () => {
    location.ensureLocationEnabled.and.resolveTo(false);
    const target = await service.getTarget('gps');
    expect(location.ensureLocationEnabled).toHaveBeenCalledWith(true);
    expect(location.getCurrentLocation).not.toHaveBeenCalled();
    expect(target.source).toBe('zone');
    expect(target.fallback).toBeTrue();
    expect(target.gpsMessage).toContain('Aktifkan lokasi (GPS)');
  });
  it('offers permission settings only on explicit GPS selection', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    location.getCurrentLocation.and.rejectWith('Kebenaran lokasi ditolak');
    expect((await service.getTarget('gps')).gpsMessage).toBeUndefined();
    expect(location.showOpenSettingsDialog).toHaveBeenCalledTimes(1);
    expect((await service.getTarget()).gpsMessage).toBeUndefined();
    expect(location.ensureLocationEnabled).toHaveBeenCalledWith(false);
    expect(location.showOpenSettingsDialog).toHaveBeenCalledTimes(1);
  });
  it('keeps the permission reminder visible on web', async () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    location.getCurrentLocation.and.rejectWith('Kebenaran lokasi ditolak');
    const reminder = 'Benarkan akses lokasi dalam tetapan untuk menggunakan GPS, kemudian kembali ke aplikasi untuk mengemas kini GPS secara automatik.';
    expect((await service.getTarget('gps')).gpsMessage).toBe(reminder);
    expect((await service.getTarget()).gpsMessage).toBe(reminder);
  });
  it('keeps GPS instructions visible even if the fallback zone request fails', async () => {
    location.ensureLocationEnabled.and.resolveTo(false);
    http.get.and.returnValue(of({ status: 'ERROR' }));
    await expectAsync(service.getTarget('gps')).toBeRejectedWithError(/Aktifkan lokasi \(GPS\)/);
  });
  it('uses GPS automatically after location is enabled without another selection', async () => {
    location.ensureLocationEnabled.and.resolveTo(false);
    expect((await service.getTarget('gps')).fallback).toBeTrue();
    expect(stored['qiblaLocationMode']).toBe('gps');
    location.ensureLocationEnabled.and.resolveTo(true);
    const target = await service.getTarget();
    expect(target.source).toBe('gps');
    expect(target.bearing).toBeCloseTo(292.54, 1);
    expect(target.gpsMessage).toBeUndefined();
    expect(location.ensureLocationEnabled.calls.mostRecent().args).toEqual([false]);
  });
});
