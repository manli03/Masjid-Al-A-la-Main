import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HadithSupplicationPage } from './hadith-supplication.page';

describe('HadithSupplicationPage', () => {
  let component: HadithSupplicationPage;
  let fixture: ComponentFixture<HadithSupplicationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HadithSupplicationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
