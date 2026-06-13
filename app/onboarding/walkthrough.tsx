import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import ScreenBackground from '../../components/ui/ScreenBackground';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    title: 'Holy Quran & Audio',
    tagline: 'Explore the Divine Words',
    description: 'Access the complete Holy Quran with rich translation choices, Tajweed guides, verse-by-verse notes, and pristine audio recitations from world-renowned Qaris.',
    renderIcon: () => (
      <Svg width="180" height="180" viewBox="0 0 100 100" fill="none">
        {/* Decorative background glow */}
        <Circle cx="50" cy="50" r="35" fill={COLORS.gold} opacity="0.08" />
        {/* Book pages backdrop */}
        <Path
          d="M20 70 C 35 60, 50 68, 50 68 C 50 68, 65 60, 80 70 L 80 30 C 65 20, 50 28, 50 28 C 50 28, 35 20, 20 30 Z"
          fill={COLORS.bg2}
          stroke={COLORS.gold}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Book spine/center detail */}
        <Path d="M50 28 L 50 68" stroke={COLORS.gold} strokeWidth="2.5" />
        {/* Text lines inside pages */}
        <Path d="M26 38 H 44 M26 46 H 40 M26 54 H 44 M56 38 H 74 M56 46 H 74 M56 54 H 68" stroke={COLORS.gold} strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        {/* Divine light ray decoration */}
        <Path d="M50 12 L 50 20 M38 15 L 42 20 M62 15 L 58 20" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    ),
  },
  {
    id: 2,
    title: 'Prayer Times & Tracker',
    tagline: 'Perfect Your Prayers',
    description: 'Stay committed with automated highly-accurate local prayer timetables, real-time Qibla compass alignment, and a persistent tracker log to mark your daily prayers.',
    renderIcon: () => (
      <Svg width="180" height="180" viewBox="0 0 100 100" fill="none">
        {/* Decorative circle */}
        <Circle cx="50" cy="50" r="38" stroke={COLORS.gold} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
        <Circle cx="50" cy="50" r="30" fill={COLORS.gold} opacity="0.08" />
        {/* Mosque Dome silhouette */}
        <Path
          d="M50 22 C 50 22, 38 34, 38 48 L 62 48 C 62 34, 50 22, 50 22 Z"
          fill={COLORS.gold}
          opacity="0.3"
        />
        {/* Mosque structures */}
        <Rect x="42" y="48" width="16" height="24" rx="2" fill={COLORS.bg2} stroke={COLORS.gold} strokeWidth="2" />
        <Path d="M50 48 L 50 72 M42 60 H 58" stroke={COLORS.gold} strokeWidth="1.5" opacity="0.7" />
        {/* Crescent Moon */}
        <Path
          d="M 52 14 A 4.5 4.5 0 1 0 57 22 A 3.5 3.5 0 1 1 52 14 Z"
          fill={COLORS.gold}
        />
      </Svg>
    ),
  },
  {
    id: 3,
    title: 'Islamic Knowledge Hub',
    tagline: 'Tasbeeh, Hadith & Daily Supplications',
    description: 'Grow your daily spiritual routine by reciting Morning/Evening Supplications (Adhkar), reading the daily Hadith digests, and counting dhikr with our Tasbeeh rings.',
    renderIcon: () => (
      <Svg width="180" height="180" viewBox="0 0 100 100" fill="none">
        <Circle cx="50" cy="50" r="35" fill={COLORS.gold} opacity="0.08" />
        {/* Tasbeeh beads circle */}
        <Circle cx="50" cy="50" r="24" stroke={COLORS.gold} strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" />
        {/* Center medallion or pendant */}
        <Circle cx="50" cy="74" r="5" fill={COLORS.gold} />
        <Path d="M50 79 L 50 87" stroke={COLORS.gold} strokeWidth="2.5" strokeLinecap="round" />
        {/* Islamic star inside */}
        <Path
          d="M50 35 L 53 43 L 61 43 L 55 48 L 57 56 L 50 51 L 43 56 L 45 48 L 39 43 L 47 43 Z"
          fill={COLORS.gold}
          opacity="0.7"
        />
      </Svg>
    ),
  },
];

export default function WalkthroughScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * width,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.push('/onboarding/location');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/location');
  };

  const handleScrollEnd = (e: any) => {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    setCurrentIndex(index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      {/* Top Header: Skip & Logo */}
      <View style={styles.topBar}>
        <View style={styles.miniLogo}>
          <Text style={styles.miniLogoText}>ن</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main horizontal swiper */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.swiper}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slideContainer}>
            <View style={styles.iconWrapper}>
              {slide.renderIcon()}
            </View>

            <View style={styles.textWrapper}>
              <Text style={styles.slideTagline}>{slide.tagline}</Text>
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDesc}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer Area: Dots and Primary Button */}
      <View style={styles.footer}>
        {/* Dynamic dot indicators */}
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, index) => {
            const isSelected = index === currentIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isSelected && styles.activeDot,
                ]}
              />
            );
          })}
        </View>

        <PrimaryButton
          title={currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bgGeometric: {
    opacity: 0.03,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  miniLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLogoText: {
    fontSize: 20,
    fontFamily: 'Amiri_700Bold',
    color: '#0A0E1A',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginTop: -15,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.text3,
    fontWeight: 'bold',
  },
  swiper: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrapper: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  slideTagline: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  slideDesc: {
    fontSize: 14,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.bg3,
    marginHorizontal: 5,
  },
  activeDot: {
    width: 20,
    backgroundColor: COLORS.gold,
  },
  button: {
    width: '100%',
  },
});
