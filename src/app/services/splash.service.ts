import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class SplashService {
  private remoteSplashJson =
    'https://oc-manli.duckdns.org/masjidala/splash.json';
  private localSplashJson = 'assets/splash.json';
  private splashFileName = 'splash_image.png';
  private splashLastModifiedKey = 'splash_last_modified';
  private maxSizeBytes = 2 * 1024 * 1024; // 2MB
  private updateInProgress = false;

  // Initialize: return cached splash data URL if present and trigger background update
  async init(): Promise<string | null> {
    const cached = await this.getCachedSplash();
    // Fire-and-forget update check
    this.checkForUpdate().catch((err) =>
      console.error('Splash update failed', err),
    );
    return cached;
  }

  // Read cached splash image from Filesystem (Directory.Cache)
  async getCachedSplash(): Promise<string | null> {
    try {
      const { data } = await Filesystem.readFile({
        path: this.splashFileName,
        directory: Directory.Cache,
      });

      if (data) {
        return `data:image/png;base64,${data}`;
      }
    } catch (err) {
      // No cached file
    }
    return null;
  }

  // Check remote splash.json and update cached image based on Last-Modified header
  async checkForUpdate(): Promise<void> {
    // Guard against concurrent update checks
    if (this.updateInProgress) {
      console.log('Splash update already in progress, skipping');
      return;
    }

    try {
      this.updateInProgress = true;

      const json = await this.fetchSplashJson();
      if (!json || !json.splashUrl) return;

      // Get the Last-Modified from the image URL via HEAD request
      const lastModified = await this.getLastModifiedFromHead(json.splashUrl);
      if (!lastModified) {
        // Server doesn't provide Last-Modified; download anyway to be safe
        console.log('No Last-Modified header, forcing download');
        await this.downloadAndCacheSplash(json.splashUrl);
        return;
      }

      // Compare with stored Last-Modified
      const { value } = await Preferences.get({ key: this.splashLastModifiedKey });
      if (value === lastModified) {
        // Even if Last-Modified matches, verify the cached file actually exists.
        // If not (e.g., cache cleared, fresh install with stale prefs), force download.
        const cachedExists = await this.cachedFileExists();
        if (cachedExists) {
          console.log('Splash image not modified since last check (and cached file exists)');
          return;
        }
        console.log('Last-Modified unchanged but cached file missing, re-downloading');
      }

      // Last-Modified changed, not stored yet, or cached file missing → download and cache
      await this.downloadAndCacheSplash(json.splashUrl);

      await Preferences.set({
        key: this.splashLastModifiedKey,
        value: lastModified,
      });
    } catch (err) {
      console.error('checkForUpdate error', err);
    } finally {
      this.updateInProgress = false;
    }
  }

  private async cachedFileExists(): Promise<boolean> {
    try {
      const result = await Filesystem.stat({
        path: this.splashFileName,
        directory: Directory.Cache,
      });
      return result !== null;
    } catch {
      return false;
    }
  }

  private async downloadAndCacheSplash(url: string): Promise<void> {
    const base64 = await this.downloadImageAsBase64(url);
    if (!base64) return;

    const dataOnly = base64.replace(/^data:.+;base64,/, '');
    await Filesystem.writeFile({
      path: this.splashFileName,
      data: dataOnly,
      directory: Directory.Cache,
    });
  }

  // Perform a HEAD request to get the Last-Modified header value
  private async getLastModifiedFromHead(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (!resp.ok) return null;
      return resp.headers.get('Last-Modified');
    } catch (err) {
      console.error('getLastModifiedFromHead error', err);
      return null;
    }
  }

  private async fetchSplashJson(): Promise<any> {
    try {
      const headers = {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      } as any;
      const resp = await fetch(this.remoteSplashJson, { headers });
      if (!resp.ok) throw new Error('no remote json');
      return await resp.json();
    } catch (e) {
      try {
        const resp = await fetch(this.localSplashJson);
        if (!resp.ok) return null;
        return await resp.json();
      } catch (err) {
        return null;
      }
    }
  }

  private async downloadImageAsBase64(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) return null;
      const blob = await resp.blob();
      if (blob.size > this.maxSizeBytes) {
        console.warn('Splash image too large', blob.size);
        return null;
      }
      return await this.blobToDataURL(blob);
    } catch (err) {
      console.error('downloadImageAsBase64', err);
      return null;
    }
  }

  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
