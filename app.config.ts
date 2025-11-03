import 'dotenv/config';
import { ExpoConfig } from 'expo';

const config: ExpoConfig = {
  name: 'WorkLog',
  slug: 'WorkLog-mobile',
  scheme: 'worklog',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/logo.png',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  splash: {
    image: './assets/logo.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.masteryoav.worklog',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.masteryoav.worklog',
    adaptiveIcon: {
      foregroundImage: './assets/logo.png',
      backgroundColor: '#ffffff',
    },
  },
  extra: {
    eas: {
      projectId: '007f7a5d-3ce2-4f3c-95f2-be2e1a5a4ff8',
    },
    // pulled from .env at runtime
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    // we DO use expo-router:
    'expo-router',
    // 🚫 DO NOT put 'expo-clipboard' here – it has no config plugin in this version
    // 'expo-clipboard',
    // 'expo-mail-composer' also usually not needed as a plugin
  ],
};

export default config;