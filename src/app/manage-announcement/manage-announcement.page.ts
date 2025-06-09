import { Component } from '@angular/core';
import {
  ModalController,
  AlertController,
  ViewWillEnter,
  ToastController,
  LoadingController, // Import LoadingController
} from '@ionic/angular';
import { AddAnnouncementModalComponent } from '../component/add-announcement-modal/add-announcement-modal.component';
import { EditAnnouncementModalComponent } from '../component/edit-announcement-modal/edit-announcement-modal.component';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

// Define interface for the announcement item
interface Announcement {
  id: number;
  title: string;
  author: string;
  content: string;
  imageUrl?: string;
  date: string;
  commentsCount: number;
  likes: number;
}

@Component({
  selector: 'app-manage-announcement',
  templateUrl: './manage-announcement.page.html',
  styleUrls: ['./manage-announcement.page.scss'],
})
export class ManageAnnouncementPage implements ViewWillEnter {
  private apiUrl = environment.apiUrl;
  isAddModalOpen = false;
  isEditModalOpen = false;
  newsItems: Announcement[] = [];
  isPageLoading = false; // Renamed from isLoading, used for initial page load only
  userIsAdmin: boolean = false;
  currentUser: any = null;
  private loading!: HTMLIonLoadingElement; // To hold the loading controller instance

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private storageService: StorageService,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private toastController: ToastController,
    private loadingController: LoadingController, // Inject LoadingController
  ) {}

  async ionViewWillEnter() {
    this.isPageLoading = true;
    console.log('Checking admin status in manage-announcement...');

    this.currentUser = await this.storageService.get('user');
    const isAdmin = await this.authService.isAdmin();
    this.userIsAdmin = isAdmin;

    if (!isAdmin) {
      console.log('User is NOT admin. Redirecting to /tabs/announcement...');
      await this.router.navigate(['/tabs/announcement'], { replaceUrl: true });
      this.isPageLoading = false; // Ensure loading is turned off before redirecting
      return;
    }

    console.log('User is admin. Allowing access.');
    await this.loadAnnouncements();
    this.isPageLoading = false;
  }

  // Helper method to show a loading overlay
  async showLoading(message: string) {
    this.loading = await this.loadingController.create({
      message: message,
    });
    await this.loading.present();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PTG' : 'PG';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const monthNames = [
      'Jan',
      'Feb',
      'Mac',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Ogo',
      'Sep',
      'Okt',
      'Nov',
      'Dis',
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();

    if (dateYear === currentYear) {
      return `${day} ${month}, ${hours}:${minutes} ${ampm}`;
    } else {
      return `${day} ${month}, ${dateYear}, ${hours}:${minutes} ${ampm}`;
    }
  }

  async loadAnnouncements() {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/announcements.php`),
      );
      if (response.success) {
        this.newsItems = response.announcements;
      } else {
        this.presentToast('Gagal memuatkan pengumuman');
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.presentToast('Ralat memuatkan pengumuman. Sila cuba lagi.');
    }
  }

  viewAnnouncementDetails(announcement: Announcement) {
    this.router.navigate(['/tabs/announcement', announcement.id]);
  }

  async openModal(modalId: string, news: Announcement | null = null) {
    if (!this.userIsAdmin) return;

    if (modalId === 'addAnnouncementModal') {
      const modal = await this.modalController.create({
        component: AddAnnouncementModalComponent,
      });
      modal.onDidDismiss().then(async (result) => {
        if (result?.data) {
          await this.showLoading('Menambah pengumuman...');
          try {
            const payload = { ...result.data, email: this.currentUser.email };
            const response = await firstValueFrom(
              this.http.post<any>(`${this.apiUrl}/announcements.php`, payload),
            );

            if (response.success) {
              this.newsItems.unshift(response.announcement);
              this.presentToast('Pengumuman berjaya ditambah', 'success');
            } else {
              this.presentToast('Gagal menambah pengumuman');
            }
          } catch (error) {
            console.error('Error adding announcement:', error);
            this.presentToast('Ralat menambah pengumuman. Sila cuba lagi.');
          } finally {
            this.loading.dismiss();
          }
        }
      });
      return await modal.present();
    } else if (modalId === 'editAnnouncementModal' && news) {
      const modal = await this.modalController.create({
        component: EditAnnouncementModalComponent,
        componentProps: { news: { ...news } },
      });
      modal.onDidDismiss().then(async (result) => {
        if (result?.data) {
          await this.showLoading('Mengemaskini pengumuman...');
          try {
            const payload = { ...result.data, email: this.currentUser.email };
            const response = await firstValueFrom(
              this.http.put<any>(`${this.apiUrl}/announcements.php`, payload),
            );

            if (response.success) {
              const index = this.newsItems.findIndex(
                (item) => item.id === response.announcement.id,
              );
              if (index > -1) {
                this.newsItems[index] = response.announcement;
                this.presentToast('Pengumuman berjaya dikemaskini', 'success');
              }
            } else {
              this.presentToast('Gagal mengemaskini pengumuman');
            }
          } catch (error) {
            console.error('Error updating announcement:', error);
            this.presentToast('Ralat mengemaskini pengumuman. Sila cuba lagi.');
          } finally {
            this.loading.dismiss();
          }
        }
      });
      return await modal.present();
    }
  }

  async deleteAnnouncement(news: Announcement) {
    if (!this.userIsAdmin) return;

    const alert = await this.alertController.create({
      header: 'Hapus Pengumuman',
      message: `Anda yakin ingin menghapus pengumuman "${news.title}"?`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Hapus',
          handler: async () => {
            await this.showLoading('Menghapus pengumuman...');
            try {
              const response = await firstValueFrom(
                this.http.delete<any>(
                  `${this.apiUrl}/announcements.php?id=${news.id}`,
                  { body: { email: this.currentUser.email } },
                ),
              );

              if (response.success) {
                const index = this.newsItems.findIndex(
                  (item) => item.id === news.id,
                );
                if (index > -1) {
                  this.newsItems.splice(index, 1);
                  this.presentToast('Pengumuman berjaya dihapuskan', 'success');
                }
              } else {
                this.presentToast('Gagal menghapus pengumuman');
              }
            } catch (error) {
              console.error('Error deleting announcement:', error);
              this.presentToast('Ralat menghapus pengumuman. Sila cuba lagi.');
            } finally {
              this.loading.dismiss();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async presentToast(message: string, color: string = 'danger') {
    console.log(`Showing toast: "${message}" (${color})`);
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: color,
    });
    await toast.present();
  }

  async handleRefresh(event: CustomEvent) {
    await this.loadAnnouncements();
    (event.target as HTMLIonRefresherElement).complete();
  }

  handleImageError(event: Event, news: Announcement) {
    const imgElement = event.target as HTMLImageElement;
    if (news.imageUrl && news.imageUrl.startsWith('data:image/')) {
      console.warn('Base64 image failed to load:', news.title);
      const base64Size = (news.imageUrl.length * 3) / 4 / (1024 * 1024);
      console.log(`Image size: ${base64Size.toFixed(2)}MB`);
      imgElement.src = 'data:image/svg+xml;base64,...'; // Placeholder
      imgElement.classList.add('image-error');
      imgElement.style.padding = '40px';
    } else {
      imgElement.src = 'assets/placeholder-image.png';
      imgElement.onerror = () => {
        imgElement.src = 'data:image/svg+xml;base64,...'; // Placeholder
        imgElement.style.padding = '40px';
      };
    }
  }
}
