import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { StorageService } from '../services/storage.service';
import { environment } from '../../environments/environment';
import {
  ToastController,
  AlertController,
  ModalController,
  Platform,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AnnouncementService } from '../services/announcement.service';
import { AuthService } from '../services/auth.service';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';

// Define interface for the announcement item
interface Announcement {
  id: number;
  title: string;
  author: string;
  authorId?: number;
  content: string;
  imageUrl?: string;
  date: string;
  commentsCount: number;
  likes: number;
  userLiked?: boolean;
  isRead?: boolean;
}

// Define interface for comment
interface Comment {
  id: number;
  user: string;
  userId?: number;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  is_edited?: boolean;
  replies: Reply[];
  isAdmin?: boolean;
}

// Define interface for reply
interface Reply {
  id: number;
  user: string;
  userId?: number;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  is_edited?: boolean;
  isAdmin?: boolean;
}

// Define full announcement with comments
interface AnnouncementDetail extends Announcement {
  comments: Comment[];
}

@Component({
  selector: 'app-announcement',
  templateUrl: 'announcement.page.html',
  styleUrls: ['announcement.page.scss'],
})
export class announcementPage implements OnInit, OnDestroy {
  private apiUrl = environment.apiUrl;
  newsItems: Announcement[] = [];
  displayedNewsItems: Announcement[] = [];
  currentSegment: string = 'all'; // Initialize to 'all'
  isLoading = false;
  selectedArticle: AnnouncementDetail | null = null;
  newComment: string = '';
  newReply: string = '';
  selectedCommentIndex: number | null = null;
  currentUser: any = null;
  isAdmin: boolean = false;
  editingCommentId: number | null = null;
  editCommentText: string = '';
  allRead: boolean = true;
  private userChangeSubscription: Subscription | null = null;
  isCheckingAdmin: boolean = true; // Keep loading state during initial admin check
  isInitialLoad: boolean = true; // Separate flag for initial page load sequence
  private backButtonSubscription: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private storageService: StorageService,
    private toastController: ToastController,
    private alertController: AlertController,
    private announcementService: AnnouncementService,
    private authService: AuthService,
    private modalController: ModalController,
    private platform: Platform,
  ) {}

  async ngOnInit() {
    // Load current user and initialize basic stuff
    await this.loadUserData();

    // Subscribe to user changes
    this.userChangeSubscription = this.storageService
      .getUserChangeObservable()
      .subscribe(async () => {
        console.log('User changed, resetting state and reloading...');
        this.resetPageState();
        await this.loadUserData();
        // If not viewing an article, reload the list for the new user
        if (!this.selectedArticle) {
          // Delay slightly to allow data to propagate if needed, or just reload directly
          await this.loadAnnouncements();
        } else {
          // If viewing an article, just ensure user data is updated
          // The article details might need to be reloaded to update user-specific info like userLiked
          // However, in this specific scenario (user change while viewing article),
          // forcing a reload of the article detail might be disruptive.
          // Let's just update the current user and isAdmin flags for comment/action visibility.
        }
      });
  }

  async ionViewWillEnter() {
    console.log('ionViewWillEnter');
    // Start showing loading indicators
    this.isCheckingAdmin = true; // Assume admin check is starting
    this.isLoading = true; // Assume general loading starts

    try {
      // Check for local storage data first
      const userData = await this.storageService.get('user');
      if (!userData) {
        console.log('No user data found, navigating to authentication.');
        await this.router.navigateByUrl('/tabs/authentication', {
          replaceUrl: true,
        });
        return;
      }

      // Get admin status and profile completion early
      this.isAdmin = await this.authService.isAdmin();
      const isProfileComplete = await this.authService.isProfileComplete();

      if (!isProfileComplete) {
        console.log('Profile not complete, showing alert.');
        const alert = await this.alertController.create({
          header: 'Lengkapkan Profil',
          message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
          buttons: [
            {
              text: 'OK',
              handler: () => {
                this.router.navigateByUrl('/tabs/profile', {
                  replaceUrl: true,
                });
              },
            },
          ],
        });
        await alert.present();
        return; // Stop loading sequence
      }

      // Check for route parameters (id)
      const announcementId = this.route.snapshot.paramMap.get('id');

      // Handle admin cases
      if (this.isAdmin && !announcementId) {
        console.log(
          'Admin user without specific ID, redirecting to manage page.',
        );
        // Admin without specific announcement - redirect to management
        await this.router.navigateByUrl('/tabs/manage-announcement');
        return; // Stop loading sequence
      }

      // --- If we reach here, it's a non-admin OR admin with ID ---

      // Load announcements for the list view (needed for both list and checking if ID exists in list)
      console.log('Loading announcements list...');
      await this.loadAnnouncements(); // This sets newsItems and displayedNewsItems

      // If there's an announcement ID, load its details
      if (announcementId) {
        const announcementIdNum = parseInt(announcementId, 10);
        console.log(`Attempting to load details for ID: ${announcementIdNum}`);

        // Try to find the announcement in the list we just loaded
        const announcementInList = this.newsItems.find(
          (item) => item.id === announcementIdNum,
        );

        if (announcementInList) {
          console.log('Announcement found in list, loading details...');
          await this.loadAnnouncementDetails(announcementInList);
        } else {
          console.log('Announcement not found in list, fetching directly...');
          // If announcement wasn't in the initial list, try to fetch it directly
          try {
            const fullAnnouncement =
              await this.announcementService.getAnnouncementById(
                announcementIdNum,
              );
            if (fullAnnouncement) {
              this.selectedArticle = fullAnnouncement;
              console.log('Announcement details loaded directly.');
              // Mark as read if user is logged in and it wasn't in the list (maybe a new one or missed)
              if (this.currentUser && !fullAnnouncement.isRead) {
                await this.announcementService.markAsRead(announcementIdNum);
                // We don't have this item in newsItems, so we just update the detail view property
                this.selectedArticle!.isRead = true;
                // Note: If the user then goes back to the list, the list might need to be reloaded
                // or this item's status updated in newsItems if it's found there later.
                // For simplicity, loadAnnouncements() in deselectArticle() handles this.
              }
            } else {
              console.warn(
                'Announcement details not found for ID:',
                announcementIdNum,
              );
              this.presentToast('Pengumuman tidak dijumpai.');
              // Navigate back to the list view if the specific ID fails
              await this.router.navigateByUrl('/tabs/announcement', {
                replaceUrl: true,
              });
            }
          } catch (error) {
            console.error(
              'Error loading announcement details directly:',
              error,
            );
            this.presentToast('Ralat memuat pengumuman. Sila cuba lagi.');
            // Navigate back to the list view on error
            await this.router.navigateByUrl('/tabs/announcement', {
              replaceUrl: true,
            });
          }
        }
      } else {
        // No ID in route, ensure selectedArticle is null (should be by default, but good practice)
        this.selectedArticle = null;
        console.log('No announcement ID in route, displaying list view.');
      }

      // --- Loading sequence completed ---
      console.log('Initial load sequence finished.');
      this.isInitialLoad = false; // Initial load is done

      // Back button logic
      // Subscribe here, unsubscribe in ionViewWillLeave
      if (!this.backButtonSubscription) {
        // Prevent multiple subscriptions
        this.backButtonSubscription =
          this.platform.backButton.subscribeWithPriority(10, () => {
            console.log('Hardware back button pressed.');
            if (this.selectedArticle) {
              console.log('Deselecting article on back press.');
              this.deselectArticle();
            } else if (this.isInitialLoad || this.isLoading) {
              console.log('Ignoring back press during loading.');
              // If the page is still loading, do nothing
              return;
            } else {
              console.log('Navigating back to home tab.');
              this.router.navigateByUrl('/tabs/home');
            }
          });
        console.log('Back button subscription created.');
      }
    } catch (error) {
      console.error('Error during ionViewWillEnter initialization:', error);
      this.presentToast('Ralat memuat pengumuman. Sila cuba lagi.');
      // Ensure loading indicators are hidden even on error
    } finally {
      // Hide general loading indicator only when all *async* operations triggered by ionViewWillEnter are conceptually done
      // or when navigating away. Let's handle it carefully.
      // If we are navigating away (to auth, profile, or manage), the loading state will disappear with the component.
      // If we stay on the page (either list or article), hide loading after operations.
      // A slight delay can help if state changes cause flickering.
      setTimeout(() => {
        this.isCheckingAdmin = false; // Admin check is finished
        this.isLoading = false; // General loading related to initial entry is finished
        console.log('Loading indicators hidden.');
      }, 100); // Small delay to prevent flickering
    }
  }

  ionViewWillLeave() {
    console.log('ionViewWillLeave');
    // Unsubscribe to avoid multiple subscriptions when entering the announcement page
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
      console.log('Back button subscription unsubscribed.');
    }
  }

  ngOnDestroy() {
    console.log('ngOnDestroy');
    // Clean up subscription to prevent memory leaks
    if (this.userChangeSubscription) {
      this.userChangeSubscription.unsubscribe();
      this.userChangeSubscription = null;
      console.log('User change subscription unsubscribed.');
    }
    // Back button subscription is handled in ionViewWillLeave
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return ''; // Handle potentially null or empty dates
    try {
      const date = new Date(dateStr);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string provided:', dateStr);
        return 'Tarikh tidak sah';
      }

      const currentYear = new Date().getFullYear();
      const dateYear = date.getFullYear();

      // Format hours and AM/PM
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'ptg' : 'pg';
      hours = hours % 12;
      hours = hours ? hours : 12; // Handle midnight (0 hours)

      // Pad minutes with leading zero if needed
      const minutes = date.getMinutes().toString().padStart(2, '0');

      // Format the date based on whether it's the current year
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
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return 'Ralat Tarikh';
    }
  }

  // Reset page state when user changes or on deselect
  resetPageState() {
    console.log('Resetting page state...');
    this.selectedArticle = null;
    this.newComment = '';
    this.newReply = '';
    this.selectedCommentIndex = null;
    this.editingCommentId = null;
    this.editCommentText = '';
    // Preserve currentSegment when resetting state on user change,
    // but loadAnnouncements will be called anyway.
  }

  // Load user data from storage and verify admin status from backend
  async loadUserData() {
    console.log('Loading user data...');
    try {
      this.currentUser = await this.storageService.get('user');
      // Always verify admin status from the database when user data is loaded/changed
      this.isAdmin = await this.authService.isAdmin();
      console.log('User data loaded. IsAdmin:', this.isAdmin);
    } catch (error) {
      console.error('Error loading user data:', error);
      this.currentUser = null;
      this.isAdmin = false;
      this.presentToast('Gagal memuat data pengguna.');
    }
  }

  async loadAnnouncements() {
    console.log('Loading announcements list...');
    this.isLoading = true;
    try {
      const announcements = await this.announcementService.getAnnouncements();
      this.newsItems = announcements;
      console.log('Announcements list loaded:', this.newsItems.length);
      this.filterAnnouncementsBySegment(); // Apply current filter after loading
    } catch (error) {
      console.error('Error loading announcements:', error);
      this.presentToast('Tidak dapat memuat pengumuman. Sila cuba lagi.');
    } finally {
      this.isLoading = false;
      console.log('Finished loading announcements list.');
    }
  }

  // Function to filter announcements based on selected segment
  filterAnnouncementsBySegment() {
    console.log(`Filtering announcements by segment: ${this.currentSegment}`);
    if (this.currentSegment === 'all') {
      this.displayedNewsItems = [...this.newsItems];
    } else if (this.currentSegment === 'unread') {
      this.displayedNewsItems = this.newsItems.filter((item) => !item.isRead);
    }
    // Update allRead status based on the *full* list
    this.allRead = this.newsItems.every((item) => item.isRead === true);
    console.log('Filtered list count:', this.displayedNewsItems.length);
    console.log('All read status:', this.allRead);
  }

  // Handle segment change
  segmentChanged(event: any) {
    console.log('Segment changed:', event.detail.value);
    this.currentSegment = event.detail.value;
    this.filterAnnouncementsBySegment();
  }

  // Function to select an article and navigate to its detail route
  async selectArticle(item: Announcement) {
    console.log('Selecting article:', item.id);
    // Navigate to the announcement detail route
    // The ionViewWillEnter hook will then pick up the ID and load details
    await this.router.navigate(['/tabs/announcement', item.id]);
  }

  // New method to load announcement details - called by ionViewWillEnter
  private async loadAnnouncementDetails(announcement: Announcement) {
    console.log('Loading announcement details for:', announcement.id);
    this.isLoading = true; // Show loading for details fetch
    try {
      const fullAnnouncement =
        await this.announcementService.getAnnouncementById(announcement.id);
      if (fullAnnouncement) {
        this.selectedArticle = fullAnnouncement;
        console.log('Announcement details loaded.');

        // Mark as read if user is logged in and it's not already read
        // We do this *after* getting full details to ensure it's the correct user context
        if (this.currentUser && !fullAnnouncement.isRead) {
          console.log('Marking announcement as read:', announcement.id);
          await this.announcementService.markAsRead(announcement.id);

          // Update the isRead status in the newsItems list immediately
          const index = this.newsItems.findIndex(
            (a) => a.id === announcement.id,
          );
          if (index !== -1) {
            this.newsItems[index].isRead = true;
            // No need to call filterAnnouncementsBySegment here,
            // as the list is not visible when selectedArticle is true.
            // The list will be filtered when deselectArticle is called.
            console.log('Updated isRead status in newsItems list.');
          } else {
            console.warn(
              'Selected article not found in newsItems list after loading details.',
            );
          }

          // Update the allRead status based on the *full* list
          this.allRead = this.newsItems.every((item) => item.isRead === true);
          console.log('Updated allRead status:', this.allRead);
        }
      } else {
        console.warn('Failed to get announcement details by ID from service.');
        this.presentToast('Gagal memuat detail pengumuman.');
        // Navigate back to the list view if details fail
        await this.router.navigateByUrl('/tabs/announcement', {
          replaceUrl: true,
        });
      }
    } catch (error) {
      console.error('Error loading announcement details:', error);
      this.presentToast('Ralat memuat detail pengumuman.');
      // Navigate back to the list view on error
      await this.router.navigateByUrl('/tabs/announcement', {
        replaceUrl: true,
      });
    } finally {
      this.isLoading = false; // Hide loading after details fetch
      console.log('Finished loading announcement details.');
    }
  }

  // Function for liking/unliking an announcement
  async toggleLike(event: Event) {
    event.stopPropagation(); // Prevent event bubbling

    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menyukai pengumuman');
      return;
    }

    if (!this.selectedArticle) {
      return;
    }

    console.log('Toggling like for article:', this.selectedArticle.id);

    try {
      // Optimistically update UI
      this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
      this.selectedArticle.likes += this.selectedArticle.userLiked ? 1 : -1;
      // Ensure likes don't go below 0
      this.selectedArticle.likes = Math.max(0, this.selectedArticle.likes);

      const response = await this.announcementService.toggleLike(
        this.selectedArticle.id,
      );

      if (response.success) {
        console.log('Like status updated successfully from backend.');
        // Update UI again with backend truth (handles potential race conditions or minor mismatches)
        // This second update might cause a slight flicker if the optimistic update was visible,
        // but it ensures data consistency.
        // However, if the backend only returns the count, we rely on the optimistic update + count correction.
        // Let's just rely on the count correction if the backend returns it.
        this.selectedArticle.likes = response.likesCount;
        // The backend response should ideally tell us the *final* state (liked/unliked)
        // Assuming response includes `userLiked` property:
        // this.selectedArticle.userLiked = response.userLiked; // If backend sends this
      } else {
        console.error('Backend reported failure toggling like:', response);
        // Revert optimistic update on failure
        this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
        this.selectedArticle.likes += this.selectedArticle.userLiked ? 1 : -1; // Revert the change
        this.selectedArticle.likes = Math.max(0, this.selectedArticle.likes); // Ensure reverted count is valid
        this.presentToast('Gagal mengemas kini status suka');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on network error
      this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
      this.selectedArticle.likes += this.selectedArticle.userLiked ? 1 : -1; // Revert the change
      this.selectedArticle.likes = Math.max(0, this.selectedArticle.likes); // Ensure reverted count is valid
      this.presentToast('Ralat mengemas kini status suka. Sila cuba lagi.');
    }
  }

  // Function to deselect an article and return to the news list
  deselectArticle() {
    console.log('Deselecting article.');
    this.selectedArticle = null; // Hide article view

    // Update URL without reloading page (removes the announcement ID)
    // This triggers ionViewWillEnter again, but since there's no ID, it will show the list.
    this.router
      .navigate(['/tabs/announcement'], {
        replaceUrl: true, // Replace the current history entry so back goes to tabs/home
        skipLocationChange: false, // Allow URL change
      })
      .then(() => {
        console.log('Navigation back to list URL complete.');
        // When returning to the list view, ionViewWillEnter will reload
        // the announcements list and filter it based on the preserved
        // `this.currentSegment`. This is the intended behavior.
        // No need to explicitly call loadAnnouncements() or filterAnnouncementsBySegment() here.
        // The ionViewWillEnter lifecycle hook handles this logic correctly.
      });

    // Reset comment input/edit states
    this.newComment = '';
    this.newReply = '';
    this.selectedCommentIndex = null;
    this.editingCommentId = null;
    this.editCommentText = '';
    console.log('Article deselected, comment states reset.');
  }

  // Add a new comment to the article
  async addComment() {
    if (!this.newComment.trim()) {
      this.presentToast('Komen tidak boleh kosong');
      return;
    }
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menambah komen');
      return;
    }
    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih');
      return;
    }

    console.log('Adding new comment...');
    this.isLoading = true; // Show loading indicator
    const commentText = this.newComment.trim(); // Use trimmed text

    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        commentText,
        // parentCommentId is undefined for top-level comments
      );

      if (response.success && response.comment) {
        console.log('Comment added successfully:', response.comment);
        // Add the new comment to our list
        // NOTE: Backend MUST include isAdmin for the author in response.comment
        this.selectedArticle.comments.push(response.comment);
        this.selectedArticle.commentsCount++; // Increment count
        this.newComment = ''; // Clear input field
        this.presentToast('Komen berjaya ditambah', 'success');
      } else {
        console.error('Failed to add comment:', response);
        this.presentToast(response.error || 'Gagal menambah komen');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      this.presentToast('Ralat menambah komen. Sila cuba lagi.');
    } finally {
      this.isLoading = false; // Hide loading indicator
      console.log('Finished adding comment.');
    }
  }

  // Start editing a comment or reply
  editComment(comment: Comment | Reply) {
    console.log('Editing comment/reply ID:', comment.id);
    // Add checks for currentUser and ownership/admin status
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk mengedit komen');
      return;
    }
    if (this.currentUser.email !== comment.email && !this.isAdmin) {
      this.presentToast(
        'Anda tidak mempunyai kebenaran untuk mengedit komen ini',
      );
      return;
    }

    this.editingCommentId = comment.id;
    this.editCommentText = comment.text;
    console.log(
      `Editing comment ID ${comment.id}. Initial text: "${this.editCommentText}"`,
    );
  }

  // Cancel editing a comment or reply
  cancelEditComment() {
    console.log('Cancelling edit for comment/reply ID:', this.editingCommentId);
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  // Save edited comment or reply
  async saveEditedComment(comment: Comment | Reply) {
    if (!this.editCommentText.trim()) {
      this.presentToast('Komen tidak boleh kosong');
      return;
    }
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menyimpan komen');
      return;
    }
    if (this.currentUser.email !== comment.email && !this.isAdmin) {
      this.presentToast(
        'Anda tidak mempunyai kebenaran untuk menyimpan komen ini',
      );
      this.cancelEditComment(); // Cancel edit if somehow accessed
      return;
    }

    console.log('Saving edited comment/reply ID:', comment.id);
    this.isLoading = true; // Show loading
    const updatedText = this.editCommentText.trim();

    try {
      const response = await this.announcementService.updateComment(
        comment.id,
        updatedText,
      );

      if (response.success) {
        console.log('Comment updated successfully from backend.');
        // Update the comment text and edited status in the UI
        // No need to search through comments/replies, just update the object directly
        // since the parameter 'comment' is a reference to the object in the array.
        comment.text = updatedText;
        // Assuming the backend response indicates if it was marked edited (optional)
        // If backend returns 'edited' flag: comment.is_edited = response.edited;
        // If backend doesn't return it, we can just set it true if the new text is different
        if (comment.text !== updatedText) {
          // Check if text actually changed
          comment.is_edited = true; // Mark as edited in UI
        } else if (response.edited !== undefined) {
          comment.is_edited = response.edited; // Use backend flag if available
        }

        this.presentToast('Komen berjaya dikemaskini', 'success');
      } else {
        console.error('Failed to update comment:', response);
        this.presentToast(response.error || 'Gagal mengemaskini komen');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      this.presentToast('Ralat mengemaskini komen. Sila cuba lagi.');
    } finally {
      // Always reset editing state regardless of success/failure
      this.editingCommentId = null;
      this.editCommentText = '';
      this.isLoading = false; // Hide loading
      console.log('Finished saving edited comment.');
    }
  }

  // Delete a comment or reply
  async deleteComment(commentId: number) {
    console.log('Attempting to delete comment/reply ID:', commentId);
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk memadamkan komen');
      return;
    }

    // Find the comment/reply object to check ownership/admin status BEFORE confirming
    let commentToDelete: Comment | Reply | undefined = undefined;
    if (this.selectedArticle) {
      // Check top-level comments
      commentToDelete = this.selectedArticle.comments.find(
        (c) => c.id === commentId,
      );
      // If not found, check replies
      if (!commentToDelete) {
        for (const comment of this.selectedArticle.comments) {
          commentToDelete = comment.replies.find((r) => r.id === commentId);
          if (commentToDelete) break;
        }
      }
    }

    if (!commentToDelete) {
      console.warn('Comment/Reply not found for ID:', commentId);
      this.presentToast('Komen/balasan tidak dijumpai.');
      return;
    }

    if (this.currentUser.email !== commentToDelete.email && !this.isAdmin) {
      this.presentToast(
        'Anda tidak mempunyai kebenaran untuk memadam komen ini',
      );
      return;
    }

    // Confirm delete
    const alert = await this.alertController.create({
      header: 'Sahkan Padam',
      message: 'Adakah anda pasti mahu memadamkan komen ini?',
      buttons: [
        {
          text: 'Batal',
          role: 'cancel',
        },
        {
          text: 'Padam',
          handler: async () => {
            console.log('User confirmed delete for ID:', commentId);
            this.isLoading = true; // Show loading while deleting
            try {
              const response =
                await this.announcementService.deleteComment(commentId);
              if (response.success) {
                console.log('Comment deleted successfully from backend.');
                // Remove the comment/reply from the UI
                if (this.selectedArticle) {
                  // Check if it was a top-level comment
                  const commentIndex = this.selectedArticle.comments.findIndex(
                    (c) => c.id === commentId,
                  );
                  if (commentIndex >= 0) {
                    this.selectedArticle.comments.splice(commentIndex, 1);
                    console.log(
                      `Removed top-level comment index ${commentIndex}.`,
                    );
                  } else {
                    // It must be a reply, check in all comments' replies
                    for (const comment of this.selectedArticle.comments) {
                      const replyIndex = comment.replies.findIndex(
                        (r) => r.id === commentId,
                      );
                      if (replyIndex >= 0) {
                        comment.replies.splice(replyIndex, 1);
                        console.log(
                          `Removed reply index ${replyIndex} from comment ${comment.id}.`,
                        );
                        break; // Reply found and removed, exit loop
                      }
                    }
                  }
                  // Decrement comment count if selectedArticle is not null
                  // Check if commentsCount exists before decrementing
                  if (
                    this.selectedArticle &&
                    typeof this.selectedArticle.commentsCount === 'number'
                  ) {
                    this.selectedArticle.commentsCount = Math.max(
                      0,
                      this.selectedArticle.commentsCount - 1,
                    );
                    console.log(
                      'Decremented comment count. New count:',
                      this.selectedArticle.commentsCount,
                    );
                  }

                  this.presentToast('Komen berjaya dipadam', 'success');
                }
              } else {
                console.error('Failed to delete comment:', response);
                this.presentToast(response.error || 'Gagal memadam komen');
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
              this.presentToast('Ralat memadam komen. Sila cuba lagi.');
            } finally {
              this.isLoading = false; // Hide loading
              console.log('Finished deleting comment.');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  // Add a reply to a specific comment
  async addReply(commentIndex: number) {
    if (!this.newReply.trim()) {
      this.presentToast('Balasan tidak boleh kosong');
      return;
    }
    if (!this.currentUser) {
      this.presentToast('Sila log masuk untuk menambah balasan');
      return;
    }
    if (
      !this.selectedArticle ||
      commentIndex < 0 ||
      commentIndex >= this.selectedArticle.comments.length
    ) {
      this.presentToast('Ralat: Tidak dapat mencari komen induk');
      return;
    }

    console.log('Adding new reply for comment index:', commentIndex);

    this.isLoading = true; // Show loading
    const replyText = this.newReply.trim(); // Use trimmed text
    const parentCommentId = this.selectedArticle.comments[commentIndex].id;

    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        replyText,
        parentCommentId, // Pass parent ID
      );

      if (response.success && response.comment) {
        console.log('Reply added successfully:', response.comment);
        // Add the new reply to the correct comment object's replies array
        // NOTE: Backend MUST include isAdmin for the author in response.comment
        if (!this.selectedArticle.comments[commentIndex].replies) {
          this.selectedArticle.comments[commentIndex].replies = [];
        }
        this.selectedArticle.comments[commentIndex].replies.push(
          response.comment,
        );
        this.selectedArticle.commentsCount++; // Increment total count
        this.newReply = ''; // Clear input field
        this.selectedCommentIndex = null; // Hide reply input
        this.presentToast('Balasan berjaya ditambah', 'success');
      } else {
        console.error('Failed to add reply:', response);
        this.presentToast(response.error || 'Gagal menambah balasan');
      }
    } catch (error) {
      console.error('Error adding reply:', error);
      this.presentToast('Ralat menambah balasan. Sila cuba lagi.');
    } finally {
      this.isLoading = false; // Hide loading
      console.log('Finished adding reply.');
    }
  }

  // Show reply input field for a comment
  showReplyInput(commentIndex: number) {
    console.log('Showing reply input for comment index:', commentIndex);
    // Toggle if already selected, otherwise set
    if (this.selectedCommentIndex === commentIndex) {
      this.selectedCommentIndex = null;
      this.newReply = ''; // Clear input when hiding
    } else {
      this.selectedCommentIndex = commentIndex;
      this.newReply = ''; // Ensure input is empty when showing
    }
  }

  // Helper method to show toast notifications
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
    console.log('Handling refresh...');
    // Reload announcements
    try {
      await this.loadAnnouncements();
      console.log('Announcements reloaded after refresh.');
    } catch (error) {
      console.error('Error during refresh:', error);
      // Toast message already handled by loadAnnouncements
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
      console.log('Refresh complete event fired.');
    }
  }

  /**
   * Handles image loading errors by showing a placeholder
   */
  handleImageError(event: Event, item: any) {
    const imgElement = event.target as HTMLImageElement;
    console.warn(
      'Image failed to load for item:',
      item.id,
      'src:',
      imgElement.src,
    );

    // Prevent infinite loops if the fallback itself fails
    if (imgElement.classList.contains('fallback-image')) {
      console.error('Fallback image also failed to load.');
      return;
    }

    // Add a class to indicate this is a fallback
    imgElement.classList.add('fallback-image');

    // Use a data URI for a simple placeholder icon to avoid extra requests
    // This Feather icon represents an image outline
    const placeholderSvgDataUri =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWltYWdlIj48cmVjdCB4PSIzIiB5PSAzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';

    imgElement.src = placeholderSvgDataUri;
    imgElement.style.objectFit = 'contain'; // Ensure the small icon is centered
    imgElement.style.padding = '20%'; // Add padding to center the icon visually
    imgElement.style.width = '100%'; // Maintain element size
    imgElement.style.height = '100%'; // Maintain element size
    imgElement.alt = 'Image Placeholder'; // Update alt text
    console.log('Replaced image with placeholder SVG.');
  }

  /**
   * Handles user avatar image loading errors
   */
  handleUserImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    console.warn('User image failed to load:', imgElement.src);

    // Prevent infinite loops
    if (imgElement.classList.contains('fallback-avatar')) {
      console.error('Fallback avatar also failed to load.');
      return;
    }
    imgElement.classList.add('fallback-avatar');

    imgElement.style.display = 'none'; // Hide the broken img tag

    // Find the parent container and add the ion-icon placeholder
    const parent = imgElement.parentElement; // This should be .avatar-container
    if (parent && !parent.querySelector('.avatar-icon')) {
      // Check if icon already exists
      const icon = document.createElement('ion-icon');
      icon.setAttribute('name', 'person-circle');
      icon.classList.add('avatar-icon'); // Use the SCSS class for styling
      // Optional: Add styles directly if SCSS doesn't fully cover dynamic addition
      // icon.style.fontSize = '40px';
      // icon.style.color = '#888'; // Match placeholder color
      // icon.style.position = 'absolute';
      // icon.style.top = '50%';
      // icon.style.left = '50%';
      // icon.style.transform = 'translate(-50%, -50%)';
      // icon.style.margin = '0';

      parent.appendChild(icon);
      console.log('Replaced user image with avatar icon.');
    } else if (parent) {
      console.log('Avatar icon placeholder already exists.');
    } else {
      console.error('Could not find parent element for user image.');
    }
  }

  // Generic error handler for API errors (already exists, keeping it as is)
  // handleApiError(error: any, defaultMessage: string): string { ... }

  /**
   * Share announcement with others
   */
  async shareAnnouncement(event: Event) {
    event.stopPropagation();

    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih untuk dikongsi');
      return;
    }

    console.log('Attempting to share announcement:', this.selectedArticle.id);

    try {
      // Construct the share URL using your web app domain
      const shareUrl = `https://masjidala.web.app/announcement/${this.selectedArticle.id}`;

      // Format title for sharing (optional, but can look nicer)
      const title = this.selectedArticle.title;
      // .split(' ')
      // .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      // .join(' ');

      // Compose the full announcement content (can be lengthy, consider summarizing if needed)
      const content = this.selectedArticle.content;
      let shareText = `*${title}*\n\n${content}`;
      // Add a call to action and the link
      shareText += `\n\nBaca pengumuman penuh di aplikasi Masjid Al-A'la:`;

      const shareOptions: any = {
        title: "Pengumuman Masjid Al-A'la", // Appears in share dialog header
        text: shareText, // The main content to share
        dialogTitle: 'Kongsi Pengumuman', // Optional title for the system share dialog
        // Url and files properties are often mutually exclusive or platform dependent
        // We prioritize files if image is base64, otherwise include URL
      };

      if (this.selectedArticle.imageUrl) {
        // If imageUrl is base64, save it to cache and share as a file
        if (this.selectedArticle.imageUrl.startsWith('data:image/')) {
          try {
            console.log('Sharing base64 image...');
            // Generate a unique filename
            const fileName = `announcement_${this.selectedArticle.id}_${Date.now()}.png`;
            // Remove the prefix from base64 string (e.g., "data:image/png;base64,")
            const base64Data = this.selectedArticle.imageUrl.split(',')[1];
            // Write the file to cache
            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache,
              recursive: true, // Ensure directory exists
            });
            console.log('Base64 image saved to cache:', savedFile.uri);
            // Share using the files property
            shareOptions.files = [savedFile.uri];
            shareOptions.url = shareUrl; // Include URL as well, might work on some platforms with file
          } catch (err) {
            console.error('Gagal menyimpan imej untuk dikongsi:', err);
            this.presentToast('Gagal menyimpan imej untuk dikongsi.');
            // Continue sharing without the image file if saving fails
            shareOptions.url = shareUrl; // Ensure URL is added if file failed
            delete shareOptions.files; // Remove files property if it failed
          }
        } else {
          console.log('Sharing remote image URL...');
          // For remote URLs, include the URL property. Capacitor might handle it,
          // but behavior varies across platforms (might show a preview, or just the URL).
          shareOptions.url = this.selectedArticle.imageUrl;
          // Also include the announcement URL in the text for reliability
          shareOptions.text = `${shareText}\n\n${shareUrl}`;
        }
      } else {
        // No image, just share text and URL
        shareOptions.url = shareUrl;
        shareOptions.text = `${shareText}\n\n${shareUrl}`;
      }

      await Share.share(shareOptions);
      console.log('Share dialog opened successfully.');
    } catch (error: any) {
      // Check if the error was just the user canceling the share
      if (error.message !== 'Share canceled') {
        console.error('Error sharing announcement:', error);
        this.presentToast(
          'Ralat berkongsi pengumuman. Sila cuba lagi.',
          'danger',
        );
      } else {
        console.log('Share action was canceled by the user.');
      }
    }
  }

  // Add this new method to open the image viewer (already exists, keeping as is)
  async openImageViewer(imageUrl: string) {
    if (!imageUrl) return;
    console.log('Opening image viewer for URL:', imageUrl);

    const modal = await this.modalController.create({
      component: ImageViewerModalComponent,
      componentProps: {
        imageUrl: imageUrl,
      },
      cssClass: 'fullscreen-modal',
    });

    await modal.present();
    console.log('Image viewer modal presented.');
  }
}
