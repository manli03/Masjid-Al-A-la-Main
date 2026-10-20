import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StorageService } from '../../core/storage/storage.service';
import { DailyWisdomService, malaysiaDay, selectWisdom, validateWisdom, WisdomCatalogue, WISDOM_CACHE_KEY, WISDOM_URL } from './daily-wisdom.service';

const testCatalogue: WisdomCatalogue = {
  version: 2, timezone: 'Asia/Kuala_Lumpur', resetOn: '01-01',
  source: { name: 'Test source', url: 'https://example.com/quotes', note: 'Test data' },
  quotes: Array.from({ length: 130 }, (_, i) => ({
    id: `hikmah-${String(i + 1).padStart(3, '0')}`, text: `Mutiara ujian ${i + 1}`,
  })),
};

describe('Daily wisdom schedule', () => {
  it('changes at midnight Malaysia time, regardless of the device timezone', () => {
    const before = malaysiaDay(new Date('2026-01-01T15:59:59.999Z'));
    const after = malaysiaDay(new Date('2026-01-01T16:00:00.000Z'));
    expect(after).toBe(before + 1);
    expect(selectWisdom(testCatalogue, before).id).toBe('hikmah-001');
    expect(selectWisdom(testCatalogue, after).id).toBe('hikmah-002');
    expect(malaysiaDay(new Date('2026-01-02T00:00:00+08:00'))).toBe(after);
    expect(malaysiaDay(new Date('2026-01-01T09:00:00-07:00'))).toBe(after);
  });

  it('shows every quote once before repeating within the year', () => {
    const start = malaysiaDay(new Date('2026-01-01T00:00:00+08:00'));
    const cycle = testCatalogue.quotes.map((_, index) => selectWisdom(testCatalogue, start + index).id);
    expect(new Set(cycle).size).toBe(testCatalogue.quotes.length);
    expect(selectWisdom(testCatalogue, start + testCatalogue.quotes.length).id).toBe(cycle[0]);
  });

  it('restarts at quote 1 every January even when the prior cycle is unfinished', () => {
    for (const year of [2026, 2027, 2028, 2029]) {
      const jan1 = malaysiaDay(new Date(`${year}-01-01T00:00:00+08:00`));
      const before = selectWisdom(testCatalogue, jan1 - 1);
      expect(selectWisdom(testCatalogue, jan1).id).toBe('hikmah-001');
      expect(selectWisdom(testCatalogue, jan1 + 1).id).toBe('hikmah-002');
      expect(before.id).not.toBe('hikmah-130');
    }
  });

  it('counts leap day as a day in the rotation', () => {
    const quoteOn = (date: string) => selectWisdom(testCatalogue, malaysiaDay(new Date(`${date}T12:00:00+08:00`))).id;
    expect(quoteOn('2028-02-28')).toBe('hikmah-059');
    expect(quoteOn('2028-02-29')).toBe('hikmah-060');
    expect(quoteOn('2028-03-01')).toBe('hikmah-061');
    expect(quoteOn('2027-03-01')).toBe('hikmah-060');
    expect(quoteOn('2028-12-31')).toBe('hikmah-106');
    expect(quoteOn('2029-01-01')).toBe('hikmah-001');
  });

  it('rejects duplicate text, empty lists and obsolete schedules in a hosted feed', () => {
    const duplicate = { ...testCatalogue, quotes: testCatalogue.quotes.map((quote, i) => i === 1
      ? { ...quote, text: `  ${testCatalogue.quotes[0].text.toUpperCase()}  ` } : quote) };
    expect(() => validateWisdom(duplicate)).toThrow();
    expect(() => validateWisdom({ ...testCatalogue, quotes: [] })).toThrow();
    expect(() => validateWisdom({ ...testCatalogue, quotes: [testCatalogue.quotes[0]] })).toThrow();
    expect(() => validateWisdom({ ...testCatalogue, resetOn: '10-20' })).toThrow();
    expect(() => validateWisdom({ ...testCatalogue, version: 0 })).toThrow();
    expect(() => validateWisdom({ ...testCatalogue, version: 1.5 })).toThrow();
    expect(validateWisdom(testCatalogue)).toBe(testCatalogue);
  });
});

