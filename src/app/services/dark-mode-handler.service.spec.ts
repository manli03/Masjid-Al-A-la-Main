import { TestBed } from '@angular/core/testing';

import { DarkModeHandlerService } from './dark-mode-handler.service';

describe('DarkModeHandlerService', () => {
  let service: DarkModeHandlerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DarkModeHandlerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
