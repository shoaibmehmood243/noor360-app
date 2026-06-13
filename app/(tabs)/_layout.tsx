import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { HadithIcon } from '../../components/icons/HadithIcon';
import { HomeIcon } from '../../components/icons/HomeIcon';
import { PrayerIcon } from '../../components/icons/PrayerIcon';
import DuasShortcutIcon from '../../components/icons/DuasShortcutIcon';
import QuranBookIcon from '../../components/icons/QuranBookIcon';
import { useThemeContext } from '../../src/context/ThemeContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  return (
    <Tabs
      initialRouteName="home"
      safeAreaInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(10, 14, 26, 0.45)',
        tabBarShowLabel: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? insets.bottom + 4 : 24,
          left: 16,
          right: 16,
          backgroundColor: isDark ? 'rgba(10, 14, 26, 0.92)' : 'rgba(255, 255, 255, 0.94)',
          borderRadius: 48,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(201, 168, 76, 0.2)' : 'rgba(201, 168, 76, 0.15)',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(201, 168, 76, 0.2)' : 'rgba(201, 168, 76, 0.15)',
          height: 74,
          paddingBottom: 6,
          paddingTop: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 18,
          elevation: 10,
          marginHorizontal: 8,
        },
        tabBarItemStyle: {
          height: 74,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          width: 54,
          height: 38,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="quran"
        options={{
          title: 'Quran',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconWrapper,
              focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight)
            ]}>
              <QuranBookIcon color={focused ? COLORS.gold : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hadith"
        options={{
          title: 'Hadith',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconWrapper,
              focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight)
            ]}>
              <HadithIcon color={focused ? COLORS.gold : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconWrapper,
              focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight)
            ]}>
              <HomeIcon color={focused ? COLORS.gold : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: 'Prayer',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconWrapper,
              focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight)
            ]}>
              <PrayerIcon color={focused ? COLORS.gold : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="duas/index"
        options={{
          title: 'Duas',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.iconWrapper,
              focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight)
            ]}>
              <DuasShortcutIcon color={focused ? COLORS.gold : color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai-scholar"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: 'transparent',
  },
  iconWrapperActiveDark: {
    backgroundColor: 'rgba(201, 168, 76, 0.16)',
    borderColor: 'rgba(201, 168, 76, 0.35)',
  },
  iconWrapperActiveLight: {
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderColor: 'rgba(201, 168, 76, 0.3)',
  },
});
