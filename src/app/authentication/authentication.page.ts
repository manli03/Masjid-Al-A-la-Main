import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
// Import ToastController
import { LoadingController, ToastController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';

@Component({
  selector: 'app-authentication',
  templateUrl: './authentication.page.html',
  styleUrls: ['./authentication.page.scss'],
})
export class AuthenticationPage {
  // Removed OnInit as it wasn't used

  isLoading: boolean = false; // Flag for inline loading state

  constructor(
    private router: Router,
    private authService: AuthService,
    private loadingController: LoadingController,
    private storageService: StorageService,
    private toastController: ToastController, // Inject ToastController
  ) {}

  async signInWithGoogle() {
    // Start both loading states
    this.isLoading = true;

    try {
      const user = await this.authService.signIn();
      if (user) {
        this.isLoading = false; // Stop inline loading here

        // Check if there's a pending announcement to view after authentication
        const pendingAnnouncementId = sessionStorage.getItem(
          'pendingAnnouncementId',
        );

        // Navigate based on role AFTER successful sign-in
        if (await this.authService.isAdmin()) {
          if (pendingAnnouncementId) {
            // Clear the pending ID
            sessionStorage.removeItem('pendingAnnouncementId');

            // Navigate to the specific announcement
            this.router.navigate(
              ['/tabs/announcement', pendingAnnouncementId],
              {
                replaceUrl: true,
              },
            );
          } else {
            // Default admin navigation
          this.router.navigate(['/tabs/manage-announcement'], {
            replaceUrl: true,
            });
          }
        } else {
          // Check if the user's profile is complete
          const isProfileComplete = await this.authService.isProfileComplete();

          if (isProfileComplete && pendingAnnouncementId) {
            // If profile is complete and there's a pending announcement, go directly to it
            sessionStorage.removeItem('pendingAnnouncementId');
            this.router.navigate(
              ['/tabs/announcement', pendingAnnouncementId],
              {
                replaceUrl: true,
              },
            );
          } else {
            // Otherwise go to profile page (to complete it if needed)
            this.router.navigate(['/tabs/profile'], { replaceUrl: true });
          }
        }
      } else {
        // Handle case where signIn resolves but returns no user (should ideally not happen with Google Sign-In success)
        console.warn(
          'Sign in process completed but no user object was returned.',
        );
        await this.presentToast('Log masuk tidak berjaya. Sila cuba lagi.');
        this.isLoading = false; // Stop inline loading here if navigation didn't happen
      }
    } catch (error: any) {
      // Handle errors (e.g., user closes popup, network issue)
      console.error('Sign in error:', error);
      let errorMessage = 'Gagal log masuk. Sila cuba lagi.';
      // Optional: Check for specific error types (e.g., closed popup)
      if (
        error?.message?.includes('closed by user') ||
        error?.code === 'auth/popup-closed-by-user'
      ) {
        errorMessage = 'Proses log masuk dibatalkan.';
      }
      await this.presentToast(errorMessage);
      // Ensure loading states are reset on error
      this.isLoading = false;
    }
  }

  // Helper function to show toast messages
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000, // 3 seconds
      position: 'bottom', // Or 'top', 'middle'
      color: 'danger', // Red color for errors
    });
    await toast.present();
  }
}
