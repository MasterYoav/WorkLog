import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { flushPending } from '../src/data/repo';

export default function RootLayout() {
  useEffect(() => {
    (async () => { await flushPending(); })();
  }, []);

  return (
    <Stack>
      {/* מסכי כניסה ללא Header */}
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="employer-auth" options={{ headerShown: false }} />

      {/* מסכים פנימיים - מציירים Header ידני ו-SafeArea בכל מסך */}
      <Stack.Screen name="employer-home" options={{ headerShown: false }} />
      <Stack.Screen name="clock" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="employer-project" options={{ headerShown: false }} />

      {/* אם קיימים טאבים מהתבנית */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* כדי שלא תופיע אזהרה על not-found */}
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}