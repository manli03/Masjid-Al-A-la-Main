/**
 * announcement.page.ts
 *
 * This component manages the display of announcements, handling both a list view
 * and a detailed article view. It includes features for user interaction such as
 * comments, replies, likes, and sharing. The comment system uses a flat-reply
 * structure with relative date formatting for a modern user experience.
 */

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  ToastController,
  AlertController,
  ModalController,
  Platform,
  PopoverController,
  IonTextarea,
} from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Share } from '@capacitor/share';

// Services
import { StorageService } from '../services/storage.service';
import { AnnouncementService } from '../services/announcement.service';
import { AuthService } from '../services/auth.service';

// Custom Components
import { ImageViewerModalComponent } from '../component/image-viewer-modal/image-viewer-modal.component';
import { CommentOptionsPopoverComponent } from '../component/comment-options-popover/comment-options-popover.component';
import { Directory, Filesystem } from '@capacitor/filesystem';

// --- Interfaces for Data Structuring ---

interface Announcement {
  id: number;
  title: string;
  author: string;
  content: string;
  imageUrls?: string[];
  date: string;
  commentsCount: number;
  likes: number;
  userLiked?: boolean;
  isRead?: boolean;
}

interface Comment {
  id: number;
  user: string;
  email: string;
  text: string;
  imageUrl?: string;
  created_at?: string;
  parent_comment_id: number | null;
  is_edited?: boolean;
  isAdmin?: boolean;
  replies: Comment[];
}

interface AnnouncementDetail extends Announcement {
  comments: Comment[];
}

@Component({
  selector: 'app-announcement',
  templateUrl: 'announcement.page.html',
  styleUrls: ['announcement.page.scss'],
})
export class announcementPage implements OnInit, OnDestroy {
  // --- Component Properties ---

  // DOM Element Reference for auto-focus
  @ViewChild('replyTextarea', { static: false }) replyTextarea:
    | IonTextarea
    | undefined;

  // State & Data
  newsItems: Announcement[] = [];
  displayedNewsItems: Announcement[] = [];
  selectedArticle: AnnouncementDetail | null = null;
  currentUser: any = null;

  // UI Control
  isLoading = false;
  isInitialLoad = true;
  isCheckingAdmin = true;
  currentSegment: string = 'all';
  isAdmin = false;
  allRead = true;

  // Form Models
  newComment: string = '';
  newReply: string = '';
  editCommentText: string = '';

  // Interaction State
  replyingToCommentId: number | null = null;
  editingCommentId: number | null = null;

  // Image Gallery
  imagesForGrid: string[] = [];
  remainingImageCount = 0;

