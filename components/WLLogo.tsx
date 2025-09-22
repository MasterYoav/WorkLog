// components/WLLogo.tsx
import React from 'react';
import { Image, ImageStyle } from 'react-native';

type Props = {
  width?: number;
  height?: number;
  style?: ImageStyle;
};

export default function WLLogo({ width = 240, height = 80, style }: Props) {
  return (
    <Image
      source={require('../assets/logo.png')}
      style={[{ width, height, resizeMode: 'contain' }, style]}
    />
  );
}