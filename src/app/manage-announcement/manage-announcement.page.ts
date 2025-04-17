import { Component, OnInit } from '@angular/core';
import {
  ModalController,
  AlertController,
  ViewWillEnter,
  LoadingController,
  ToastController,
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
  isLoading = false;
  userIsAdmin: boolean = false;
  currentUser: any = null;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private storageService: StorageService,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private loadingController: LoadingController,
    private toastController: ToastController,
  ) {}

  async ionViewWillEnter() {
    this.isLoading = true;
    console.log('Checking admin status in manage-announcement...');

    // Load current user
    this.currentUser = await this.storageService.get('user');

    // Check admin status directly from database
    const isAdmin = await this.authService.isAdmin();
    this.userIsAdmin = isAdmin;

    if (!isAdmin) {
      console.log('User is NOT admin. Redirecting to /tabs/announcement...');
      // Use replaceUrl: true to remove the management page from navigation history
      await this.router.navigate(['/tabs/announcement'], { replaceUrl: true });
      return;
    }

    console.log('User is admin. Allowing access.');
    // Load announcements from backend
    await this.loadAnnouncements();
    this.isLoading = false;
  }

  async loadAnnouncements() {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.apiUrl}/announcements.php`),
      );
      if (response.success) {
        this.newsItems = response.announcements;
      } else {
        this.presentToast('Failed to load announcements');
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.presentToast('Error loading announcements. Please try again.');
    }
  }

  // Navigate to announcement details page
  viewAnnouncementDetails(announcement: Announcement) {
    // Navigate directly to the announcement details page with the ID as a route parameter
    this.router.navigate(['/tabs/announcement', announcement.id]);
  }

  async openModal(modalId: string, news: Announcement | null = null) {
    // Guard: Only allow opening modals if the user is confirmed to be admin
    if (!this.userIsAdmin) return;

    if (modalId === 'addAnnouncementModal') {
      const modal = await this.modalController.create({
        component: AddAnnouncementModalComponent,
      });
      modal.onDidDismiss().then(async (result) => {
        if (result?.data) {
          this.isLoading = true;
          try {
            // Send to backend
            const payload = {
              ...result.data,
              email: this.currentUser.email, // to validate admin status
            };

            const response = await firstValueFrom(
              this.http.post<any>(`${this.apiUrl}/announcements.php`, payload),
            );

            if (response.success) {
              // Add the new announcement to the list
              this.newsItems.unshift(response.announcement);
              this.presentToast('Announcement added successfully');
            } else {
              this.presentToast('Failed to add announcement');
            }
          } catch (error) {
            console.error('Error adding announcement:', error);
            this.presentToast('Error adding announcement. Please try again.');
          } finally {
            this.isLoading = false;
          }
        }
      });
      return await modal.present();
    } else if (modalId === 'editAnnouncementModal' && news) {
      const modal = await this.modalController.create({
        component: EditAnnouncementModalComponent,
        componentProps: { news: { ...news } }, // Pass a copy to prevent direct mutation if modal cancelled
      });
      modal.onDidDismiss().then(async (result) => {
        if (result?.data) {
          this.isLoading = true;
          try {
            // Send to backend
            const payload = {
              ...result.data,
              email: this.currentUser.email, // to validate admin status
            };

            const response = await firstValueFrom(
              this.http.put<any>(`${this.apiUrl}/announcements.php`, payload),
            );

            if (response.success) {
              // Find and update the announcement in the list
              const index = this.newsItems.findIndex(
                (item) => item.id === response.announcement.id,
              );
              if (index > -1) {
                this.newsItems[index] = response.announcement;
                this.presentToast('Announcement updated successfully');
              }
            } else {
              this.presentToast('Failed to update announcement');
            }
          } catch (error) {
            console.error('Error updating announcement:', error);
            this.presentToast('Error updating announcement. Please try again.');
          } finally {
            this.isLoading = false;
          }
        }
      });
      return await modal.present();
    }
  }

  async deleteAnnouncement(news: Announcement) {
    // Guard: Only allow deletion if the user is confirmed to be admin
    if (!this.userIsAdmin) return;

    const alert = await this.alertController.create({
      header: 'Hapus Pengumuman',
      message: `Anda yakin ingin menghapus pengumuman "${news.title}"?`,
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Hapus',
          handler: async () => {
            this.isLoading = true;
            try {
              // Send to backend with id as URL parameter and email in request body
              const response = await firstValueFrom(
                this.http.delete<any>(
                  `${this.apiUrl}/announcements.php?id=${news.id}`,
                  { body: { email: this.currentUser.email } },
                ),
              );

              if (response.success) {
                // Remove from the UI list
                const index = this.newsItems.findIndex(
                  (item) => item.id === news.id,
                );
                if (index > -1) {
                  this.newsItems.splice(index, 1);
                  this.presentToast('Announcement deleted successfully');
                }
              } else {
                this.presentToast('Failed to delete announcement');
              }
            } catch (error) {
              console.error('Error deleting announcement:', error);
              this.presentToast(
                'Error deleting announcement. Please try again.',
              );
            } finally {
              this.isLoading = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // Helper method to show toast notifications
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }

  // Handle refresh
  async handleRefresh(event: CustomEvent) {
    await this.loadAnnouncements();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Handles image loading errors by showing a placeholder
   */
  handleImageError(event: Event, news: Announcement) {
    const imgElement = event.target as HTMLImageElement;

    // Check if it's a base64 image that might be too large or corrupt
    if (news.imageUrl && news.imageUrl.startsWith('data:image/')) {
      console.warn('Base64 image failed to load:', news.title);

      // For debugging - log the size of the base64 string
      const base64Size = (news.imageUrl.length * 3) / 4 / (1024 * 1024);
      console.log(`Image size: ${base64Size.toFixed(2)}MB`);

      // Replace with a placeholder icon (as a data URI to avoid additional requests)
      imgElement.src =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';

      // Set a special class to style the placeholder
      imgElement.classList.add('image-error');
      imgElement.style.padding = '40px';
    } else {
      // For non-base64 images (regular URLs), use a simpler fallback
      imgElement.src = 'assets/placeholder-image.png';

      // If no placeholder image exists, use a generic one
      imgElement.onerror = () => {
        imgElement.src =
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWltYWdlIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';
        imgElement.style.padding = '40px';
      };
    }
  }
}
