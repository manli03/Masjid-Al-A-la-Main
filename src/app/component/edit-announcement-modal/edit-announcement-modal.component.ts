import { Component, Input } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-edit-announcement-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Edit Pengumuman</ion-title>
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
          [(ngModel)]="editAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
          (ngModelChange)="checkFormValidity()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="editAnnouncement.content"
          placeholder="Masukkan Pengumuman"
          [autoGrow]="true"
          (ngModelChange)="checkFormValidity()"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Gambar</ion-label>
        <div class="image-size-tip">
          <ion-icon name="information-circle-outline"></ion-icon>
          Saiz gambar yang disyorkan: 600x400 px, maksimum 5MB
        </div>
        <img
          *ngIf="editAnnouncement.imageUrl"
          [src]="editAnnouncement.imageUrl"
          alt="Gambar"
          style="max-width: 100%; margin: 10px 0; border-radius: 5px;"
        />
        <ion-button
          expand="block"
          color="light"
          (click)="fileInput.click()"
          style="margin: 20px 0;"
        >
          <span [style.text-transform]="imageName ? 'none' : null">
            {{ imageName ? imageName : 'Tukar Gambar' }}
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
          (click)="confirmSave()"
          color="primary"
          [disabled]="!formIsValid || !isContentChanged()"
          >Simpan</ion-button
        >
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
export class EditAnnouncementModalComponent {
  @Input() news: any;
  editAnnouncement: any;
  originalAnnouncement: any;
  formIsValid = false;

  imageName: string = '';

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
  ) {}

  ngOnInit() {
    this.editAnnouncement = { ...this.news };
    this.originalAnnouncement = { ...this.news };
    this.checkFormValidity();
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmSave() {
    const alert = await this.alertController.create({
      header: 'Simpan perubahan?',
      message: 'Pastikan data yang dimasukkan adalah betul.',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Simpan',
          handler: () => {
            this.save();
          },
        },
      ],
    });

    await alert.present();
  }

  save() {
    this.modalController.dismiss(this.editAnnouncement);
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
    this.compressImage(file, 600, 0.7); // max width 600px, quality 70%
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
        this.editAnnouncement.imageUrl = compressedDataUrl;

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

        this.checkFormValidity();
      };
    };
    reader.readAsDataURL(file);
  }

  checkFormValidity() {
    this.formIsValid =
      this.editAnnouncement.title && this.editAnnouncement.content;
  }

  isContentChanged() {
    return (
      JSON.stringify(this.editAnnouncement) !==
      JSON.stringify(this.originalAnnouncement)
    );
  }
}

