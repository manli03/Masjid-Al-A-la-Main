import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.web.masjidala',
  appName: "Masjid A'la",
  webDir: 'www',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#004d39',
      launchFadeOutDuration: 150,
    },
    GpsEnabler: {},
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId:
        '1004857377739-v0fsdh2laq99udcmv54juh7v3ohsihfd.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    App: {
      appUrlOpen: {
        // These will be used for Universal Links on iOS and
        // for App Links on Android
        associatedDomains: ['masjidala.web.app', 'www.masjidala.web.app'],
      },
    },
  },
};

export default config;
