import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { qiblaCompassPage } from './qiblaCompass.page';

describe('qiblaCompassPage', () => {
  let component: qiblaCompassPage;
  let fixture: ComponentFixture<qiblaCompassPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [qiblaCompassPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(qiblaCompassPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
