import { Component, Input, OnInit, OnDestroy } from '@angular/core';
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
          *ngIf="previewUrls && previewUrls.length > 0"
        >
          <div
            *ngFor="let url of previewUrls; let i = index"
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
export class EditAnnouncementModalComponent implements OnInit, OnDestroy {
  @Input() news: any;

  // Data for the form
  editAnnouncement: { title: string; content: string } = {
    title: '',
    content: '',
  };
  originalAnnouncement: {
    title: string;
    content: string;
    imageUrls: string[];
  } = {
    title: '',
    content: '',
    imageUrls: [],
  };

  // Image management state
  previewUrls: string[] = []; // Mix of http and blob URLs for display
  existingImagesToKeep: string[] = []; // Filenames of original images to keep
  newlySelectedFiles: File[] = []; // New files to upload

  isUploading = false;
  private newObjectUrls: string[] = []; // Keep track of new blob URLs for cleanup

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
  ) {}

  ngOnInit() {
    // Deep copy for safe editing
    this.editAnnouncement.title = this.news.title;
    this.editAnnouncement.content = this.news.content;

    // Ensure imageUrls is an array
    const imageUrls = Array.isArray(this.news.imageUrls)
      ? this.news.imageUrls
      : this.news.imageUrl
        ? [this.news.imageUrl]
        : [];

    this.previewUrls = [...imageUrls];
    this.existingImagesToKeep = imageUrls.map((url: string) =>
      this.getFilenameFromUrl(url),
    );

    // Store original state to check for changes
    this.originalAnnouncement = {
      title: this.news.title,
      content: this.news.content,
      imageUrls: [...imageUrls],
    };
  }

  ngOnDestroy() {
    // Revoke all newly created object URLs to prevent memory leaks
    this.newObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const urlObject = new URL(url);
      const pathSegments = urlObject.pathname.split('/');
      return pathSegments.pop() || '';
    } catch (e) {
      // Fallback for invalid URLs, though unlikely
      const parts = url.split('/');
      return parts[parts.length - 1];
    }
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
    this.modalController.dismiss({
      title: this.editAnnouncement.title,
      content: this.editAnnouncement.content,
      existingImages: this.existingImagesToKeep,
      newFiles: this.newlySelectedFiles,
    });
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
      return this.compressImage(file as File, 800, 0.7).then(
        (compressedFile) => {
          if (compressedFile) {
            this.newlySelectedFiles.push(compressedFile);
            const objectUrl = URL.createObjectURL(compressedFile);
            this.previewUrls.push(objectUrl);
            this.newObjectUrls.push(objectUrl); // Track for cleanup
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
          message: `Gambar berikut melebihi had 5MB:\n${oversizedFiles.join('\n')}`,
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

          canvas.toBlob(
            (blob) => {
              if (blob) {
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
    const urlToRemove = this.previewUrls[index];

    if (urlToRemove.startsWith('blob:')) {
      // This is a new image (object URL)
      const newUrlIndex = this.newObjectUrls.indexOf(urlToRemove);
      if (newUrlIndex > -1) {
        // Find the corresponding file and remove it
        // This assumes the order is preserved, which it should be
        const fileIndex = this.previewUrls
          .slice(0, index)
          .filter((u) => u.startsWith('blob:')).length;

        this.newlySelectedFiles.splice(fileIndex, 1);
        this.newObjectUrls.splice(newUrlIndex, 1);
        URL.revokeObjectURL(urlToRemove);
      }
    } else {
      // This is an existing image (http URL)
      const filename = this.getFilenameFromUrl(urlToRemove);
      const keepIndex = this.existingImagesToKeep.indexOf(filename);
      if (keepIndex > -1) {
        this.existingImagesToKeep.splice(keepIndex, 1);
      }
    }

    // Remove from the preview array
    this.previewUrls.splice(index, 1);
  }

  isFormValid(): boolean {
    return (
      this.editAnnouncement.title.trim().length > 0 &&
      this.editAnnouncement.content.trim().length > 0 &&
      this.previewUrls.length > 0 && // Must have at least one image
      !this.isUploading
    );
  }

  isContentChanged(): boolean {
    const imagesChanged =
      this.originalAnnouncement.imageUrls.length !== this.previewUrls.length ||
      this.originalAnnouncement.imageUrls.some(
        (url, i) => url !== this.previewUrls[i],
      );

    return (
      this.originalAnnouncement.title !== this.editAnnouncement.title ||
      this.originalAnnouncement.content !== this.editAnnouncement.content ||
      imagesChanged
    );
  }
}
