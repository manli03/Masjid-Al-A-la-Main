import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';
import { AlertController } from '@ionic/angular';

export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const storageService = inject(StorageService);
  const authService = inject(AuthService);
  const alertController = inject(AlertController);

  // Check if user data exists in storage
  const userData = await storageService.get('user');

  if (!userData) {
    // Redirect to authentication page with return URL
    router.navigate(['/tabs/authentication'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // Get the URL path to determine which page is being accessed
  const urlPath = state.url;

  // For announcement and manage-announcement pages, check if profile is complete
  if (
    urlPath.includes('/tabs/announcement') ||
    urlPath.includes('/tabs/manage-announcement')
  ) {
    const isProfileComplete = await authService.isProfileComplete();

    if (!isProfileComplete) {
      // Show alert about completing profile
      const alert = await alertController.create({
        header: 'Lengkapkan Profil',
        message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
        buttons: [
          {
            text: 'OK',
            handler: () => {
              router.navigate(['/tabs/profile']);
            },
          },
        ],
      });
      await alert.present();
      return false;
    }
  }

  // Allow access to profile page regardless of completion
  // Allow access to other pages if user is logged in and profile check passes
  return true;
};
