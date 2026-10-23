import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, ModalController } from '@ionic/angular';
import { of } from 'rxjs';

import { PrayerTimesComponent } from './prayer-times.component';
import { Prayer, PrayerTimesService } from '../../services/prayer-times.service';
import { PrayerNotificationsService } from '../../services/prayer-notifications.service';

describe('PrayerTimesComponent', () => {
  let component: PrayerTimesComponent;
  let fixture: ComponentFixture<PrayerTimesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PrayerTimesComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        {
          provide: PrayerTimesService,
          useValue: {
            zoneNames: { kdh01: 'KDH01' },
            getSavedYearlyPrayerTimes: async () => ({
              prayers: [],
              zone: 'kdh01',
              timestamp: new Date().toISOString(),
            }),
            getTodayPrayerTimes: () => null,
            getDefaultPrayerTimes: async () => undefined,
            formatTimestamp: () => '',
            formatDate: (date: Date) => date.toDateString(),
            formatApiDateForDisplay: (date: string) => date,
            presentToast: async () => undefined,
          },
        },
        {
          provide: PrayerNotificationsService,
          useValue: {
            initializeNotifications: async () => false,
            isProcessing$: of(false),
            disabledPrayers$: of(new Set<string>()),
          },
        },
        { provide: ModalController, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrayerTimesComponent);
    component = fixture.componentInstance;
    spyOn(component, 'startUpdatingRemainingTime').and.stub();
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the default schedule when a cold app link opens before cached data exists', async () => {
    await fixture.whenStable();
    const service = TestBed.inject(PrayerTimesService);
    const saved = { zone: 'kdh01', prayers: [{ date: '23-Oct-2026' }], timestamp: new Date().toISOString() };
    spyOn(service, 'getSavedYearlyPrayerTimes').and.returnValues(Promise.resolve(null), Promise.resolve(saved));
    const load = spyOn(service, 'getDefaultPrayerTimes').and.resolveTo();
    await component.initializePrayerTimes();
    expect(load).toHaveBeenCalledTimes(1);
    expect(component.yearlyPrayers).toEqual(saved.prayers);
  });

  describe('sharing prayer times on web', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
    let canShareDescriptor: PropertyDescriptor | undefined;
    let shareDescriptor: PropertyDescriptor | undefined;
    let share: jasmine.Spy;
    let download: jasmine.Spy;

    beforeEach(() => {
      canShareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'canShare');
      shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
      share = jasmine.createSpy('share').and.resolveTo();
      Object.defineProperties(navigator, {
        canShare: { configurable: true, value: () => true },
        share: { configurable: true, value: share },
      });
      download = spyOn(HTMLAnchorElement.prototype, 'click');
    });

    afterEach(() => {
      for (const [key, descriptor] of [
        ['canShare', canShareDescriptor], ['share', shareDescriptor],
      ] as const) {
        if (descriptor) Object.defineProperty(navigator, key, descriptor);
        else delete (navigator as any)[key];
      }
    });

    it('shares the PNG file through the browser share dialog', async () => {
      await component['sharePrayerTimesOnWeb'](dataUrl, 'prayers.png', 'Waktu Solat');

      const payload = share.calls.mostRecent().args[0] as ShareData;
      expect(payload.title).toBe('Waktu Solat');
      expect(payload.files?.[0].name).toBe('prayers.png');
      expect(payload.files?.[0].type).toBe('image/png');
      expect(payload.files?.[0].size).toBeGreaterThan(0);
      expect(download).not.toHaveBeenCalled();
    });

    it('downloads the PNG when file sharing is unsupported or unavailable', async () => {
      for (const canShare of [() => false, undefined]) {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
        await component['sharePrayerTimesOnWeb'](dataUrl, 'prayers.png', 'Waktu Solat');
      }

      expect(share).not.toHaveBeenCalled();
      expect(download).toHaveBeenCalledTimes(2);
      const link = download.calls.mostRecent().object as HTMLAnchorElement;
      expect(link.href).toBe(dataUrl);
      expect(link.download).toBe('prayers.png');
      expect(link.isConnected).toBeFalse();
    });

    it('downloads the PNG if browser share permission expires', async () => {
      share.and.rejectWith(new DOMException('Permission denied', 'NotAllowedError'));

      await component['sharePrayerTimesOnWeb'](dataUrl, 'prayers.png', 'Waktu Solat');

      expect(download).toHaveBeenCalledTimes(1);
    });

    it('does not download when the user cancels the share dialog', async () => {
      share.and.rejectWith(new DOMException('Share cancelled', 'AbortError'));

      await component['sharePrayerTimesOnWeb'](dataUrl, 'prayers.png', 'Waktu Solat');

      expect(download).not.toHaveBeenCalled();
    });
  });

  describe('current prayer at the end of the day', () => {
    const schedule = (date: string): Prayer[] => [
      { name: 'Imsak', time: '05:50:00', date },
      { name: 'Subuh', time: '06:00:00', date },
      { name: 'Syuruk', time: '07:10:00', date },
      { name: 'Dhuha', time: '07:40:00', date },
      { name: 'Zuhur', time: '13:00:00', date },
      { name: 'Asar', time: '16:30:00', date },
      { name: 'Maghrib', time: '19:00:00', date },
      { name: 'Isyak', time: '20:15:00', date },
    ];

    beforeEach(async () => {
      await fixture.whenStable();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 9, 20, 21));
      component.currentDate = new Date(2026, 9, 20);
      component.prayers = schedule('20-Oct-2026');
      spyOn(TestBed.inject(PrayerTimesService), 'getTodayPrayerTimes')
        .and.callFake((_yearlyPrayers, date) => ({
          prayers: schedule(`${date.getDate()}-Oct-2026`),
          hijriDate: '',
          currentDate: date,
        }));
    });

    afterEach(() => jasmine.clock().uninstall());

    it('keeps Isyak highlighted while counting down to tomorrow', () => {
      component.calculateRemainingTime();
      component.calculateRemainingTime();
      fixture.detectChanges();

      expect(component.currentDate.getDate()).toBe(20);
      expect(component.prayers[0].date).toBe('20-Oct-2026');
      expect(component.currentPrayer).toBe('Isyak');
      expect(component.closestPrayer).toBe('Imsak');
      expect(component.remainingTime).toContain('8 jam 51 minit');
      const highlightedRows = fixture.nativeElement.querySelectorAll('.current-prayer-row');
      expect(highlightedRows.length).toBe(1);
      expect(highlightedRows[0].textContent).toContain('Isyak');
    });

    it('switches the highlight from Maghrib to Isyak at its start time', () => {
      jasmine.clock().mockDate(new Date(2026, 9, 20, 20, 14, 59));
      component.calculateRemainingTime();
      expect(component.currentPrayer).toBe('Maghrib');

      jasmine.clock().mockDate(new Date(2026, 9, 20, 20, 15));
      component.calculateRemainingTime();
      expect(component.currentPrayer).toBe('Isyak');
      expect(component.currentDate.getDate()).toBe(20);
    });

    it('keeps Isyak highlighted when tomorrow has no schedule', () => {
      const service = TestBed.inject(PrayerTimesService);
      (service.getTodayPrayerTimes as jasmine.Spy).and.returnValue(null);

      component.calculateRemainingTime();

      expect(component.currentPrayer).toBe('Isyak');
      expect(component.currentDate.getDate()).toBe(20);
      expect(component.loaded).toBeTrue();
      expect(component.closestPrayer).toBeNull();
    });

    it('loads the new daily schedule when midnight passes', () => {
      jasmine.clock().mockDate(new Date(2026, 9, 21, 0, 0));

      component.calculateRemainingTime();

      expect(component.currentDate.getDate()).toBe(21);
      expect(component.prayers[0].date).toBe('21-Oct-2026');
      expect(component.closestPrayer).toBe('Imsak');
      expect(component.currentPrayer).toBe('Isyak');
    });

    it('highlights Isyak after midnight until Imsak begins', () => {
      component.currentDate = new Date(2026, 9, 21);
      component.prayers = schedule('21-Oct-2026');

      for (const [hours, minutes, seconds] of [[0, 1, 0], [5, 49, 59]]) {
        jasmine.clock().mockDate(new Date(2026, 9, 21, hours, minutes, seconds));
        component.calculateRemainingTime();
        fixture.detectChanges();

        expect(component.currentPrayer).toBe('Isyak');
        const highlightedRows = fixture.nativeElement.querySelectorAll('.current-prayer-row');
        expect(highlightedRows.length).toBe(1);
        expect(highlightedRows[0].textContent).toContain('Isyak');
      }
    });

    it('switches from Imsak to Subuh exactly when Subuh starts', () => {
      component.currentDate = new Date(2026, 9, 21);
      component.prayers = schedule('21-Oct-2026');
      jasmine.clock().mockDate(new Date(2026, 9, 21, 5, 59, 59));
      component.calculateRemainingTime();
      expect(component.currentPrayer).toBe('Imsak');

      jasmine.clock().mockDate(new Date(2026, 9, 21, 6, 0));
      component.calculateRemainingTime();
      fixture.detectChanges();

      expect(component.currentPrayer).toBe('Subuh');
      const highlightedRows = fixture.nativeElement.querySelectorAll('.current-prayer-row');
      expect(highlightedRows.length).toBe(1);
      expect(highlightedRows[0].textContent).toContain('Subuh');
    });

    it('highlights each additional time exactly at its start and until the next time', () => {
      for (const [hour, minute, expected] of [
        [5, 50, 'Imsak'], [5, 59, 'Imsak'], [7, 10, 'Syuruk'],
        [7, 39, 'Syuruk'], [7, 40, 'Dhuha'], [12, 59, 'Dhuha'],
      ] as const) {
        jasmine.clock().mockDate(new Date(2026, 9, 20, hour, minute));
        component.calculateRemainingTime();
        fixture.detectChanges();
        expect(component.currentPrayer).toBe(expected);
        const rows = fixture.nativeElement.querySelectorAll('.current-prayer-row');
        expect(rows.length).toBe(1);
        expect(rows[0].textContent).toContain(expected);
      }
    });

    it('does not highlight Isyak when viewing a future schedule', () => {
      component.currentDate = new Date(2026, 9, 21);
      component.prayers = schedule('21-Oct-2026');

      component.calculateRemainingTime();

      expect(component.currentDate.getDate()).toBe(21);
      expect(component.currentPrayer).toBeNull();
    });
  });
});
