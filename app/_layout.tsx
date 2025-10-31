// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // הכי חשוב בשבילך:
        gestureEnabled: false, // מבטל החלקה אחורה בכל המסכים
      }}
    />
  );
}