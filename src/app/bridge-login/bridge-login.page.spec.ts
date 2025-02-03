import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BridgeLoginPage } from './bridge-login.page';

describe('BridgeLoginPage', () => {
  let component: BridgeLoginPage;
  let fixture: ComponentFixture<BridgeLoginPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BridgeLoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
