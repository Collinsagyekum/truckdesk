import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.numdanumda.truckdesk',
  appName: 'TruckDesk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    backgroundColor: '#0A1628',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#0A1628',
  },
};

export default config;
