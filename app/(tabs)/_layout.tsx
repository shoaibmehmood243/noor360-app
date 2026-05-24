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

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 64 + (Platform.OS === 'ios' ? insets.bottom : 8);

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.gold,
        tabBarInactiveTintColor: COLORS.text3,
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(201,168,76,0.15)',
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
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
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeDot} />}
              <QuranBookIcon color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="hadith"
        options={{
          title: 'Hadith',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeDot} />}
              <HadithIcon color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeDot} />}
              <HomeIcon color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: 'Prayer',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeDot} />}
              <PrayerIcon color={color} size={22} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="duas/index"
        options={{
          title: 'Duas',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={styles.activeDot} />}
              <DuasShortcutIcon color={color} size={22} />
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
      <Tabs.Screen
        name="prayer/qibla"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="prayer/tracker"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="prayer/notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="duas/[category]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="duas/tasbeeh"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="duas/names"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="duas/bookmarks"
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
    height: 32,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.gold,
  },
});
