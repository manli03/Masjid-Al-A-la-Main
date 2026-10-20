import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewEncapsulation,
} from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

// Import the core Swiper library and required modules
import Swiper from 'swiper';
import { Zoom, Pagination } from 'swiper/modules';

@Component({
  selector: 'app-image-viewer-modal',
  standalone: true,
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // Fix #1: Disable view encapsulation to allow styles to correctly target Swiper's dynamic elements
  encapsulation: ViewEncapsulation.None,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title [class.hidden-controls]="controlsHidden"
          >Lihat Imej</ion-title
        >
        <ion-buttons slot="end" [class.hidden-controls]="controlsHidden">
          <ion-button (click)="dismissModal()">
            <ion-icon slot="icon-only" name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content
      class="image-viewer-content ion-no-padding"
      [class.dark]="isDarkMode"
      [class.light]="!isDarkMode"
      (click)="toggleControls()"
    >
      <div class="swiper image-viewer-swiper-container" #swiperContainer>
        <div class="swiper-wrapper">
          <div class="swiper-slide" *ngFor="let img of imageUrls">
            <div class="swiper-zoom-container">
              <img
                [src]="img"
                (error)="handleImageError($event)"
                alt="Gallery Image"
              />
            </div>
          </div>
        </div>
        <!-- This is the pagination element that Swiper will populate -->
        <div
          class="swiper-pagination"
          [class.hidden-controls]="controlsHidden"
        ></div>
      </div>

      <!-- Navigation Buttons - Only show when there are multiple images -->
      <ion-fab
        *ngIf="imageUrls.length > 1"
        [class.hidden-controls]="controlsHidden"
        vertical="center"
        horizontal="start"
        slot="fixed"
      >
        <ion-fab-button
          (click)="prev($event)"
          [color]="isDarkMode ? 'light' : 'dark'"
          size="small"
        >
          <ion-icon name="chevron-back-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
      <ion-fab
        *ngIf="imageUrls.length > 1"
        [class.hidden-controls]="controlsHidden"
        vertical="center"
        horizontal="end"
        slot="fixed"
      >
        <ion-fab-button
          (click)="next($event)"
          [color]="isDarkMode ? 'light' : 'dark'"
          size="small"
        >
          <ion-icon name="chevron-forward-outline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [
    `
      @import 'swiper/css';
      @import 'swiper/css/zoom';
      @import 'swiper/css/pagination';

      .hidden-controls {
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
      }

      .image-viewer-content {
        &.dark {
          ion-fab-button {
            --background: rgba(255, 255, 255, 0.2);
            --background-activated: rgba(255, 255, 255, 0.4);
          }

          .swiper-pagination {
            background-color: rgba(255, 255, 255, 0.2);
            color: #ffffff;
          }
        }

        &.light {
          ion-fab-button {
            --background: rgba(0, 0, 0, 0.2);
            --background-activated: rgba(0, 0, 0, 0.4);
          }

          .swiper-pagination {
            background-color: rgba(0, 0, 0, 0.2);
            color: #000000;
          }
        }
      }

      /* Target this specific swiper instance to avoid global style conflicts */
      .image-viewer-swiper-container {
        width: 100%;
        height: 100%;

        /* This is where we style Swiper's dynamically added pagination element */
        .swiper-pagination {
          position: absolute;
          bottom: 20px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;

          /* Styling for the background of the counter */
          width: auto !important;
          padding: 6px 16px;
          border-radius: 16px;
          z-index: 10;
          pointer-events: none;
          font-size: 14px;
          font-weight: 500;
        }
      }

      /* Keep the other styles for the slides and buttons */
      .swiper-slide {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .swiper-zoom-container {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .swiper-zoom-container img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    `,
  ],
})
export class ImageViewerModalComponent implements AfterViewInit {
  @Input() imageUrls: string[] = [];
  @Input() initialIndex: number = 0;
  controlsHidden = false;
  isDarkMode = true; // Default to dark mode

  @ViewChild('swiperContainer') swiperContainer: ElementRef | undefined;
  swiper?: Swiper;

  constructor(private modalController: ModalController) {
    // Check if the user's system prefers dark mode
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Listen for changes in system dark mode preference
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        this.isDarkMode = e.matches;
      });
  }

  ngAfterViewInit() {
    // A small timeout is still a good practice for modals
    setTimeout(() => {
      this.initSwiper();
    }, 100);
  }

  initSwiper() {
    if (this.swiperContainer) {
      this.swiper = new Swiper(this.swiperContainer.nativeElement, {
        modules: [Zoom, Pagination],
        initialSlide: this.initialIndex,
        zoom: {
          maxRatio: 3,
          toggle: true,
        },
        pagination: {
          el: '.swiper-pagination', // Swiper targets this class name
          type: 'fraction', // Format "1 / 7"
        },
      });
    }
  }

  toggleControls() {
    this.controlsHidden = !this.controlsHidden;
  }

  prev(event: Event) {
    event.stopPropagation(); // Prevent the click from triggering toggleControls
    this.swiper?.slidePrev();
  }

  next(event: Event) {
    event.stopPropagation(); // Prevent the click from triggering toggleControls
    this.swiper?.slideNext();
  }

  dismissModal() {
    this.swiper?.destroy(true, true);
    this.modalController.dismiss();
  }

  handleImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM4ODgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSAzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
    imgElement.style.width = '100px';
    imgElement.style.height = '100px';
  }
}
