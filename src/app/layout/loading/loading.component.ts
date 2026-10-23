import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-loading',
  template: `
    <div *ngIf="!loaded" class="loading-container" role="status" aria-label="Memulakan aplikasi">
      <img src="assets/splash-masjidala-green.png" alt="Masjid Al-A'la" />
      <div class="loading-caption"><ion-spinner name="crescent" aria-hidden="true"></ion-spinner><span>Memulakan aplikasi…</span></div>
    </div>
  `,
  styles: [`
    .loading-container { position: fixed; inset: 0; z-index: 10001; background: #004d39; }
    img { width: 100%; height: 100%; object-fit: cover; }
    .loading-caption { position: absolute; bottom: calc(32px + env(safe-area-inset-bottom, 0px)); left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 12px; color: #fff; font-size: 13px; }
    ion-spinner { width: 20px; height: 20px; color: #fff; }
  `],
})
export class LoadingComponent implements OnChanges {
  @Input() loaded = false;
  @Input() isHomePage = false;
  static isLoaded = false;

  ngOnChanges(): void {
    LoadingComponent.isLoaded = this.loaded;
  }
}
