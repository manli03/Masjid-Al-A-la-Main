import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, ModalController } from '@ionic/angular';
import { of } from 'rxjs';

import { PrayerTimesComponent } from './prayer-times.component';
import { PrayerTimesService } from '../../services/prayer-times.service';
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
            formatTimestamp: () => '',
            formatDate: (date: Date) => date.toISOString().slice(0, 10),
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
});
