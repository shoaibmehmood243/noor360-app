import React from 'react';
import { StyleSheet, View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeContext } from '../../src/context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  activeOpacity = 0.85,
}) => {
  const themeCtx = useThemeContext();
  const isDark = themeCtx?.theme === 'dark';

  const gradientColors = isDark
    ? ['#161E2E', '#0E1321'] as const
    : ['#FFFFFF', '#F7F6EE'] as const;

  const cardStyles = [
    styles.card,
    isDark ? styles.cardDark : styles.cardLight,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        style={cardStyles}
      >
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  cardLight: {
    borderColor: 'rgba(201, 168, 76, 0.15)', // Elegant soft gold-hued border
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDark: {
    borderColor: '#1a2235', // Dynamic darker border for dark mode
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default Card;
