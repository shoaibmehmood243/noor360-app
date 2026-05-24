import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface GoldBadgeProps {
  text: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const GoldBadge: React.FC<GoldBadgeProps> = ({ text, style, textStyle }) => {
  return (
    <View style={[styles.badge, style]}>
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: 'rgba(201, 168, 76, 0.25)',
  },
  text: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default GoldBadge;
