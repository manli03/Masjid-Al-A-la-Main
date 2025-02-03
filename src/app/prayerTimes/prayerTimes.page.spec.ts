import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { prayerTimesPage } from './prayerTimes.page';

describe('prayerTimesPage', () => {
  let component: prayerTimesPage;
  let fixture: ComponentFixture<prayerTimesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [prayerTimesPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(prayerTimesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
