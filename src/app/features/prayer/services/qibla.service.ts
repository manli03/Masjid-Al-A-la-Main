import { Inject, Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom, timeout } from 'rxjs';
import { LocationService } from '../../../core/native/geolocation.service';

export const QIBLA_PREFERENCES = new InjectionToken<typeof Preferences>(
  'Qibla preferences', { providedIn: 'root', factory: () => Preferences },
);

export interface QiblaTarget {
  bearing: number;
  source: 'gps' | 'zone';
  zone?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  fallback?: boolean;
  gpsMessage?: string;
}

/** Initial great-circle bearing to the Kaaba, clockwise from north. */
export function calculateQiblaBearing(latitude: number, longitude: number): number {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Koordinat lokasi tidak sah.');
  }
  const radians = Math.PI / 180;
  const lat = latitude * radians;
  const kaabaLat = 21.422487 * radians;
  const deltaLon = (39.826206 - longitude) * radians;
  const east = Math.sin(deltaLon) * Math.cos(kaabaLat);
  const north = Math.cos(lat) * Math.sin(kaabaLat) -
    Math.sin(lat) * Math.cos(kaabaLat) * Math.cos(deltaLon);
  if (Math.hypot(east, north) < 1e-12) {
    throw new Error('Arah kiblat tidak dapat ditentukan pada koordinat ini.');
  }
  return (Math.atan2(east, north) / radians + 360) % 360;
}

/** e-Solat encodes degrees, minutes and seconds as HTML entities. */
export function parseZoneBearing(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parts = value.replace(/&#(?:x[0-9a-f]+|\d+);/gi, ' ').match(/\d+(?:\.\d+)?/g);
  if (!parts || parts.length !== 3) return null;
  const [degrees, minutes, seconds] = parts.map(Number);
  if (degrees >= 360 || minutes >= 60 || seconds >= 60) return null;
  return degrees + minutes / 60 + seconds / 3600;
}

@Injectable({ providedIn: 'root' })
export class QiblaService {
  constructor(
    private http: HttpClient,
    private location: LocationService,
    @Inject(QIBLA_PREFERENCES) private preferences: typeof Preferences,
  ) {}

  async getTarget(mode?: 'gps' | 'zone'): Promise<QiblaTarget> {
    if (mode) await this.preferences.set({ key: 'qiblaLocationMode', value: mode });
    const selectedMode = mode ?? (await this.preferences.get({ key: 'qiblaLocationMode' })).value;
    if (selectedMode !== 'zone') {
      try {
        if (!await this.location.ensureLocationEnabled(mode === 'gps')) {
          throw new Error('Aktifkan lokasi (GPS) dalam tetapan telefon untuk menggunakan Lokasi saya.');
        }
        const { coords } = await this.location.getCurrentLocation({
          enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
        }, mode === 'gps');
        return {
          bearing: calculateQiblaBearing(coords.latitude, coords.longitude),
          source: 'gps', latitude: coords.latitude, longitude: coords.longitude,
          accuracy: coords.accuracy,
        };
      } catch (error) {
        const permissionDenied = error === 'Kebenaran lokasi ditolak';
        if (mode === 'gps' && permissionDenied) {
          await this.location.showOpenSettingsDialog();
        }
        const gpsMessage = error instanceof Error && error.message.startsWith('Aktifkan lokasi')
          ? error.message
          : permissionDenied
            ? (Capacitor.isNativePlatform() ? undefined : 'Benarkan akses lokasi dalam tetapan untuk menggunakan GPS, kemudian kembali ke aplikasi untuk mengemas kini GPS secara automatik.')
            : 'Lokasi GPS tidak dapat diperoleh. Pastikan lokasi dihidupkan dan akses lokasi dibenarkan, kemudian kembali ke aplikasi untuk mengemas kini GPS secara automatik.';
        try {
          return { ...await this.getZoneTarget(), fallback: true, gpsMessage };
        } catch {
          throw new Error((gpsMessage ? gpsMessage + ' ' : '') + 'Arah kiblat zon juga tidak tersedia.');
        }
      }
    }
    return this.getZoneTarget();
  }

  private async getZoneTarget(): Promise<QiblaTarget> {
    const { value } = await this.preferences.get({ key: 'yearlyPrayerTimes' });
    const saved = value ? JSON.parse(value) : null;
    const zone = String(saved?.zone || 'KDH01').toUpperCase();
    if (!/^[A-Z]{3}\d{2}$/.test(zone)) throw new Error('Zon tidak sah.');
    let bearing = parseZoneBearing(saved?.bearing);
    const cacheKey = `qiblaZoneBearing:${zone}`;
    if (bearing === null) {
      const cached = await this.preferences.get({ key: cacheKey });
      bearing = parseZoneBearing(cached.value);
    }
    if (bearing === null) {
      const response = await firstValueFrom(this.http.get<{ status: string; bearing: string }>(
        `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=today&zone=${zone}`,
      ).pipe(timeout(10000)));
      bearing = response.status === 'OK!' ? parseZoneBearing(response.bearing) : null;
      if (bearing === null) throw new Error('Gagal mendapatkan arah kiblat untuk zon ini.');
      await this.preferences.set({ key: cacheKey, value: response.bearing });
    }
    return { bearing, source: 'zone', zone };
  }
}
