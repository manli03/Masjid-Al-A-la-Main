import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';


import { announcementPage } from './announcement.page';

describe('announcementPage', () => {
  let component: announcementPage;
  let fixture: ComponentFixture<announcementPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [announcementPage],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(announcementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
