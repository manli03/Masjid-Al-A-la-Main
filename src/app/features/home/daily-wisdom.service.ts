import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, combineLatest, distinctUntilChanged, firstValueFrom, map, shareReplay, timeout, timer } from 'rxjs';
import { StorageService } from '../../core/storage/storage.service';

export const WISDOM_URL = 'https://oc-manli.duckdns.org/amalan/hikmah-harian.json';
export const WISDOM_CACHE_KEY = 'daily_wisdom_catalogue';
const DAY_MS = 86_400_000;
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface WisdomQuote {
  id: string;
  text: string;
}

export interface WisdomCatalogue {
  version: number;
  timezone: string;
  resetOn: string;
  source: { name: string; url: string; note: string };
  quotes: WisdomQuote[];
}

/** A shared calendar day, independent of the device's timezone. */
export function malaysiaDay(now: Date): number {
  return Math.floor((now.getTime() + MALAYSIA_OFFSET_MS) / DAY_MS);
}

export function selectWisdom(catalogue: WisdomCatalogue, day: number): WisdomQuote {
  // `day` represents the Malaysia calendar date as a UTC day number.
  // Derive its year here so even a first visit midyear uses the shared schedule.
  const year = new Date(day * DAY_MS).getUTCFullYear();
  const startDay = Date.UTC(year, 0, 1) / DAY_MS;
  const index = (day - startDay) % catalogue.quotes.length;
  return catalogue.quotes[index];
}

/** Reject malformed feeds and duplicate entries, so a cycle cannot repeat a quote. */
export function validateWisdom(value: unknown): WisdomCatalogue {
  const data = value as WisdomCatalogue;
  // The publisher's version tracks content revisions; scheduling fields define
  // the supported format. Allow the quote count to change with server edits.
  if (!data || !Number.isInteger(data.version) || data.version < 1 || data.timezone !== 'Asia/Kuala_Lumpur' ||
      data.resetOn !== '01-01' ||
      typeof data.source?.name !== 'string' || !data.source.name.trim() ||
      typeof data.source?.url !== 'string' || !data.source.url.startsWith('https://') ||
      typeof data.source?.note !== 'string' ||
      !Array.isArray(data.quotes) || data.quotes.length < 2) {
    throw new Error('Invalid daily wisdom catalogue');
  }
  const ids = new Set<string>();
  const texts = new Set<string>();
  for (const quote of data.quotes) {
    if (!quote || typeof quote.id !== 'string' || !quote.id.trim() ||
        typeof quote.text !== 'string' || !quote.text.trim()) {
      throw new Error('Invalid wisdom quote');
    }
    const text = quote.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ms-MY');
    if (ids.has(quote.id) || texts.has(text)) throw new Error('Duplicate wisdom quote');
    ids.add(quote.id);
    texts.add(text);
  }
  return data;
}

@Injectable({ providedIn: 'root' })
export class DailyWisdomService {
  private readonly catalogue$ = new BehaviorSubject<WisdomCatalogue | null>(null);
  private readonly cacheLoaded: Promise<void>;
  private refreshInFlight?: Promise<void>;

  readonly dailyQuote$ = combineLatest([
    this.catalogue$,
    timer(0, 1000).pipe(map(() => malaysiaDay(new Date())), distinctUntilChanged()),
  ]).pipe(
    map(([catalogue, day]) => catalogue
      ? { quote: selectWisdom(catalogue, day), source: catalogue.source }
      : null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(private http: HttpClient, private storage: StorageService) {
    this.cacheLoaded = this.restoreCache();
  }

  /** Called on every homepage entry, including Ionic's cached tab re-entry. */
  refresh(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.fetchLatest().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  private async restoreCache(): Promise<void> {
    try {
      const cached = validateWisdom(await this.storage.get(WISDOM_CACHE_KEY));
      this.catalogue$.next(cached);
    } catch {
      // No valid download yet: leave the card hidden until the server responds.
    }
  }

  private async fetchLatest(): Promise<void> {
    await this.cacheLoaded;
    try {
      // A unique query prevents a browser/CDN cache from masking server edits.
      // No custom headers are needed, so this remains a simple CORS GET.
      const latest = validateWisdom(await firstValueFrom(this.http.get<unknown>(WISDOM_URL, {
        params: { _ts: String(Date.now()) },
      }).pipe(timeout(5000))));
      if (JSON.stringify(latest) !== JSON.stringify(this.catalogue$.value)) {
        this.catalogue$.next(latest);
        await this.storage.set(WISDOM_CACHE_KEY, latest);
      }
    } catch (error) {
      // Keep the last validated download on network, validation or storage errors.
      // The next homepage entry or pull-to-refresh checks the server again.
      console.warn('Daily wisdom update failed; keeping the saved catalogue.', error);
    }
  }
}
