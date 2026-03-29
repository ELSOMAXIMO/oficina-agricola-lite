import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oficinaagricola.pro',
  appName: 'Oficina Agricola Lite',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
