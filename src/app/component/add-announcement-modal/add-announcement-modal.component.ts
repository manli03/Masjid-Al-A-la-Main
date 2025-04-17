import { Component } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-add-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tambah Pengumuman</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
          (ngModelChange)="validateFields()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.content"
          placeholder="Masukkan Pengumuman"
          [autoGrow]="true"
          (ngModelChange)="validateFields()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Gambar</ion-label>
        <div class="image-size-tip">
          <ion-icon name="information-circle-outline"></ion-icon>
          Saiz gambar yang disyorkan: 600x400 px, maksimum 5MB
        </div>
        <img
          *ngIf="newAnnouncement.imageUrl"
          [src]="newAnnouncement.imageUrl"
          alt="Selected Image"
          style="width: 100%; margin: 10px 0; border-radius: 5px;"
        />
        <ion-button
          expand="block"
          color="light"
          (click)="fileInput.click()"
          style="margin: 20px 0;"
        >
          <span [style.text-transform]="imageName ? 'none' : null">
            {{ imageName ? imageName : 'Pilih Gambar' }}
          </span>
        </ion-button>
        <input
          type="file"
          (change)="onImageSelected($event)"
          accept="image/*"
          id="choose-file"
          #fileInput
          style="display: none;"
        />
      </ion-item>
      <div class="ion-text-end">
        <ion-button (click)="dismiss()" color="light">Batal</ion-button>
        <ion-button
          (click)="confirmAdd()"
          color="primary"
          [disabled]="!isFormValid()"
        >
          Tambah
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .image-size-tip {
        font-size: 12px;
        padding: 5px 0;
        color: #3880ff;
        margin-top: 5px;
        display: flex;
        align-items: center;
      }
      .image-size-tip ion-icon {
        margin-right: 5px;
        font-size: 16px;
      }
    `,
  ],
})
export class AddAnnouncementModalComponent {
  newAnnouncement = {
    title: '',
    content: '',
    imageUrl: '',
    commentsCount: 0,
    likes: 0,
  };

  imageName: string = '';

  // Content size limits in bytes
  readonly MAX_CONTENT_SIZE = 1000000; // 1MB - should match the backend limit
  readonly WARNING_THRESHOLD = 750000; // 75% of max size

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
  ) {}

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmAdd() {
    // Check content size one more time before submitting
    if (this.isContentSizeError()) {
      const alert = await this.alertController.create({
        header: 'Content Too Large',
        message:
          'Your announcement content exceeds the maximum allowed size. Please reduce the content length.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Sahkan Tambah Pengumuman',
      message: 'Anda pasti untuk menambah pengumuman ini?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            console.log('Confirm cancelled');
          },
        },
        {
          text: 'Tambah',
          handler: () => {
            this.save();
          },
        },
      ],
    });

    await alert.present();
  }

  save() {
    this.modalController.dismiss(this.newAnnouncement);
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    this.imageName = file ? file.name : '';

    // Check file size first (raw file)
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      // 5MB limit for raw images
      this.alertController
        .create({
          header: 'Image Too Large',
          message: `Selected image is ${fileSizeMB.toFixed(2)}MB. Please select an image smaller than 5MB.`,
          buttons: ['OK'],
        })
        .then((alert) => alert.present());
      return;
    }

    // Compress and resize the image before converting to base64
    this.compressImage(file, 800, 0.7); // max width 800px, quality 70%
  }

  // Compress and resize image before converting to base64
  compressImage(file: File, maxWidth: number, quality: number) {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions if needed
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get 2D context from canvas');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with reduced quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Update component state
        this.newAnnouncement.imageUrl = compressedDataUrl;

        // Check final size of base64 string to ensure it's under limits
        const base64Size = (compressedDataUrl.length * 3) / 4 / (1024 * 1024);
        if (base64Size > 1) {
          // If still too large, compress further or warn user
          console.warn(
            `Compressed image is still large: ${base64Size.toFixed(2)}MB`,
          );

          // For very large images, compress again with lower quality
          if (base64Size > 2) {
            this.compressImage(file, 600, 0.5);
            return;
          }
        }

        this.validateFields();
      };
    };
    reader.readAsDataURL(file);
  }

  validateFields() {
    // Kept for backward compatibility
  }

  getContentSize(): number {
    return this.newAnnouncement.content?.length || 0;
  }

  isContentSizeWarning(): boolean {
    const size = this.getContentSize();
    return size > this.WARNING_THRESHOLD && size <= this.MAX_CONTENT_SIZE;
  }

  isContentSizeError(): boolean {
    return this.getContentSize() > this.MAX_CONTENT_SIZE;
  }

  isFormValid(): boolean {
    return (
      !!this.newAnnouncement.title &&
      !!this.newAnnouncement.content &&
      !!this.newAnnouncement.imageUrl &&
      !this.isContentSizeError()
    );
  }
}
