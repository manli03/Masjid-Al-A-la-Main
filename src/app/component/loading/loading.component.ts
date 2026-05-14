import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { SplashService } from '../../services/splash.service';

@Component({
  selector: 'app-loading',
  template: `
    <div class="loading-container" [class.hidden]="shouldHide">
      <ng-container *ngIf="dynamicSplash; else defaultPicture">
        <img
          [src]="dynamicSplash"
          alt="Loading"
          class="loading-image"
          (error)="onImageError()"
        />
      </ng-container>

      <ng-template #defaultPicture>
        <picture *ngIf="!isLandscape">
          <!-- Portrait Mode -->
          <!-- Modern tall screens - check aspect ratio and density -->
          <source
            media="(min-aspect-ratio: 9/19) and (max-aspect-ratio: 9/21) and (min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxxhdpi_tall_portrait.png"
          />
          <source
            media="(min-aspect-ratio: 9/19) and (max-aspect-ratio: 9/21) and (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xxhdpi_tall_portrait.png"
          />
          <!-- Standard density-based images -->
          <source
            media="(min-resolution: 4dppx), (-webkit-min-device-pixel-ratio: 4)"
            srcset="assets/loading/xxxhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xhdpi_portrait.png"
          />
          <source
            media="(min-resolution: 1.5dppx), (-webkit-min-device-pixel-ratio: 1.5)"
            srcset="assets/loading/hdpi_portrait.png"
          />
          <source
            media="(min-resolution: 1dppx), (-webkit-min-device-pixel-ratio: 1)"
            srcset="assets/loading/mdpi_portrait.png"
          />
          <!-- Default fallback -->
          <img
            src="assets/loading/xxhdpi_portrait.png"
            alt="Loading"
            class="loading-image"
          />
        </picture>

        <picture *ngIf="isLandscape">
          <!-- Landscape Mode -->
          <!-- Taller landscape screens (modern ultra-wide devices) -->
          <source
            media="(min-aspect-ratio: 21/9) and (min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxxhdpi_tall_landscape.png"
          />
          <source
            media="(min-aspect-ratio: 21/9) and (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xxhdpi_tall_landscape.png"
          />
          <!-- Standard density-based landscape images -->
          <source
            media="(min-resolution: 4dppx), (-webkit-min-device-pixel-ratio: 4)"
            srcset="assets/loading/xxxhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 3dppx), (-webkit-min-device-pixel-ratio: 3)"
            srcset="assets/loading/xxhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)"
            srcset="assets/loading/xhdpi_landscape.png"
          />
          <source
            media="(min-resolution: 1.5dppx), (-webkit-min-device-pixel-ratio: 1.5)"
            srcset="assets/loading/hdpi_landscape.png"
          />
          <source
            media="(min-resolution: 1dppx), (-webkit-min-device-pixel-ratio: 1)"
            srcset="assets/loading/mdpi_landscape.png"
          />
          <!-- Default fallback -->
          <img
            src="assets/loading/xxhdpi_landscape.png"
            alt="Loading"
            class="loading-image"
          />
        </picture>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .loading-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        transition: opacity 0.5s ease;
      }
      .loading-container.hidden {
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      }
      .loading-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ],
})
export class LoadingComponent implements OnInit, OnChanges {
  @Input() loaded = false;
  @Input() isHomePage = false;
  isLandscape = false;
  shouldHide = false;
  static isLoaded = false;
  startTime: number = 0;
  minDisplayTime = 3000; // 3 seconds minimum for home page
  dynamicSplash: string | null = null;
  private safetyTimer: any = null;

  constructor(private splashService: SplashService) {}

  ngOnInit() {
    console.log(
      'Loading component initialized, loaded state:',
      this.loaded,
      'isHomePage:',
      this.isHomePage,
    );

    // Record the start time when component initializes
    this.startTime = Date.now();

    // Try to load cached remote splash (if any) and update in background
    this.splashService.init().then((url) => {
      if (url) {
        this.dynamicSplash = url;
      }
    });

    // Force a reflow to ensure the loading screen covers everything
    document.body.style.overflow = 'hidden';

    // Start safety timer to ensure the overlay is removed eventually
    this.safetyTimer = setTimeout(() => {
      if (!this.shouldHide) {
        console.warn('Splash safety timeout reached, hiding overlay');
        this.hide();
      }
    }, 12000);

    // Check initial orientation
    this.checkOrientation();

    // Setup orientation change listener
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });

    // Start time recorded; if the app is already loaded, evaluate hide logic
    // after ensuring minimum display time.
    if (this.loaded) {
      this.handleLoadedChange();
    }
  }

  onImageError() {
    console.warn(
      'Dynamic splash image failed to load, falling back to bundled assets',
    );
    this.dynamicSplash = null;
  }

  ngOnChanges(changes: SimpleChanges) {
    // Handle `loaded` changes for all pages: enforce minimum display time before hiding
    if (changes['loaded'] && changes['loaded'].currentValue === true) {
      console.log(
        'Loading component: loaded changed from',
        changes['loaded'].previousValue,
        'to',
        changes['loaded'].currentValue,
      );

      // If component hasn't finished init yet, defer handling until ngOnInit runs
      if (this.startTime === 0) {
        return;
      }

      this.handleLoadedChange();
    }
  }

  private handleLoadedChange() {
    // Only proceed if `loaded` is true
    if (!this.loaded) return;

    // Enforce minimum display time for all pages
    const elapsedTime = Date.now() - this.startTime;
    if (elapsedTime < this.minDisplayTime) {
      const remaining = this.minDisplayTime - elapsedTime;
      console.log(
        `Waiting ${remaining}ms to satisfy min display time before hiding`,
      );
      setTimeout(() => {
        if (this.loaded) this.hide();
      }, remaining);
    } else {
      this.hide();
    }
  }

  // Exposed so parent components can programmatically hide the loading overlay
  public hide(): void {
    if (this.shouldHide) return;
    this.shouldHide = true;
    LoadingComponent.isLoaded = true;
    // Clear safety timer
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    setTimeout(() => {
      document.body.style.overflow = '';
    }, 500);
  }

  private checkOrientation() {
    const previousOrientation = this.isLandscape;
    this.isLandscape = window.innerWidth > window.innerHeight;

    // If orientation changed, force a reflow
    if (previousOrientation !== this.isLandscape) {
      console.log(
        'Orientation changed to:',
        this.isLandscape ? 'landscape' : 'portrait',
      );
      setTimeout(() => {
        const loadingContainer = document.querySelector('.loading-container');
        if (loadingContainer) {
          (loadingContainer as HTMLElement).style.opacity = '0.99';
          setTimeout(() => {
            (loadingContainer as HTMLElement).style.opacity = '1';
          }, 10);
        }
      }, 50);
    }
  }
}
