import 'dotenv/config';
import { type ConfigContext, type ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WorkLog',
  slug: 'WorkLog-mobile',
  version: '1.0.1',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',

  icon: './assets/icon.png', // 👈 כאן האייקון שלך

  splash: {
    image: './assets/icon.png', // אפשר גם לשים את אותו קובץ
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  platforms: ['ios', 'android'],

  ios: {
    bundleIdentifier: 'com.masteryoav.worklog',
    supportsTablet: true,
    newArchEnabled: true,
  },

  android: {
    package: 'com.masteryoav.worklog',
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#ffffff',
    },
    newArchEnabled: true,
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          // אופציונלי: אם תרצה לקבע גם minSdk
          // minSdkVersion: 24
        },
        // אופציונלי ל-iOS
        // ios: { deploymentTarget: '13.4' },
      },
    ],
  ],
  extra: {
    eas: { projectId: '007f7a5d-3ce2-4f3c-95f2-be2e1a5a4ff8' },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});