describe('DailyWisdomService server refresh', () => {
  let service: DailyWisdomService;
  let http: HttpTestingController;
  let storage: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    spyOn(console, 'warn');
    storage = jasmine.createSpyObj<StorageService>('storage', ['get', 'set']);
    storage.get.and.resolveTo(testCatalogue);
    storage.set.and.resolveTo();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: StorageService, useValue: storage },
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function start() {
    service = TestBed.inject(DailyWisdomService);
    let current: { quote: { id: string; text: string } } | null = null;
    const subscription = service.dailyQuote$.subscribe(value => current = value);
    return { get current() { return current; }, subscription };
  }

  function request() {
    const req = http.expectOne(value => value.url === WISDOM_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('_ts')).toBeTrue();
    return req;
  }

  it('shows saved quotes immediately while checking for newer server content', fakeAsync(() => {
    const view = start();
    void service.refresh();
    tick(0);
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    const updated = { ...testCatalogue, quotes: testCatalogue.quotes.map(q => ({ ...q, text: `${q.text} dikemas kini` })) };
    request().flush(updated);
    tick();
    expect(view.current?.quote).toEqual(selectWisdom(updated, malaysiaDay(new Date())));
    expect(storage.set).toHaveBeenCalledOnceWith(WISDOM_CACHE_KEY, updated);
    view.subscription.unsubscribe();
  }));

  it('checks the server again on each entry and does not rewrite unchanged cache', fakeAsync(() => {
    const view = start();
    void service.refresh();
    tick(0);
    request().flush(testCatalogue);
    tick();
    expect(storage.set).not.toHaveBeenCalled();
    void service.refresh();
    tick();
    request().flush(testCatalogue);
    tick();
    expect(storage.set).not.toHaveBeenCalled();
    view.subscription.unsubscribe();
  }));

  it('shares concurrent refreshes without duplicate requests', fakeAsync(() => {
    const view = start();
    const first = service.refresh();
    expect(service.refresh()).toBe(first);
    tick(0);
    request().flush(testCatalogue);
    tick();
    view.subscription.unsubscribe();
  }));

  it('accepts changed revisions and list lengths like the live version 1 feed with 129 quotes', fakeAsync(() => {
    const view = start();
    const updated = { ...testCatalogue, version: 1, quotes: testCatalogue.quotes.filter((_, i) => i !== 10) };
    void service.refresh();
    tick(0);
    request().flush(updated);
    tick();
    expect(updated.quotes.length).toBe(129);
    expect(view.current?.quote).toEqual(selectWisdom(updated, malaysiaDay(new Date())));
    expect(storage.set).toHaveBeenCalledOnceWith(WISDOM_CACHE_KEY, updated);
    view.subscription.unsubscribe();
  }));

  it('downloads and saves the first catalogue with no local JSON or cache', fakeAsync(() => {
    storage.get.and.resolveTo(null);
    const view = start();
    void service.refresh();
    tick(0);
    expect(view.current).toBeNull();
    request().flush(testCatalogue);
    tick();
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    expect(storage.set).toHaveBeenCalledOnceWith(WISDOM_CACHE_KEY, testCatalogue);
    view.subscription.unsubscribe();
  }));

  it('retains saved content after an HTTP error or invalid server update', fakeAsync(() => {
    const view = start();
    void service.refresh();
    tick(0);
    request().flush('Offline', { status: 503, statusText: 'Unavailable' });
    tick();
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    void service.refresh();
    tick();
    request().flush({ quotes: [] });
    tick();
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    expect(storage.set).not.toHaveBeenCalled();
    view.subscription.unsubscribe();
  }));

  it('keeps the valid cache when a server request times out', fakeAsync(() => {
    const view = start();
    void service.refresh();
    tick(0);
    const req = request();
    tick(5000);
    expect(req.cancelled).toBeTrue();
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    expect(storage.set).not.toHaveBeenCalled();
    view.subscription.unsubscribe();
  }));

  it('ignores corrupt cache and recovers on a later homepage entry', fakeAsync(() => {
    storage.get.and.resolveTo({ ...testCatalogue, version: 0 });
    const view = start();
    void service.refresh();
    tick(0);
    request().flush('Offline', { status: 503, statusText: 'Unavailable' });
    tick();
    expect(view.current).toBeNull();
    void service.refresh();
    tick();
    request().flush(testCatalogue);
    tick();
    expect(view.current?.quote).toEqual(selectWisdom(testCatalogue, malaysiaDay(new Date())));
    view.subscription.unsubscribe();
  }));

  it('resets an open homepage at midnight on January 1 without refetching', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-12-31T15:59:59Z'));
    const view = start();
    return Promise.resolve().then(() => {
      jasmine.clock().tick(0);
      expect(view.current?.quote.id).toBe('hikmah-105');
      jasmine.clock().tick(1000);
      expect(view.current?.quote.id).toBe('hikmah-001');
    }).finally(() => {
      view.subscription.unsubscribe();
      jasmine.clock().uninstall();
    });
  });
});
