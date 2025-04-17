import { Component, OnInit, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { AuthService } from '../services/auth.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-announcement-loading',
  templateUrl: './announcement-loading.page.html',
  styleUrls: ['./announcement-loading.page.scss'],
})
export class AnnouncementLoadingPage implements OnInit {
  private navigationInProgress = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private authService: AuthService,
    private alertController: AlertController,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    if (!this.navigationInProgress) {
      this.checkAndRedirect();
    }
  }

  async checkAndRedirect() {
    try {
      // Set navigation flag to prevent double redirects
      this.navigationInProgress = true;

      // Get params - first check route params (for deep links), then fall back to query params
      const announcementIdParam = this.route.snapshot.paramMap.get('id');
      const announcementIdQuery = this.route.snapshot.queryParamMap.get('id');
      const announcementId = announcementIdParam || announcementIdQuery;

      console.log('Announcement loading with ID:', announcementId);

      // Check if user data exists in storage
      const userData = await this.storageService.get('user');
      if (!userData) {
        // Save the announcement ID in session storage to restore after login
        if (announcementId) {
          sessionStorage.setItem('pendingAnnouncementId', announcementId);
        }
        this.navigateTo('/tabs/authentication');
        return;
      }

      // Run checks in parallel for efficiency
      const [isProfileComplete, isAdmin] = await Promise.all([
        this.authService.isProfileComplete(),
        this.authService.isAdmin(),
      ]);

      // Handle profile completion check
      if (!isProfileComplete) {
        // Save the announcement ID in session storage to restore after profile completion
        if (announcementId) {
          sessionStorage.setItem('pendingAnnouncementId', announcementId);
        }

        const alert = await this.alertController.create({
          header: 'Lengkapkan Profil',
          message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
          buttons: [
            {
              text: 'OK',
              handler: () => {
                this.navigateTo('/tabs/profile');
              },
            },
          ],
        });
        await alert.present();
        return;
      }

      // Add a small delay for smoother transition
      await this.delay(300);

      // Handle admin redirection
      if (isAdmin) {
        if (announcementId) {
          // Admin viewing specific announcement - go directly to the announcement view
          this.navigateTo(`/tabs/announcement/${announcementId}`);
        } else {
          // Admin without specific announcement - go to management
          this.navigateTo('/tabs/manage-announcement');
        }
        return;
      }

      // Regular user with profile complete - navigate to announcement page
      if (announcementId) {
        // Use the proper path format for viewing a specific announcement
        this.navigateTo(`/tabs/announcement/${announcementId}`);
      } else {
        this.navigateTo('/tabs/announcement');
      }
    } catch (error) {
      console.error('Error in announcement loading page:', error);
      this.navigateTo('/tabs/home');
    }
  }

  // Helper method to navigate and reset navigation flag
  private navigateTo(path: string) {
    this.ngZone.run(() => {
      this.router.navigateByUrl(path, { replaceUrl: true }).then(() => {
        // Reset flag after navigation
        setTimeout(() => {
          this.navigationInProgress = false;
        }, 500);
      });
    });
  }

  // Helper method to add a controlled delay
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
