import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { Platform } from '@ionic/angular';

@Component({
  selector: 'app-loading',
  template: `
    <div class="loading-container" [class.hidden]="shouldHide">
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
        background-color: #ffffff;
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
  startTime: number = 0;
  minDisplayTime = 5000; // 5 seconds minimum for home page
  nonHomeDisplayTime = 3000; // 3 seconds fixed for non-home pages

  constructor(private platform: Platform) {}

  ngOnInit() {
    console.log(
      'Loading component initialized, loaded state:',
      this.loaded,
      'isHomePage:',
      this.isHomePage,
    );

    // Record the start time when component initializes
    this.startTime = Date.now();

    // Force a reflow to ensure the loading screen covers everything
    document.body.style.overflow = 'hidden';

    // Check initial orientation
    this.checkOrientation();

    // Setup orientation change listener
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });

    // For non-home pages, show for exactly 2 seconds regardless of loaded state
    if (!this.isHomePage) {
      console.log(
        'Non-home page detected, will show loading for 2 seconds fixed',
      );
      setTimeout(() => {
        console.log('Non-home page timer complete, hiding loading screen');
        this.shouldHide = true;
        // Release body overflow after transition
        setTimeout(() => {
          document.body.style.overflow = '';
        }, 500);
      }, this.nonHomeDisplayTime);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // For non-home pages, we don't need to respond to loaded changes
    if (!this.isHomePage) {
      return;
    }

    // Only handle loaded changes for home page
    if (changes['loaded'] && changes['loaded'].currentValue === true) {
      console.log(
        'Loading component: loaded changed from',
        changes['loaded'].previousValue,
        'to',
        changes['loaded'].currentValue,
        'for home page',
      );

      // Calculate how much time has elapsed since component was initialized
      const elapsedTime = Date.now() - this.startTime;

      // If less than minDisplayTime has passed, wait for the remainder
      if (elapsedTime < this.minDisplayTime) {
        const remainingTime = this.minDisplayTime - elapsedTime;
        console.log(
          `Home page loading screen showing for ${remainingTime}ms more to ensure minimum display time`,
        );

        setTimeout(() => {
          this.shouldHide = true;
          // When loaded becomes true, ensure we release body overflow after transition
          setTimeout(() => {
            document.body.style.overflow = '';
          }, 500); // Match this to the transition time in CSS
        }, remainingTime);
      } else {
        // If minDisplayTime has already passed, hide immediately
        console.log(
          'Minimum display time already elapsed, hiding home page loading screen',
        );
        this.shouldHide = true;

        // When loaded becomes true, ensure we release body overflow after transition
        setTimeout(() => {
          document.body.style.overflow = '';
        }, 500); // Match this to the transition time in CSS
      }
    }
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
