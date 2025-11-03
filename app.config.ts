// app.config.ts
import 'dotenv/config';

export default {
  expo: {
    name: 'WorkLog-mobile',
    slug: 'WorkLog-mobile',
    version: '1.0.0',
    scheme: 'worklogmobile',
    newArchEnabled: true,
    ios: { "bundleIdentifier": "com.yoavperetz.worklog",supportsTablet: true },
    android: { "package": "com.yoavperetz.worklog", "versionCode": 1, permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'] },
    plugins: [
      'expo-router',
      ['expo-splash-screen', { backgroundColor: '#ffffff', dark: { backgroundColor: '#000000' } }],
      ['expo-location', { isAndroidBackgroundLocationEnabled: false }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },

    // 👇 expose env as "extra" (safe for public `EXPO_PUBLIC_` values)
    extra: {
      eas: {
        projectId: '007f7a5d-3ce2-4f3c-95f2-be2e1a5a4ff8',
      },
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};