import { Component, OnDestroy } from '@angular/core';
import {
  ModalController,
  AlertController,
  LoadingController,
} from '@ionic/angular';

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

    <ion-content class="ion-padding">
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="newAnnouncement.content"
          placeholder="Masukkan Pengumuman"
          [autoGrow]="true"
        ></ion-textarea>
      </ion-item>
      <ion-item lines="none">
        <ion-label position="stacked">Gambar</ion-label>
      </ion-item>
      <div class="ion-padding-start ion-padding-end">
        <div class="image-size-tip">
          <ion-icon name="information-circle-outline"></ion-icon>
          Saiz gambar yang disyorkan: 600x400 px, maksimum 5MB setiap satu.
        </div>

        <!-- Image Previews -->
        <div
          class="preview-container"
          *ngIf="newAnnouncement.imageUrls.length > 0"
        >
          <div
            *ngFor="let url of newAnnouncement.imageUrls; let i = index"
            class="image-preview-wrapper"
          >
            <img [src]="url" alt="Selected Image Preview" />
            <ion-button
              (click)="removeImage(i)"
              color="danger"
              size="small"
              class="remove-btn"
            >
              <ion-icon name="close-circle" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
        </div>

        <ion-button
          expand="block"
          color="light"
          (click)="fileInput.click()"
          style="margin-top: 10px;"
        >
          <ion-icon name="images-outline" slot="start"></ion-icon>
          Pilih Gambar
        </ion-button>
        <input
          type="file"
          (change)="onImageSelected($event)"
          accept="image/*"
          #fileInput
          style="display: none;"
          multiple
        />
      </div>
      <div class="ion-padding ion-text-end">
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
        margin-bottom: 10px;
      }
      .image-size-tip ion-icon {
        margin-right: 5px;
        font-size: 16px;
      }
      .preview-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .image-preview-wrapper {
        position: relative;
        width: 100px;
        height: 100px;
      }
      .image-preview-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
        border: 1px solid #ddd;
      }
      .remove-btn {
        position: absolute;
        top: -5px;
        right: -5px;
        --padding-start: 0;
        --padding-end: 0;
        height: 24px;
        width: 24px;
      }
    `,
  ],
})
export class AddAnnouncementModalComponent implements OnDestroy {
  newAnnouncement = {
    title: '',
    content: '',
    imageUrls: [] as string[], // Holds object URLs for preview
  };
  selectedImageFiles: File[] = []; // Holds the actual File objects

  isUploading = false;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
  ) {}

  ngOnDestroy() {
    // Revoke all object URLs to avoid memory leaks
    this.newAnnouncement.imageUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmAdd() {
    const alert = await this.alertController.create({
      header: 'Sahkan Tambah Pengumuman',
      message: 'Anda pasti untuk menambah pengumuman ini?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
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
    // Pass the raw data and File objects back to the parent component
    this.modalController.dismiss({
      title: this.newAnnouncement.title,
      content: this.newAnnouncement.content,
      files: this.selectedImageFiles,
    });
  }

  async onImageSelected(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    this.isUploading = true;
    const loading = await this.loadingController.create({
      message: `Memproses ${files.length} gambar...`,
    });
    await loading.present();

    let oversizedFiles: string[] = [];
    const processingPromises = Array.from(files).map((file: any) => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > 5) {
        oversizedFiles.push(`${file.name} (${fileSizeMB.toFixed(2)}MB)`);
        return Promise.resolve();
      }
      // Return the promise from compressImage
      return this.compressImage(file as File, 800, 0.7).then(
        (compressedFile) => {
          if (compressedFile) {
            this.selectedImageFiles.push(compressedFile);
            this.newAnnouncement.imageUrls.push(
              URL.createObjectURL(compressedFile),
            );
          }
        },
      );
    });

    await Promise.all(processingPromises);

    this.isUploading = false;
    await loading.dismiss();

    if (oversizedFiles.length > 0) {
      this.alertController
        .create({
          header: 'Gambar Terlalu Besar',
          message: `Gambar berikut melebihi had 5MB: <br><ul>${oversizedFiles.map((f) => `<li>${f}</li>`).join('')}</ul>`,
          buttons: ['OK'],
        })
        .then((alert) => alert.present());
    }

    event.target.value = null;
  }

  compressImage(
    file: File,
    maxWidth: number,
    quality: number,
  ): Promise<File | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject('Could not get 2D context from canvas');
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Get the compressed image as a blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Create a new File object from the blob
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(null);
              }
            },
            'image/jpeg',
            quality,
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number) {
    // Revoke the object URL before removing it
    URL.revokeObjectURL(this.newAnnouncement.imageUrls[index]);
    // Remove the preview URL and the file
    this.newAnnouncement.imageUrls.splice(index, 1);
    this.selectedImageFiles.splice(index, 1);
  }

  isFormValid(): boolean {
    return (
      this.newAnnouncement.title.trim().length > 0 &&
      this.newAnnouncement.content.trim().length > 0 &&
      this.selectedImageFiles.length > 0 && // Ensure at least one image is selected
      !this.isUploading
    );
  }
}
