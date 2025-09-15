import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* We set auth as the initial route, add clock, and keep existing tabs & modal for later */}
      <Stack initialRouteName="auth">
        {/* Login screen (we'll add app/auth.tsx next) */}
        <Stack.Screen name="auth" options={{ title: 'Login' }} />
        {/* Clock screen (we'll add app/clock.tsx next) */}
        <Stack.Screen name="clock" options={{ title: 'WorkLog' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
