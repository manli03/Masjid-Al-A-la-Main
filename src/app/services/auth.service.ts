import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Platform } from '@ionic/angular';
import { StorageService } from './storage.service';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { FcmService } from './fcm.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  // Set to true to display detailed error messages during development
  private devMode = false;
  private adminStatusCache: { isAdmin: boolean; timestamp: number } | null =
    null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
  private profileCompletionCache: boolean | null = null;
  private currentIdToken: string | null = null;

  constructor(
    private platform: Platform,
    private storageService: StorageService,
    private http: HttpClient,
    private toastService: ToastService,
    private fcmService: FcmService,
  ) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    await this.platform.ready();
    try {
      console.log('Initializing Google Auth...');
      await GoogleAuth.initialize();

      // Initialize profile completion status
      const user = await this.storageService.get('user');
      if (user && user.email) {
        try {
          // Try to get auth headers - if no token available, skip the API call
          const idToken = await this.getIdToken();
          if (!idToken) {
            console.log('No ID token available yet during initialization, skipping verify_token call');
            return;
          }
          
          const headers = new HttpHeaders().set('Authorization', `Bearer ${idToken}`);
          // Also send token in body as fallback for Android
          const body = { action: 'verify_token', _token: idToken };
          const response: any = await firstValueFrom(
            this.http.post(`${this.apiUrl}/auth.php`, 
              body,
              { headers, observe: 'body' as 'body' }
            ),
          );

          this.profileCompletionCache =
            response.success &&
            response.user &&
            !!response.user.phone &&
            !!response.user.birthdate &&
            !!user.name;

          console.log(
            'Profile completion status cached:',
            this.profileCompletionCache,
          );
        } catch (error) {
          console.error('Error initializing profile completion status:', error);
          this.profileCompletionCache = null;
        }
      }
    } catch (error) {
      console.error('Error during Google Auth initialization:', error);
    }
  }

  /**
   * Sign in the user using GoogleAuth
   */
  async signIn() {
    try {
      const googleUser = await GoogleAuth.signIn();

      if (googleUser) {
        console.log('User signed in with Google, sending to backend...');

        // Send Google user data to backend for validation and DB storage
        const userData = {
          action: 'signin',
          name: googleUser.name,
          email: googleUser.email,
          imageUrl: googleUser.imageUrl,
          googleIdToken: googleUser.authentication.idToken,
        };

        try {
          // Send data to PHP backend
          const response = await firstValueFrom(
            this.http.post<any>(`${this.apiUrl}/auth.php`, userData),
          );

          if (response.success) {
            console.log('Backend authentication successful');

            // Store user profile (non-sensitive data)
            await this.storageService.set('user', {
              name: googleUser.name,
              email: googleUser.email,
              imageUrl: response.user.profileImage || googleUser.imageUrl, // Use server's profile image or fallback to Google
              phone: response.user.phone,
              birthdate: response.user.birthdate,
              membershipNumber: response.user.membershipNumber,
              // Don't store admin status or profile completion status locally
            });

            // Store authentication tokens (secure storage)
            await this.storageService.setSecure(
              'accessToken',
              googleUser.authentication.accessToken,
            );
            await this.storageService.setSecure(
              'idToken',
              googleUser.authentication.idToken,
            );

            // Set profile completion status
            this.profileCompletionCache =
              response.user &&
              response.user.name &&
              response.user.phone &&
              response.user.birthdate;
            console.log(
              'Profile completion status set:',
              this.profileCompletionCache,
            );

            // Set fcm token
            try {
              await this.fcmService.registerNotifications();
            } catch (error) {
              console.warn(
                'Failed to register the app to receive push notifications:',
                error,
              );
            }

            return googleUser;
          } else {
            console.error('Backend authentication failed', response.error);
            if (this.devMode && response.dev_message) {
              await this.showDevelopmentErrorToast(response);
            }
            return null;
          }
        } catch (error) {
          console.error('Error communicating with backend:', error);
          await this.handleHttpError(error);
          return null;
        }
      } else {
        return null;
      }
    } catch (error: any) {
      // If it's a cancellation error, re-throw it so the UI can handle it appropriately
      if (
        error?.error === 'popup_closed_by_user' ||
        error?.message?.includes('canceled') ||
        error?.message?.includes('closed by user')
      ) {
        throw error;
      }
      this.handleAuthError(error);
      return null;
    }
  }

  /**
   * Get a valid access token (refresh if needed)
   */
  async getAccessToken(): Promise<string | null> {
    let accessToken = await this.storageService.getSecure('accessToken');

    if (!accessToken || this.isTokenExpired(accessToken)) {
      console.log('Access token expired, refreshing...');
      accessToken = await this.refreshToken();
    }

    return accessToken;
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<string | null> {
    try {
      const refreshedUser = await GoogleAuth.refresh(); // Refreshes the Google token

      if (refreshedUser.accessToken) {
        console.log('Token refreshed successfully');

        // Store new access token securely
        await this.storageService.setSecure(
          'accessToken',
          refreshedUser.accessToken,
        );

        return refreshedUser.accessToken;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      await this.signOut(); // Force sign-out if refresh fails
    }
    return null;
  }

  /**
   * Check if the token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1])); // Decode JWT token
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expiry;
    } catch (error) {
      console.warn('Error decoding token:', error);
      return true; // Assume expired if decoding fails
    }
  }

  /**
   * Sign out the user and clear all stored data
   */
  async signOut(): Promise<void> {
    try {
      // Get user email before clearing storage
      const userData = await this.storageService.get('user');
      const userEmail = userData ? userData.email : null;

      // Sign out from Google Auth
      await GoogleAuth.signOut();
      console.log('User signed out from Google successfully.');

      // Clear FCM token on logout if possible (per-device)
      if (userEmail) {
        try {
          const idToken = await this.getIdToken();
          let headers = new HttpHeaders();
          if (idToken) {
            headers = headers.set('Authorization', `Bearer ${idToken}`);
          }
          // Send the current device's FCM token so the backend removes
          // only this device's token, keeping other devices registered.
          const fcmToken = await this.fcmService.getLocalFcmToken();
          await firstValueFrom(
            this.http.post(`${this.apiUrl}/auth.php`, 
              { action: 'logout_clear_token', _token: idToken, fcmToken },
              { headers }
            ),
          );
        } catch (error) {
          console.warn('Error clearing FCM token on logout:', error);
          // Continue logout process even if token clear fails
        }
      }

      // Clear all caches
      this.adminStatusCache = null;
      this.profileCompletionCache = false;

      // Clear all stored data
      await this.storageService.clearAllStorage();

      // Explicitly notify about user change
      this.storageService.notifyUserChanged();
    } catch (error) {
      console.error('Error during sign-out:', error);
    }
  }

  /**
   * Handle sign-in errors
   */
  private handleAuthError(error: any) {
    if (error?.error === 'popup_closed_by_user') {
      console.warn('User cancelled sign-in');
    } else if (error?.error === 'network_error') {
      console.error('Network issue. Please check your connection.');
    } else if (error?.error === 'idpiframe_initialization_failed') {
      console.error(
        'Google Auth initialization failed. Check your configuration.',
      );
    } else {
      console.error('Unexpected error during Google Sign-In:', error);
    }
  }

  /**
   * Handle HTTP errors and show development details if available
   */
  private async handleHttpError(error: any) {
    if (error instanceof HttpErrorResponse) {
      console.error('HTTP error:', error.status, error.message);

      // In production mode, show a generic error message
      if (!this.devMode || !error.error) {
        await this.presentToast(
          'Ralat rangkaian berlaku. Sila cuba lagi.',
          'danger',
        );
        return;
      }

      // In development mode, only show detailed errors to developers
      if (error.error.dev_message) {
        await this.showDevelopmentErrorToast(error.error);
      } else {
        // Don't show HTTP status codes to users
        await this.presentToast('Ralat berlaku. Sila cuba lagi.', 'danger');
      }
    } else {
      // await this.presentToast('Ralat berlaku. Sila cuba lagi.', 'danger');
    }
  }

  /**
   * Show development-only error toast
   */
  private async showDevelopmentErrorToast(errorResponse: any) {
    let message = 'Development Error:';
    if (errorResponse.dev_message) {
      message += `\n${errorResponse.dev_message}`;
    }
    if (errorResponse.error_code) {
      message += `\nCode: ${errorResponse.error_code}`;
    }
    if (errorResponse.sql_state) {
      message += `\nSQL: ${errorResponse.sql_state}`;
    }
    await this.presentToast(message, 'warning');
  }

  /**
   * Show a toast message
   */
  private async presentToast(message: string, color: string = 'danger') {
    await this.toastService.presentToast(message, color);
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData: any): Promise<any> {
    try {
      const user = await this.storageService.get('user');
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      const idToken = await this.getIdToken();
      // Add action and data
      const data = {
        ...profileData,
        action: 'update_profile',
        _token: idToken,
      };

      const headers = await this.getAuthHeaders();
      const response: any = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, data, { headers }),
      );

      if (response.success) {
        // Update stored user data
        await this.storageService.set('user', {
          ...user,
          name: response.user.name,
          phone: response.user.phone,
          birthdate: response.user.birthdate,
          membershipNumber: response.user.membershipNumber,
          // Don't store status properties locally
        });

        // Reset profile completion cache since profile was updated
        this.profileCompletionCache = null;

        return response.user;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      await this.handleHttpError(error);
      throw error;
    }
  }

  /**
   * Check if the user's profile is complete - uses cached value from app initialization
   */
  async isProfileComplete(): Promise<boolean> {
    const user = await this.storageService.get('user');
    if (!user || !user.email) {
      this.profileCompletionCache = false;
      return false;
    }

    // Return cached value if available
    if (typeof this.profileCompletionCache === 'boolean') {
      console.log(
        'Using cached profile completion status:',
        this.profileCompletionCache,
      );
      return this.profileCompletionCache;
    }

    // If cache is null (not yet initialized), check from database
    try {
      const idToken = await this.getIdToken();
      if (!idToken) {
        // No token available - use local data to determine profile completeness
        this.profileCompletionCache = !!(user.phone && user.birthdate && user.name);
        return this.profileCompletionCache;
      }
      
      const headers = new HttpHeaders().set('Authorization', `Bearer ${idToken}`);
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/auth.php`, 
          { action: 'verify_token', _token: idToken },
          { headers, observe: 'body' as 'body' }
        ),
      );

      const isComplete = !!(
        response.success &&
        response.user &&
        response.user.phone &&
        response.user.birthdate &&
        user.name
      );

      this.profileCompletionCache = isComplete;
      return isComplete;
    } catch (error) {
      console.error('Error checking profile completion:', error);
      this.profileCompletionCache = true; // Assume complete if there's a network error
      return true;
    }
  }

  /**
   * Check if user is admin - cached for 30 minutes
   */
  async isAdmin(): Promise<boolean> {
    const user = await this.storageService.get('user');
    if (!user || !user.email) {
      this.adminStatusCache = null;
      return false;
    }

    // Check if we have a valid cache
    if (
      this.adminStatusCache &&
      Date.now() - this.adminStatusCache.timestamp < this.CACHE_DURATION
    ) {
      console.log('Using cached admin status');
      return this.adminStatusCache.isAdmin;
    }

    try {
      const idToken = await this.getIdToken();
      if (!idToken) {
        // No token available - return false for admin (non-critical, can be rechecked after refresh)
        console.log('No ID token available for admin check, returning false');
        return false;
      }
      
      const headers = new HttpHeaders().set('Authorization', `Bearer ${idToken}`);
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/auth.php`, 
          { action: 'verify_token', _token: idToken },
          { headers, observe: 'body' as 'body' }
        ),
      );

      const isAdmin =
        response.success && response.user && response.user.isAdmin === true;

      // Cache the result
      this.adminStatusCache = {
        isAdmin,
        timestamp: Date.now(),
      };

      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.adminStatusCache = null;
      return false;
    }
  }

  /**
   * Promote a user to admin
   */
  async promoteToAdmin(userEmail: string): Promise<any> {
    try {
      const user = await this.storageService.get('user');
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // We need to check admin status from the database before allowing this action
      const isAdminResult = await this.isAdmin();
      if (!isAdminResult) {
        throw new Error('Only admins can promote other users');
      }

      const idToken = await this.getIdToken();
      const data = {
        action: 'promote_admin',
        adminEmail: user.email,
        userEmail: userEmail,
        _token: idToken,
      };

      const headers = await this.getAuthHeaders();
      const response: any = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/auth.php`, data, { headers }),
      );

      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Failed to promote user to admin');
      }
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      await this.handleHttpError(error);
      throw error;
    }
  }

  /**
   * Checks if the user is currently authenticated.
   * This is determined by the presence of user data in storage.
   * @returns A Promise that resolves to true if authenticated, false otherwise.
   */
  async isAuthenticated(): Promise<boolean> {
    const user = await this.storageService.get('user');
    // The user is considered authenticated if the 'user' object is not null.
    return user !== null;
  }

  /**
   * Get the Google ID token for authenticating API requests.
   * This token is sent in the Authorization header as a Bearer token.
   * 
   * @returns The Google ID token string, or null if not available
   */
  async getIdToken(): Promise<string | null> {
    // Try in-memory cache first
    if (this.currentIdToken) {
      return this.currentIdToken;
    }

    // Try secure storage
    const storedToken = await this.storageService.getSecure('idToken');
    if (storedToken) {
      this.currentIdToken = storedToken;
      return storedToken;
    }

    // Try to refresh from Google Auth
    try {
      // For web: silent sign-in may provide a fresh token
      const googleUser = await GoogleAuth.refresh();
      if (googleUser && googleUser.idToken) {
        this.currentIdToken = googleUser.idToken;
        await this.storageService.setSecure('idToken', googleUser.idToken);
        return googleUser.idToken;
      }
    } catch (error) {
      console.warn('Could not refresh Google token:', error);
    }

    return null;
  }

  /**
   * Update the stored ID token (called after sign-in)
   */
  async setIdToken(token: string): Promise<void> {
    this.currentIdToken = token;
    await this.storageService.setSecure('idToken', token);
  }

  /**
   * Create HTTP headers with the Authorization Bearer token
   * for authenticated API requests.
   */
  async getAuthHeaders(): Promise<HttpHeaders> {
    let headers = new HttpHeaders();
    
    const token = await this.getIdToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }
}
