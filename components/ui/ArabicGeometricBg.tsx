import React from 'react';
import { StyleSheet, View, Dimensions, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ArabicGeometricBgProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const ArabicGeometricBg: React.FC<ArabicGeometricBgProps> = ({
  size = SCREEN_WIDTH * 0.9,
  style,
}) => {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={styles.svg}
      >
        <G stroke={COLORS.gold} strokeWidth="0.5" fill="none" opacity="0.05">
          {/* Outer Hexagon/Star structure */}
          <Path d="M50 5 L95 50 L50 95 L5 50 Z" />
          <Path d="M27.5 27.5 L72.5 27.5 L72.5 72.5 L27.5 72.5 Z" />
          <Path d="M50 5 L50 95" />
          <Path d="M5 50 L95 50" />
          <Path d="M5 5 L95 95" />
          <Path d="M95 5 L5 95" />

          {/* 8-Point Rub el Hizb Star */}
          <Path d="M50 15 L60 38 L85 50 L60 62 L50 85 L40 62 L15 50 L40 38 Z" />
          <Path d="M50 25 L57 43 L75 50 L57 57 L50 75 L43 57 L25 50 L43 43 Z" />

          {/* Concentric Circles & Geometric intersections */}
          <Path d="M 50, 50 m -15, 0 a 15,15 0 1,0 30,0 a 15,15 0 1,0 -30,0" />
          <Path d="M 50, 50 m -25, 0 a 25,25 0 1,0 50,0 a 25,25 0 1,0 -50,0" />
          <Path d="M 50, 50 m -35, 0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0" />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  svg: {
    transform: [{ rotate: '22.5deg' }],
  },
});

export default ArabicGeometricBg;
