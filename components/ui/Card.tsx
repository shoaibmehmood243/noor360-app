import React from 'react';
import { StyleSheet, View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
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
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(201, 168, 76, 0.15)', // Elegant soft gold-hued border
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#111827', // Deep slate for dark mode cards
    borderColor: '#1a2235', // Dynamic darker border for dark mode
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default Card;
