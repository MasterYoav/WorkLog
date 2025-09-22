// app.config.ts
import 'dotenv/config';

export default {
  expo: {
    name: 'WorkLog-mobile',
    slug: 'WorkLog-mobile',
    scheme: 'worklogmobile',
    newArchEnabled: true,
    ios: { supportsTablet: true },
    android: { permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'] },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { backgroundColor: '#ffffff', dark: { backgroundColor: '#000000' } }],
      ['expo-location', { isAndroidBackgroundLocationEnabled: false }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },

    // 👇 expose env as "extra" (safe for public `EXPO_PUBLIC_` values)
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};