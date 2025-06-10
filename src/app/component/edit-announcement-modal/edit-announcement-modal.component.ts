import { Component, Input, OnInit } from '@angular/core';
import {
  ModalController,
  AlertController,
  LoadingController,
} from '@ionic/angular';

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

    <ion-content class="ion-padding">
      <ion-item>
        <ion-label position="stacked">Tajuk</ion-label>
        <ion-textarea
          [(ngModel)]="editAnnouncement.title"
          placeholder="Masukkan Tajuk"
          [autoGrow]="true"
        ></ion-textarea>
      </ion-item>
      <ion-item>
        <ion-label position="stacked">Pengumuman</ion-label>
        <ion-textarea
          [(ngModel)]="editAnnouncement.content"
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
          *ngIf="
            editAnnouncement.imageUrls && editAnnouncement.imageUrls.length > 0
          "
        >
          <div
            *ngFor="let url of editAnnouncement.imageUrls; let i = index"
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
          Tambah / Tukar Gambar
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
          (click)="confirmSave()"
          color="primary"
          [disabled]="!isFormValid() || !isContentChanged()"
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
export class EditAnnouncementModalComponent implements OnInit {
  @Input() news: any;
  editAnnouncement: any = { imageUrls: [] };
  originalAnnouncement: any;
  isUploading = false;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
  ) {}

  ngOnInit() {
    this.editAnnouncement = JSON.parse(JSON.stringify(this.news));
    // Backwards compatibility: if imageUrls doesn't exist but imageUrl does, create the array
    if (!Array.isArray(this.editAnnouncement.imageUrls)) {
      this.editAnnouncement.imageUrls = this.editAnnouncement.imageUrl
        ? [this.editAnnouncement.imageUrl]
        : [];
    }
    this.originalAnnouncement = JSON.parse(
      JSON.stringify(this.editAnnouncement),
    );
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async confirmSave() {
    const alert = await this.alertController.create({
      header: 'Simpan perubahan?',
      message: 'Pastikan data yang dimasukkan adalah betul.',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Simpan', handler: () => this.save() },
      ],
    });
    await alert.present();
  }

  save() {
    // Remove the old single `imageUrl` property before saving if it exists
    delete this.editAnnouncement.imageUrl;
    this.modalController.dismiss(this.editAnnouncement);
  }

  async onImageSelected(event: any) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

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
      return this.compressImage(file, 800, 0.7);
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

  compressImage(file: File, maxWidth: number, quality: number): Promise<void> {
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
          if (!ctx) return reject('Could not get 2D context');

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          if (!this.editAnnouncement.imageUrls) {
            this.editAnnouncement.imageUrls = [];
          }
          this.editAnnouncement.imageUrls.push(compressedDataUrl);
          resolve();
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number) {
    if (index > -1 && index < this.editAnnouncement.imageUrls.length) {
      this.editAnnouncement.imageUrls.splice(index, 1);
    }
  }

  isFormValid(): boolean {
    return (
      !!this.editAnnouncement.title?.trim() &&
      !!this.editAnnouncement.content?.trim() &&
      this.editAnnouncement.imageUrls?.length > 0 &&
      !this.isUploading
    );
  }

  isContentChanged(): boolean {
    return (
      JSON.stringify(this.editAnnouncement) !==
      JSON.stringify(this.originalAnnouncement)
    );
  }
}
