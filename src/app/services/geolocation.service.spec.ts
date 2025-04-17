import { TestBed } from '@angular/core/testing';

import { LocationService } from './geolocation.service';

describe('GeolocationService', () => {
  let service: LocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
