import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import '@angular/common/locales/global/ms';
import { App } from '@capacitor/app';
import { Router, NavigationEnd } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { StatusBar } from '@capacitor/status-bar';
import { CheckUpdateService } from './core/startup/check-update.service';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { Device } from '@capacitor/device';
import { PushNotifications } from '@capacitor/push-notifications';
import { PrayerNotificationsService } from './features/prayer/services/prayer-notifications.service';
import { DarkModeHandlerService } from './core/appearance/dark-mode-handler.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  isAppLoaded = false;
  isHomePage = false;
  private routeSubscription?: Subscription;
  private listeners: PluginListenerHandle[] = [];
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private launchResolved = false;
  private routeReady = false;
  private pendingLink?: string;
  private linkRequest = 0;
  private destroyed = false;

  constructor(
    private router: Router,
    private platform: Platform,
    private updateCheck: CheckUpdateService,
    private prayerNotificationsService: PrayerNotificationsService,
    private darkModeService: DarkModeHandlerService,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ).subscribe(event => {
      this.isHomePage = event.urlAfterRedirects.startsWith('/tabs/home');
      this.routeReady = true;
      this.finishStartup();
    });
    this.routeReady = this.router.navigated;
    // Offline data and background work must never hold the launch screen open.
    this.safetyTimer = setTimeout(() => this.revealApp(), 4000);
    void this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      await this.platform.ready();
      await this.darkModeService.loadDarkModePreference();
      if (Capacitor.isNativePlatform()) {
        this.listeners.push(await App.addListener('appUrlOpen', event => {
          this.zone.run(() => { void this.navigateToDeepLink(event.url); });
        }));
        const launch = await App.getLaunchUrl();
        if (launch?.url) await this.navigateToDeepLink(launch.url);
        this.listeners.push(await PushNotifications.addListener('pushNotificationActionPerformed', () => {
          this.zone.run(() => { void this.router.navigateByUrl('/tabs/home'); });
        }));
        this.listeners.push(await App.addListener('appStateChange', async state => {
          if (state.isActive && localStorage.getItem('notificationSettingsOpened') === 'true') {
            localStorage.removeItem('notificationSettingsOpened');
            await this.prayerNotificationsService.checkPermissionAndSchedule(true);
          }
        }));
        void this.applySafeAreaIfSDK35Plus().catch(console.warn);
        void StatusBar.setBackgroundColor({ color: '#004d39' }).catch(console.warn);
      }
    } catch (error) {
      console.warn('App initialization could not finish:', error);
    } finally {
      this.launchResolved = true;
      this.finishStartup();
    }
  }

  private finishStartup(): void {
    if (!this.launchResolved || !this.routeReady || this.pendingLink) return;
    // Paint the routed view and its skeletons before releasing both splashes.
    requestAnimationFrame(() => requestAnimationFrame(() => this.zone.run(() => {
      if (!this.pendingLink) this.revealApp();
    })));
  }

  private revealApp(): void {
    if (this.destroyed || this.isAppLoaded) return;
    this.isAppLoaded = true;
    clearTimeout(this.safetyTimer);
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide({ fadeOutDuration: 150 }).catch(console.warn);
      void this.updateCheck.initialize();
    }
  }

  private async navigateToDeepLink(url: string): Promise<void> {
    const request = ++this.linkRequest;
    try {
      const parsed = new URL(url, 'https://masjidala.web.app');
      const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
      const target = path === '/prayertimes' ? '/tabs/prayer' :
        path === '/announcement' || path.startsWith('/announcement/') ? '/tabs/home' :
        path.startsWith('/tabs/') ? parsed.pathname + parsed.search + parsed.hash : '/tabs/home';
      this.pendingLink = target;
      await this.router.navigateByUrl(target);
    } catch (error) {
      console.warn('Unable to open app link:', error);
    } finally {
      if (request === this.linkRequest) {
        this.pendingLink = undefined;
        this.finishStartup();
      }
    }
  }

  private async applySafeAreaIfSDK35Plus(): Promise<void> {
    const info = await Device.getInfo();
    if (info.platform !== 'android' || (info.androidSDKVersion || 0) < 35) return;
    const { insets } = await SafeArea.getSafeAreaInsets();
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      document.body.style.setProperty('--ion-safe-area-' + edge, insets[edge] + 'px');
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    clearTimeout(this.safetyTimer);
    this.routeSubscription?.unsubscribe();
    for (const listener of this.listeners) void listener.remove();
    this.darkModeService.destroy();
  }
}
