import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Dialog } from '@capacitor/dialog';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CheckUpdateService {
  private apkUrl =
    'https://bit.ly/AppMasjidAla';
  private updateJsonUrl = 'https://oc-manli.duckdns.org/masjidala/update.json';
  private localUpdatePath = 'assets/update.json';
  private embeddedModified: string | null = null;

  constructor(private http: HttpClient) {}

  async checkForUpdate() {
    try {
      // Load local embedded version
      const local: any = await lastValueFrom(this.http.get(this.localUpdatePath));
      this.embeddedModified = local.lastPreviousUpdate;

      if (!this.embeddedModified) {
        console.warn('No embedded update date found');
        return;
      }

      // Load server update info
      const headers = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
      const remote: any = await lastValueFrom(
        this.http.get(this.updateJsonUrl, { headers })
      );

      const serverModified = remote?.lastPreviousUpdate;

      if (!serverModified) return;

      const isNewVersion = serverModified !== this.embeddedModified;

      if (isNewVersion) {
        const { value } = await Dialog.confirm({
          title: 'Kemas Kini Aplikasi Tersedia',
          message:
            'Versi baru aplikasi tersedia. Adakah anda mahu memuat turunnya sekarang?',
          okButtonTitle: 'Muat Turun',
          cancelButtonTitle: 'Kemudian',
        });

        if (value) {
          window.open(this.apkUrl, '_blank');
        }
      }
    } catch (err) {
      console.log('Update check failed:', err);
    }
  }
}
