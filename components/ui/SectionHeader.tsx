import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface SectionHeaderProps {
  title: string;
  onPressViewAll?: () => void;
  viewAllText?: string;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onPressViewAll,
  viewAllText = 'View all →',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {onPressViewAll && (
        <TouchableOpacity onPress={onPressViewAll} activeOpacity={0.7}>
          <Text style={styles.link}>{viewAllText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '600',
  },
});

export default SectionHeader;
