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
      launchFadeOutDuration: 0,
    },
    GpsEnabler: {},
  },
};

export default config;
