import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '../../src/context/ThemeContext';

export default function ScreenBackground() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  if (isDark) {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Base dark canvas */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#070912' }]} />

        {/* Top-Left Gold Mesh Light Source */}
        <LinearGradient
          colors={['rgba(201, 168, 76, 0.15)', 'rgba(201, 168, 76, 0.03)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.85 }}
        />

        {/* Bottom-Right Deep Navy/Black Mesh */}
        <LinearGradient
          colors={['transparent', 'rgba(12, 16, 27, 0.85)', '#05070D']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.15, y: 0.15 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Center Diagonal Gold/Teal Blend */}
        <LinearGradient
          colors={['rgba(45, 212, 191, 0.04)', 'rgba(201, 168, 76, 0.05)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 0.6 }}
        />
      </View>
    );
  }

  // Light Theme Mesh Gradient
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Base warm cream canvas - lightened for cleaner contrast */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FDFDFB' }]} />

      {/* Top-Left Soft Gold Mesh Light Source - stretched for deeper blur */}
      <LinearGradient
        colors={['rgba(201, 168, 76, 0.08)', 'rgba(201, 168, 76, 0.015)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.1, y: 1.1 }}
      />

      {/* Bottom-Right Pure White Soft Light - expanded to blend colors */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.9)', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Center Soft Cream/Gold Blend - subtle transition overlay */}
      <LinearGradient
        colors={['rgba(240, 235, 224, 0.25)', 'rgba(201, 168, 76, 0.02)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
      />
    </View>
  );
}
