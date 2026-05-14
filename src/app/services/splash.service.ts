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
  private splashVersionKey = 'splash_version';
  private maxSizeBytes = 2 * 1024 * 1024; // 2MB

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

  // Check remote splash.json and update cached image if version changed
  async checkForUpdate(): Promise<void> {
    try {
      const json = await this.fetchSplashJson();
      if (!json || !json.splashUrl) return;

      const remoteVersion = json.version || json.etag || json.splashUrl;
      const { value } = await Preferences.get({ key: this.splashVersionKey });
      if (value === remoteVersion) return;

      const base64 = await this.downloadImageAsBase64(json.splashUrl);
      if (!base64) return;

      const dataOnly = base64.replace(/^data:.+;base64,/, '');
      await Filesystem.writeFile({
        path: this.splashFileName,
        data: dataOnly,
        directory: Directory.Cache,
      });

      await Preferences.set({
        key: this.splashVersionKey,
        value: remoteVersion,
      });
    } catch (err) {
      console.error('checkForUpdate error', err);
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
