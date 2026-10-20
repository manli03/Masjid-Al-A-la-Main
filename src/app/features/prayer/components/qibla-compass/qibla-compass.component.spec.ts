import { NgZone } from '@angular/core';
import { QiblaCompassComponent } from './qibla-compass.component';
describe('QiblaCompassComponent heading', () => {
  let component: QiblaCompassComponent;
  beforeEach(() => {
    component = new QiblaCompassComponent({} as any, {} as any, {} as any, new NgZone({}));
    component.uiState = 'calibrated';
  });
  function reading(heading: number) {
    const angle = -heading * Math.PI / 360;
    (component as any).sensor = { quaternion: [0, 0, Math.sin(angle), Math.cos(angle)] };
    component.handleCompassReading();
  }
  it('tracks east/west and the calculated target', () => {
    component.qiblaHeading = 292.5;
    reading(90);
    expect(component.compassHeading).toBeCloseTo(90);
    expect(component.isQiblaAligned).toBeFalse();
    reading(292.5);
    expect(component.isQiblaAligned).toBeTrue();
  });
  it('rotates smoothly across north', () => {
    component.qiblaHeading = 0;
    reading(359); reading(1);
    expect(component.accumulatedRotation).toBeCloseTo(361);
    expect(component.isQiblaAligned).toBeTrue();
  });
  it('guides the shortest turn and confirms alignment', () => {
    component.qiblaHeading = 291.5;
    reading(315);
    expect(component.directionLabel).toBe('Pusing ke kiri');
    expect(component.turnDegrees).toBeCloseTo(23.5);
    component.qiblaHeading = 1;
    reading(359);
    expect(component.directionLabel).toBe('Pusing ke kanan');
    expect(component.turnDegrees).toBeCloseTo(2);
    reading(1);
    expect(component.directionLabel).toBe('Selari dengan kiblat');
  });
  it('cannot align without location', () => {
    reading(0);
    expect(component.isQiblaAligned).toBeFalse();
  });
  it('automatically updates the bearing on return and keeps the compass open', async () => {
    const getTarget = jasmine.createSpy().and.resolveTo({ source: 'gps', bearing: 293.2 });
    component = new QiblaCompassComponent({} as any, {} as any, { getTarget } as any, new NgZone({}));
    component.uiState = 'calibrated';
    component.target = { source: 'zone', bearing: 291.5, fallback: true, gpsMessage: 'Aktifkan GPS' };
    component.locationError = 'Lokasi tidak tersedia';
    const start = spyOn(component, 'startCompassDisplay');
    component.handleAppResume();
    await Promise.resolve();
    expect(getTarget).toHaveBeenCalledWith(undefined);
    expect(component.target?.source).toBe('gps');
    expect(component.qiblaHeading).toBe(293.2);
    expect(component.target?.gpsMessage).toBeUndefined();
    expect(component.locationError).toBeNull();
    expect(component.uiState).toBe('calibrated');
    expect(start).toHaveBeenCalled();
  });
  it('ignores an older settings request that finishes after GPS has refreshed', async () => {
    let finishOld!: (target: any) => void;
    const oldResult = new Promise<any>((resolve) => { finishOld = resolve; });
    const getTarget = jasmine.createSpy().and.returnValues(oldResult, Promise.resolve({ source: 'gps', bearing: 294 }));
    component = new QiblaCompassComponent({} as any, {} as any, { getTarget } as any, new NgZone({}));
    const oldRequest = component.loadCompassResources('gps');
    component.handleAppResume();
    await Promise.resolve();
    finishOld({ source: 'zone', bearing: 291, fallback: true, gpsMessage: 'Aktifkan GPS' });
    await oldRequest;
    expect(component.target?.source).toBe('gps');
    expect(component.qiblaHeading).toBe(294);
    expect(component.locationLoading).toBeFalse();
  });
  it('keeps the heading when the screen is tilted and rejects a vertical top edge', () => {
    const halfRoll = Math.PI / 6;
    const halfYaw = -Math.PI / 4;
    (component as any).sensor = { quaternion: [
      Math.sin(halfRoll) * Math.cos(halfYaw),
      Math.sin(halfRoll) * Math.sin(halfYaw),
      Math.cos(halfRoll) * Math.sin(halfYaw),
      Math.cos(halfRoll) * Math.cos(halfYaw),
    ] };
    component.qiblaHeading = 90;
    component.handleCompassReading();
    expect(component.compassHeading).toBeCloseTo(90);
    expect(component.isQiblaAligned).toBeTrue();
    (component as any).sensor.quaternion = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    component.handleCompassReading();
    expect(component.isQiblaAligned).toBeFalse();
  });
});

describe('QiblaCompassComponent sensor messages', () => {
  let component: QiblaCompassComponent;
  let originalSensor: any;
  let handlers: Record<string, (event: any) => void>;
  beforeEach(() => {
    component = new QiblaCompassComponent({} as any, {} as any, {} as any, new NgZone({}));
    originalSensor = window.AbsoluteOrientationSensor;
    handlers = {};
    window.AbsoluteOrientationSensor = class {
      addEventListener(name: string, callback: (event: any) => void) { handlers[name] = callback; }
      removeEventListener() {}
      start() {}
      stop() {}
    };
    spyOn(console, 'error');
  });
  afterEach(() => {
    component.ngOnDestroy();
    if (originalSensor === undefined) delete window.AbsoluteOrientationSensor;
    else window.AbsoluteOrientationSensor = originalSensor;
  });
  it('replaces a system permission-query rejection with the app message', async () => {
    spyOn(navigator.permissions, 'query').and.rejectWith(new Error('Raw browser permission failure'));
    await component.checkSupportAndStartDetection();
    expect(component.uiState).toBe('error');
    expect(component.errorMessageCompass).toContain('Tiada kebenaran sensor.');
    expect(component.errorMessageCompass).not.toContain('Raw browser');
  });
  it('uses the same friendly message for calibration and display sensor failures', () => {
    component.initializeSensorForCalibration();
    handlers['error']({ error: { name: 'NotAllowedError', message: 'Raw OS denial' } });
    const calibrationMessage = component.errorMessageCompass;
    component.startCompassDisplay();
    handlers['error']({ error: { name: 'NotAllowedError', message: 'Raw OS denial' } });
    expect(component.errorMessageCompass).toBe(calibrationMessage);
    expect(component.errorMessageCompass).toContain('Tiada kebenaran sensor.');
    expect(component.errorMessageCompass).not.toContain('NotAllowedError');
    expect(component.errorMessageCompass).not.toContain('Raw OS');
  });
  it('does not expose constructor exception text', () => {
    window.AbsoluteOrientationSensor = class {
      constructor() { throw new DOMException('Raw OS security failure', 'SecurityError'); }
    };
    component.startCompassDisplay();
    expect(component.uiState).toBe('error');
    expect(component.errorMessageCompass).toContain('Tiada kebenaran sensor.');
    expect(component.errorMessageCompass).not.toContain('Raw OS');
  });
});