  // Subscriptions
  private userChangeSubscription: Subscription | null = null;
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
    private popoverController: PopoverController,
  ) {}

  // --- 1. Lifecycle Hooks ---

  /**
   * Initializes the component on first load.
   */
  async ngOnInit() {
    await this.loadUserData();
    this.userChangeSubscription = this.storageService
      .getUserChangeObservable()
      .subscribe(async () => {
        this.resetPageState();
        await this.loadUserData();
        if (!this.selectedArticle) {
          await this.loadAnnouncements();
        }
      });
  }

  /**
   * Runs when the page is about to enter and become the active page.
   * Handles main loading logic, routing, and data fetching.
   */
  async ionViewWillEnter() {
    this.isCheckingAdmin = true;
    this.isLoading = true;
    try {
      if (
        !(await this.authService.isAuthenticated()) ||
        !(await this.authService.isProfileComplete())
      ) {
        this.handleAuthenticationRedirect();
        return;
      }

      this.isAdmin = await this.authService.isAdmin();
      const announcementId = this.route.snapshot.paramMap.get('id');

      if (this.isAdmin && !announcementId) {
        this.router.navigateByUrl('/tabs/manage-announcement', {
          replaceUrl: true,
        });
        return;
      }

      await this.loadAnnouncements();
      if (announcementId) {
        await this.loadAnnouncementDetailsById(parseInt(announcementId, 10));
      }
    } catch (error) {
      this.presentToast('Gagal memuatkan halaman. Sila cuba lagi.');
    } finally {
      this.isInitialLoad = false;
      this.isCheckingAdmin = false;
      this.isLoading = false;
      this.setupBackButtonHandler();
    }
  }

  /**
   * Runs when the page is about to leave. Cleans up the back button subscription.
   */
  ionViewWillLeave() {
    if (this.backButtonSubscription) {
      this.backButtonSubscription.unsubscribe();
      this.backButtonSubscription = null;
    }
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    if (this.userChangeSubscription) {
      this.userChangeSubscription.unsubscribe();
    }
  }

  // --- 2. Data Loading & Page Setup ---

  /**
   * Loads user data from storage.
   */
  async loadUserData() {
    this.currentUser = await this.storageService.get('user');
  }

  /**
   * Fetches the list of all announcements from the service.
   */
  async loadAnnouncements() {
    try {
      this.newsItems = await this.announcementService.getAnnouncements();
      this.filterAnnouncementsBySegment();
    } catch (error) {
      this.presentToast('Gagal memuat senarai pengumuman.');
    }
  }

  /**
   * Loads the full details of a specific announcement by its ID.
   */
  async loadAnnouncementDetailsById(announcementId: number) {
    try {
      const fullAnnouncement =
        await this.announcementService.getAnnouncementById(announcementId);
      if (fullAnnouncement) {
        this.selectedArticle = fullAnnouncement;
        this.prepareImageGrid();
        if (!fullAnnouncement.isRead) {
          this.announcementService.markAsRead(announcementId).catch();
        }
      } else {
        this.presentToast('Pengumuman tidak dijumpai.');
        this.router.navigateByUrl('/tabs/announcement', { replaceUrl: true });
      }
    } catch (error) {
      this.presentToast('Gagal memuat detail pengumuman.');
    }
  }

  /**
   * Resets the component's state, typically used when deselecting an article.
   */
  resetPageState() {
    this.selectedArticle = null;
    this.newComment = '';
    this.newReply = '';
    this.replyingToCommentId = null;
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  // --- 3. UI Interaction & View Logic ---

  /**
   * Navigates to the detail view for a selected article.
   */
  selectArticle(item: Announcement) {
    this.router.navigate(['/tabs/announcement', item.id]);
  }

  /**
   * Deselects the current article, returning to the list view.
   */
  deselectArticle() {
    this.router.navigateByUrl('/tabs/announcement', { replaceUrl: true });
    this.resetPageState();
  }

  /**
   * Handles the segment change event (All/Unread).
   */
  segmentChanged(event: any) {
    this.currentSegment = event.detail.value;
    this.filterAnnouncementsBySegment();
  }

  /**
   * Filters the announcement list based on the current segment.
   */
  filterAnnouncementsBySegment() {
    if (this.currentSegment === 'all') {
      this.displayedNewsItems = [...this.newsItems];
    } else {
      this.displayedNewsItems = this.newsItems.filter((item) => !item.isRead);
    }
    this.allRead = !this.newsItems.some((item) => !item.isRead);
  }

  /**
   * Prepares the image grid for the detail view, showing up to 4 images.
   */
  prepareImageGrid() {
    if (this.selectedArticle?.imageUrls?.length) {
      this.imagesForGrid = this.selectedArticle.imageUrls.slice(0, 4);
      this.remainingImageCount =
        this.selectedArticle.imageUrls.length - this.imagesForGrid.length;
    }
  }

  /**
   * Opens the image viewer modal.
   */
  async openImageViewer(startIndex: number) {
    if (!this.selectedArticle?.imageUrls?.length) return;
    const modal = await this.modalController.create({
      component: ImageViewerModalComponent,
      componentProps: {
        imageUrls: this.selectedArticle.imageUrls,
        initialIndex: startIndex,
      },
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }

  // --- 4. Date Formatting Helpers ---

  /**
   * Formats the date for the main announcement (absolute format).
   */
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
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
      return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${this._formatTime(date)}`;
    } catch {
      return '';
    }
  }

  /**
   * Formats the date for comments with user-friendly relative time rules.
   */
  formatCommentDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const commentDate = new Date(dateStr);
      const now = new Date();
      const diffInSeconds = Math.round(
        (now.getTime() - commentDate.getTime()) / 1000,
      );

      if (diffInSeconds < 60) return 'sebentar tadi';
      if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)} minit yang lalu`;
      if (diffInSeconds < 21600)
        return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;

      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );
      const sevenDaysAgo = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 7,
      );

      if (commentDate >= todayStart)
        return `Hari ini, ${this._formatTime(commentDate)}`;
      if (commentDate >= yesterdayStart)
        return `Semalam, ${this._formatTime(commentDate)}`;
      if (commentDate >= sevenDaysAgo) {
        const dayNames = [
          'Ahad',
          'Isnin',
          'Selasa',
          'Rabu',
          'Khamis',
          'Jumaat',
          'Sabtu',
        ];
        return `${dayNames[commentDate.getDay()]}, ${this._formatTime(commentDate)}`;
      }

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
      if (commentDate.getFullYear() === now.getFullYear()) {
        return `${commentDate.getDate()} ${monthNames[commentDate.getMonth()]}`;
      }

      return `${commentDate.getDate()} ${monthNames[commentDate.getMonth()]} ${commentDate.getFullYear()}`;
    } catch {
      return '';
    }
  }

  /**
   * Private helper to format time in "H:MM am/pm" format.
   */
  private _formatTime(date: Date): string {
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'ptg' : 'pg';
    hours = hours % 12 || 12; // Converts 0 to 12
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
  }

  // --- 5. Comment & Reply Logic ---

  /**
   * Adds a new top-level comment.
   */
  async addComment() {
    if (!this.newComment.trim() || !this.selectedArticle) return;
    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newComment.trim(),
      );
      if (response.success && response.comment) {
        this.selectedArticle.comments.push(response.comment);
        this.selectedArticle.commentsCount++;
        this.newComment = '';
        this.presentToast('Komen berjaya ditambah', 'success');
      }
    } catch {
      this.presentToast('Gagal menambah komen.');
    }
  }

  /**
   * Adds a reply to a comment or another reply.
   */
  async addReply(parentCommentId: number) {
    if (!this.newReply.trim() || !this.selectedArticle) return;
    try {
      const response = await this.announcementService.addComment(
        this.selectedArticle.id,
        this.newReply.trim(),
        parentCommentId,
      );
      if (response.success && response.comment) {
        const parentInfo = this.findCommentAndParent(parentCommentId);
        if (parentInfo) {
          parentInfo.topLevelParent.replies.push(response.comment);
          this.selectedArticle.commentsCount++;
          this.presentToast('Balasan berjaya ditambah', 'success');
          this.replyingToCommentId = null;
          this.newReply = '';
        }
      }
    } catch {
      this.presentToast('Gagal menambah balasan.');
    }
  }

  /**
   * Toggles the visibility of the reply input box, focuses it, and scrolls it into view.
   */
  toggleReplyInput(commentId: number) {
    const isOpening = this.replyingToCommentId !== commentId;
    this.replyingToCommentId = isOpening ? commentId : null;
    this.newReply = '';

    if (isOpening) {
      setTimeout(() => {
        const inputContainer = document.querySelector('.reply-input-container');
        inputContainer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.replyTextarea?.setFocus();
      }, 150);
    }
  }

  /**
   * Determines if the reply input should be shown for a given top-level comment thread.
   */
  isReplyingInThisThread(topLevelComment: Comment): boolean {
    if (this.replyingToCommentId === null) return false;
    if (this.replyingToCommentId === topLevelComment.id) return true;
    return topLevelComment.replies.some(
      (reply) => reply.id === this.replyingToCommentId,
    );
  }

  /**
   * Gets the name of the user being replied to, but only for a reply-to-a-reply.
   */
  getReplyingToName(reply: Comment, topLevelComment: Comment): string | null {
    if (reply.parent_comment_id === topLevelComment.id) return null;
    const parentReply = topLevelComment.replies.find(
      (r) => r.id === reply.parent_comment_id,
    );
    return parentReply ? parentReply.user : null;
  }

  /**
   * Presents a popover with "Edit" and "Delete" options for a comment.
   */
  async presentCommentPopover(event: Event, comment: Comment) {
    const isOwner = this.currentUser?.email === comment.email;
    const popover = await this.popoverController.create({
      component: CommentOptionsPopoverComponent,
      componentProps: { isOwner, isAdmin: this.isAdmin },
      event,
      translucent: true,
      showBackdrop: false,
    });
    await popover.present();
    const { data } = await popover.onDidDismiss();
    if (data?.action === 'edit') this.editComment(comment);
    if (data?.action === 'delete') this.confirmDeleteComment(comment.id);
  }

  /**
   * Enters "edit mode" for a specific comment.
   */
  editComment(comment: Comment) {
    this.editingCommentId = comment.id;
    this.editCommentText = comment.text;
  }

  /**
   * Exits "edit mode" without saving.
   */
  cancelEditComment() {
    this.editingCommentId = null;
    this.editCommentText = '';
  }

  /**
   * Saves an edited comment.
   */
  async saveEditedComment(comment: Comment) {
    if (!this.editCommentText.trim()) return;
    try {
      const response = await this.announcementService.updateComment(
        comment.id,
        this.editCommentText.trim(),
      );
      if (response.success) {
        comment.text = this.editCommentText.trim();
        comment.is_edited = true;
        this.cancelEditComment();
        this.presentToast('Komen berjaya dikemaskini', 'success');
      }
    } catch {
      this.presentToast('Gagal mengemaskini komen.');
    }
  }

  /**
   * Shows a confirmation alert before deleting a comment.
   */
  async confirmDeleteComment(commentId: number) {
    const alert = await this.alertController.create({
      header: 'Sahkan Padam',
      message: 'Adakah anda pasti mahu memadamkan komen ini?',
      buttons: [
        { text: 'Batal', role: 'cancel' },
        { text: 'Padam', handler: () => this.deleteComment(commentId) },
      ],
    });
    await alert.present();
  }

  /**
   * Deletes a comment after confirmation.
   */
  private async deleteComment(commentId: number) {
    if (!this.selectedArticle) return;
    try {
      const response = await this.announcementService.deleteComment(commentId);
      if (response.success) {
        const info = this.findCommentAndParent(commentId);
        if (info) {
          if (info.topLevelParent.id === commentId) {
            this.selectedArticle.comments =
              this.selectedArticle.comments.filter((c) => c.id !== commentId);
          } else {
            info.topLevelParent.replies = info.topLevelParent.replies.filter(
              (r) => r.id !== commentId,
            );
          }
          this.selectedArticle.commentsCount--;
          this.presentToast('Komen berjaya dipadam', 'success');
        }
      }
    } catch {
      this.presentToast('Gagal memadam komen.');
    }
  }

  // --- 6. Engagement & Sharing ---

  /**
   * Toggles the like status of the current article.
   */
  async toggleLike(event: Event) {
    event.stopPropagation();
    if (!this.selectedArticle) return;
    try {
      this.selectedArticle.userLiked = !this.selectedArticle.userLiked;
      this.selectedArticle.likes += this.selectedArticle.userLiked ? 1 : -1;
      const response = await this.announcementService.toggleLike(
        this.selectedArticle.id,
      );
      if (response.success) {
        this.selectedArticle.likes = response.likesCount;
      }
    } catch {
      this.presentToast('Gagal mengemaskini status suka.');
    }
  }

  /**
   * Uses the Capacitor Share plugin to share the announcement.
   * It will attempt to share the first image along with the text and a link.
   * If the image is base64, it's saved as a temporary file to be shared.
   */
  async shareAnnouncement(event: Event) {
    event.stopPropagation();

    if (!this.selectedArticle) {
      this.presentToast('Tiada artikel dipilih untuk dikongsi');
      return;
    }

    try {
      // 1. Construct the deep link to the announcement in your web app.
      const shareUrl = `https://masjidala.web.app/announcement/${this.selectedArticle.id}`;

      // 2. Prepare the main text content for sharing.
      const title = this.selectedArticle.title;
      const content = this.selectedArticle.content;
      const shareText = `*${title}*\n\n${content}\n\nBaca pengumuman penuh di aplikasi Masjid Al-A'la:`;

      // 3. Set up the initial share options object.
      const shareOptions: any = {
        title: "Pengumuman Masjid Al-A'la",
        text: shareText,
        url: shareUrl, // Always include the URL as a fallback.
        dialogTitle: 'Kongsi Pengumuman',
      };

      // 4. Check if there are images and get the first one.
      const firstImageUrl = this.selectedArticle.imageUrls?.[0];

      // 5. If the first image is a base64 string, process it.
      if (firstImageUrl && firstImageUrl.startsWith('data:image/')) {
        try {
          // Generate a unique filename to avoid caching issues.
          const fileName = `announcement_${this.selectedArticle.id}_${Date.now()}.png`;

          // Remove the "data:image/png;base64," prefix.
          const base64Data = firstImageUrl.split(',')[1];

          // Write the image data to a temporary file in the device's cache directory.
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          // Add the URI of the saved file to the share options.
          // This allows apps like WhatsApp to attach the image directly.
          shareOptions.files = [savedFile.uri];
        } catch (err) {
          console.error('Gagal menyimpan imej base64 untuk dikongsi:', err);
          // If saving fails, we simply proceed without the file. The URL is still in shareOptions.
        }
      }

      // 6. Call the Capacitor Share plugin with the prepared options.
      await Share.share(shareOptions);
    } catch (error: any) {
      // The 'Share canceled' message is not a real error, just the user closing the dialog.
      if (error.message !== 'Share canceled') {
        console.error('Ralat semasa berkongsi:', error);
        this.presentToast('Ralat berkongsi pengumuman. Sila cuba lagi.');
      }
    }
  }

  // --- 7. Utility & Private Helpers ---

  /**
   * Handles the pull-to-refresh action.
   */
  async handleRefresh(event: CustomEvent) {
    await this.loadAnnouncements();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Refreshes the details of the currently selected article.
   */
  async refreshArticleDetails(event: any) {
    if (!this.selectedArticle) {
      event.target.complete();
      return;
    }
    await this.loadAnnouncementDetailsById(this.selectedArticle.id);
    event.target.complete();
  }

  /**
   * Handles user authentication and profile completion checks and redirects.
   */
  private async handleAuthenticationRedirect() {
    const isAuthenticated = await this.authService.isAuthenticated();
    if (!isAuthenticated) {
      this.router.navigateByUrl('/tabs/authentication', { replaceUrl: true });
      return;
    }
    if (!(await this.authService.isProfileComplete())) {
      const alert = await this.alertController.create({
        header: 'Lengkapkan Profil',
        message: 'Anda perlu melengkapkan profil untuk mengakses pengumuman.',
        buttons: [
          {
            text: 'OK',
            handler: () =>
              this.router.navigateByUrl('/tabs/profile', { replaceUrl: true }),
          },
        ],
        backdropDismiss: false,
      });
      await alert.present();
    }
  }

  /**
   * Sets up the hardware back button handler.
   */
  private setupBackButtonHandler() {
    this.backButtonSubscription =
      this.platform.backButton.subscribeWithPriority(10, () => {
        if (this.selectedArticle) {
          this.deselectArticle();
        } else {
          this.router.navigateByUrl('/tabs/home');
        }
      });
  }

  /**
   * Finds a comment (top-level or reply) by its ID and returns it along with its top-level parent.
   */
  private findCommentAndParent(
    commentId: number,
  ): { topLevelParent: Comment; targetComment: Comment } | null {
    if (!this.selectedArticle) return null;
    for (const topLevelComment of this.selectedArticle.comments) {
      if (topLevelComment.id === commentId)
        return {
          topLevelParent: topLevelComment,
          targetComment: topLevelComment,
        };
      const reply = topLevelComment.replies.find((r) => r.id === commentId);
      if (reply)
        return { topLevelParent: topLevelComment, targetComment: reply };
    }
    return null;
  }

  /**
   * Handles announcement image loading errors by replacing the broken image with a placeholder.
   */
  handleImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    // Prevent an infinite loop if the placeholder also fails to load
    if (imgElement.classList.contains('fallback-image')) return;

    imgElement.classList.add('fallback-image');
    // A simple, generic placeholder SVG
    imgElement.src =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSAzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg==';
    imgElement.style.objectFit = 'contain';
    imgElement.style.padding = '10%'; // Add some padding to the placeholder
  }

  /**
   * Handles user avatar image loading errors by showing a default person icon.
   * This prevents the ugly "broken image" icon from showing.
   */
  handleUserImageError(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    // Hide the broken image element. The placeholder is already present behind it via CSS.
    imgElement.style.display = 'none';
  }

  /**
   * Displays a toast notification.
   */
  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
