import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL must use HTTPS.');
}

export default {
  expo: {
    name: 'WorkLog-mobile',
    slug: 'WorkLog-mobile',
    scheme: 'worklogmobile',
    newArchEnabled: true,
    ios: { supportsTablet: true },
    android: {
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      usesCleartextTraffic: false,
      package: 'com.worklog.app',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#ffffff', dark: { backgroundColor: '#000000' } },
      ],
      ['expo-location', { isAndroidBackgroundLocationEnabled: false }],
      [
        'expo-build-properties',
        {
          android: {
            minifyEnabled: true,
            shrinkResources: true,
            enableProguardInReleaseBuilds: true,
          },
        },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },

    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
