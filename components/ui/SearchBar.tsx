import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onMicPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value,
  onChangeText,
  onMicPress,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.containerFocused,
        style,
      ]}
    >
      <Ionicons name="search" size={20} color={isFocused ? COLORS.gold : COLORS.text3} style={styles.searchIcon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={COLORS.text3}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.input}
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={COLORS.text3} style={styles.rightIcon} />
        </TouchableOpacity>
      ) : (
        onMicPress && (
          <TouchableOpacity onPress={onMicPress}>
            <Ionicons name="mic" size={18} color={COLORS.gold} style={styles.rightIcon} />
          </TouchableOpacity>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    height: 48,
  },
  containerFocused: {
    borderColor: COLORS.gold,
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  rightIcon: {
    marginLeft: 8,
  },
});

export default SearchBar;
