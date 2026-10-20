import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageAnnouncementPage } from './manage-announcement.page';

describe('ManageAnnouncementPage', () => {
  let component: ManageAnnouncementPage;
  let fixture: ComponentFixture<ManageAnnouncementPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageAnnouncementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
