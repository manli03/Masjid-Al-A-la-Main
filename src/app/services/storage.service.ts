import { Injectable } from '@angular/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';
import { Subject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  // Subject to notify subscribers about user changes (login/logout)
  private userChangeSubject = new Subject<void>();

  constructor() {}

  // Get an observable that emits when user data changes
  getUserChangeObservable(): Observable<void> {
    return this.userChangeSubject.asObservable();
  }

  // Notify subscribers that user data has changed
  notifyUserChanged(): void {
    this.userChangeSubject.next();
  }

  // Secure storage for tokens
  async setSecure(key: string, value: any) {
    try {
      await SecureStoragePlugin.set({
        key: key,
        value: JSON.stringify(value), // Convert to string
      });
      console.log('Secure Storage set:', key);

      // Notify subscribers if user token changes
      if (key === 'auth_token') {
        this.notifyUserChanged();
      }
    } catch (error) {
      console.error('Error setting secure storage:', error);
    }
  }

  async getSecure(key: string) {
    try {
      const result = await SecureStoragePlugin.get({ key: key });
      return result.value ? JSON.parse(result.value) : null;
    } catch (error) {
      console.warn('Secure storage key not found:', key);
      return null;
    }
  }

  async removeSecure(key: string) {
    try {
      await SecureStoragePlugin.remove({ key: key });

      // Notify subscribers if user token is removed
      if (key === 'auth_token') {
        this.notifyUserChanged();
      }
    } catch (error) {
      console.error('Error removing secure storage:', error);
    }
  }

  // Regular storage for non-sensitive user data
  async set(key: string, value: any) {
    try {
      await Preferences.set({
        key,
        value: JSON.stringify(value),
      });
      console.log('Preferences Storage set:', key);

      // Notify subscribers if user data changes
      if (key === 'user') {
        this.notifyUserChanged();
      }
    } catch (error) {
      console.error('Error setting preferences storage:', error);
    }
  }

  async get(key: string) {
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Preferences storage key not found:', key);
      return null;
    }
  }

  async remove(key: string) {
    try {
      await Preferences.remove({ key });

      // Notify subscribers if user data is removed
      if (key === 'user') {
        this.notifyUserChanged();
      }
    } catch (error) {
      console.error('Error removing preferences storage:', error);
    }
  }

  // Clear all storage data (both secure and preferences)
  async clearAllStorage() {
    try {
      // Clear Preferences storage
      await Preferences.clear();

      // Clear Secure Storage - remove known keys
      // await this.removeSecure('auth_token');

      // Clear in-memory data
      if (Capacitor.isNativePlatform()) {
        try {
          await SecureStoragePlugin.clear();
        } catch (e) {
          console.warn('Could not clear all secure storage:', e);
        }
      }

      // Notify about user change
      this.notifyUserChanged();

      console.log('All storage cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing all storage:', error);
      return false;
    }
  }
}
