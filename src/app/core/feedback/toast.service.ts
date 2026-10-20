import { Injectable } from '@angular/core';
import { ToastController, ToastOptions } from '@ionic/angular';

export interface QueuedToast {
  message: string | any; // Allow IonicSafeString or other types
  options?: Partial<ToastOptions>;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private toastQueue: QueuedToast[] = [];
  private isProcessingQueue = false;
  private currentToast: HTMLIonToastElement | null = null;

  constructor(private toastController: ToastController) {}

  /**
   * Present a toast message with queuing to prevent overlapping
   * @param message The message to display
   * @param color The color of the toast (default: 'primary')
   * @param duration The duration in milliseconds (default: 3000)
   * @param position The position of the toast (default: 'top')
   */
  async presentToast(
    message: string,
    color: string = 'primary',
    duration: number = 3000,
    position: 'top' | 'bottom' | 'middle' = 'top'
  ): Promise<void> {
    const toastOptions: ToastOptions = {
      message,
      duration,
      position,
      color,
    };

    // Add to queue
    this.toastQueue.push({ message, options: toastOptions });

    // Start processing if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Present a toast with custom options and queuing
   * @param options Toast options
   */
  async presentToastWithOptions(options: ToastOptions): Promise<void> {
    // Add to queue
    this.toastQueue.push({ message: options.message || '', options });

    // Start processing if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Present a toast immediately without queuing (for special cases like back button)
   * @param message The message to display
   * @param options Toast options
   */
  async presentToastImmediate(
    message: string,
    options: Partial<ToastOptions> = {}
  ): Promise<HTMLIonToastElement> {
    // Dismiss current toast if exists
    if (this.currentToast) {
      await this.currentToast.dismiss();
      this.currentToast = null;
    }

    const toastOptions: ToastOptions = {
      message,
      duration: 3000,
      position: 'top',
      color: undefined,
      ...options,
    };

    const toast = await this.toastController.create(toastOptions);
    this.currentToast = toast;

    await toast.present();

    // Clear reference when dismissed
    toast.onDidDismiss().then(() => {
      this.currentToast = null;
    });

    return toast;
  }

  /**
   * Get the current active toast (useful for special cases)
   */
  getCurrentToast(): HTMLIonToastElement | null {
    return this.currentToast;
  }

  /**
   * Dismiss the current toast
   */
  async dismissCurrentToast(): Promise<void> {
    if (this.currentToast) {
      await this.currentToast.dismiss();
      this.currentToast = null;
    }
  }

  /**
   * Process the toast queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.toastQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.toastQueue.length > 0) {
      const queuedToast = this.toastQueue.shift()!;

      try {
        // Dismiss any current toast before showing the next one
        if (this.currentToast) {
          await this.currentToast.dismiss();
          this.currentToast = null;
        }

        const toast = await this.toastController.create(queuedToast.options);
        this.currentToast = toast;

        await toast.present();

        // Wait for the toast to be dismissed before processing the next one
        await new Promise<void>((resolve) => {
          toast.onDidDismiss().then(() => {
            this.currentToast = null;
            resolve();
          });
        });
      } catch (error) {
        console.error('Error presenting toast:', error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Clear the toast queue
   */
  clearQueue(): void {
    this.toastQueue = [];
  }

  /**
   * Get the number of toasts in the queue
   */
  getQueueLength(): number {
    return this.toastQueue.length;
  }
}
