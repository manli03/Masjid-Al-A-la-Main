import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mjidala.prayer',
  appName: "Masjid Al A'la Assistant",
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
    BackgroundRunner: {
      label: 'com.mjidala.prayer.background.task',
      src: 'src/app/app.component.ts',
      event: 'myCustomEvent',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
