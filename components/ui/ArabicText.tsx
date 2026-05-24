import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';

interface ArabicTextProps {
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}

export const ArabicText: React.FC<ArabicTextProps> = ({
  text,
  size = 18,
  color = COLORS.gold2,
  bold = false,
  style,
}) => {
  let multiplier = 1.0;
  try {
    const themeCtx = useThemeContext();
    multiplier = themeCtx.multiplier;
  } catch (e) {
    // Fallback if rendered outside provider
  }

  return (
    <Text
      style={[
        styles.arabic,
        {
          fontSize: size * multiplier,
          color,
          fontFamily: bold ? 'Amiri_700Bold' : 'Amiri_400Regular',
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  arabic: {
    textAlign: 'right',
    lineHeight: 38,
  },
});

export default ArabicText;
