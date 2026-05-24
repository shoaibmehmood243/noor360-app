import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import ArabicGeometricBg from './ui/ArabicGeometricBg';
import { useThemeContext } from '../src/context/ThemeContext';

interface AppHeaderProps {
  hasUnreadNotifications?: boolean;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  hasUnreadNotifications = true, // default to true to show the gorgeous red dot!
  onNotificationPress,
  onSettingsPress,
}) => {
  const insets = useSafeAreaInsets();
  const headerHeight = 160 + insets.top;
  const { theme } = useThemeContext();

  const gradientColors = theme === 'light'
    ? ['transparent', 'rgba(248, 249, 250, 0.95)', '#F8F9FA'] as const
    : ['transparent', 'rgba(10, 14, 26, 0.95)', '#0A0E1A'] as const;

  return (
    <View style={[styles.headerContainer, { height: headerHeight, paddingTop: insets.top }]}>
      {/* 1. Islamic Geometric Background Vector */}
      <ArabicGeometricBg size={300} style={styles.backgroundMask} />

      {/* 2. Linear Gradient Mask fading into the dynamic active background */}
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
      />

      {/* 3. Top Action row */}
      <View style={styles.topRow}>
        {/* Left Side Brand Logo */}
        <View style={styles.brandContainer}>
          <View style={styles.logoSquare}>
            <Text style={styles.logoLetter}>ن</Text>
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandTitle}>Noor</Text>
            <Text style={styles.brandSubtitle}>360</Text>
          </View>
        </View>

        {/* Right Side Icons */}
        <View style={styles.actionIcons}>
          {/* <TouchableOpacity
            style={styles.iconButton}
            onPress={onNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.gold} />
            {hasUnreadNotifications && <View style={styles.notificationBadge} />}
          </TouchableOpacity> */}

          <TouchableOpacity
            style={styles.iconButton}
            onPress={onSettingsPress}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={COLORS.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Bottom Bismillah Row */}
      <View style={styles.bismillahContainer}>
        <Text style={styles.bismillahArabic}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        <Text style={styles.bismillahEnglish}>
          In the name of Allah, the Most Gracious, the Most Merciful
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    backgroundColor: '#0A0E1A',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(201,168,76,0.1)',
  },
  backgroundMask: {
    top: -50,
    position: 'absolute',
    opacity: 0.08,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    marginTop: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoLetter: {
    color: '#0A0E1A',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Amiri_700Bold',
  },
  brandText: {
    flexDirection: 'row',
    marginLeft: 10,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  brandSubtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 4,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bg2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626', // High-contrast Red dot
  },
  bismillahContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bismillahArabic: {
    fontSize: 20,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold2,
    textAlign: 'center',
  },
  bismillahEnglish: {
    fontSize: 11,
    color: COLORS.text3,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

export default AppHeader;
