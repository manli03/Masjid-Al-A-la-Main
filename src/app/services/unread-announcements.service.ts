import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AnnouncementService } from './announcement.service';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UnreadAnnouncementsService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$: Observable<number> = this.unreadCountSubject.asObservable();

  private currentUser: any = null;
  private isInitialized = false;

  constructor(
    private announcementService: AnnouncementService,
    private storageService: StorageService,
    private authService: AuthService,
  ) {
    this.initializeService();
  }

  private async initializeService() {
    // Listen for user changes
    this.storageService.getUserChangeObservable().subscribe(async () => {
      await this.refreshUnreadCount();
    });

    // Initial load
    await this.refreshUnreadCount();
    this.isInitialized = true;
  }

  /**
   * Refresh the unread announcements count
   */
  async refreshUnreadCount(): Promise<void> {
    try {
      this.currentUser = await this.storageService.get('user');

      // Only fetch count if user is logged in
      if (!this.currentUser?.email) {
        this.unreadCountSubject.next(0);
        return;
      }

      // Get all announcements to count unread ones
      const result = await this.announcementService.getAnnouncements(1, 1000); // Large limit to get all

      if (result.announcements) {
        const unreadCount = result.announcements.filter((announcement: any) => !announcement.isRead).length;
        this.unreadCountSubject.next(unreadCount);
      } else {
        this.unreadCountSubject.next(0);
      }
    } catch (error) {
      console.error('Error refreshing unread count:', error);
      this.unreadCountSubject.next(0);
    }
  }

  /**
   * Get current unread count
   */
  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Decrement unread count (when an announcement is marked as read)
   */
  decrementUnreadCount(): void {
    const currentCount = this.unreadCountSubject.value;
    if (currentCount > 0) {
      this.unreadCountSubject.next(currentCount - 1);
    }
  }

  /**
   * Manually set unread count
   */
  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(Math.max(0, count));
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}
