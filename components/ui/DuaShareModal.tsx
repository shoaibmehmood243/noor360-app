import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import { usePrayerStore } from '../../src/store/prayerStore';

export interface ShareData {
  title: string;
  arabic: string;
  transliteration?: string;
  translation: string;
  reference: string;
  contentType?: 'dua' | 'hadith' | 'ayah' | 'streak';
}

interface DuaShareModalProps {
  visible: boolean;
  dua?: any;
  shareData?: ShareData | null;
  onClose: () => void;
}

export default function DuaShareModal({ visible, dua, shareData, onClose }: DuaShareModalProps) {
  const themeCtx = useThemeContext();
  const isDark = themeCtx?.theme === 'dark';
  const prayerStore = usePrayerStore();
  const hijri = prayerStore.hijriDate;

  const getFormattedDate = () => {
    const gregOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    const gregDate = new Date().toLocaleDateString('en-US', gregOptions);

    if (hijri) {
      return `${gregDate}  •  ${hijri.day} ${hijri.month.ar} ${hijri.year} AH`;
    }
    return gregDate;
  };

  const viewRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const data: ShareData | null = shareData
    ? shareData
    : (dua
      ? {
        title: dua.title || 'Supplication',
        arabic: dua.arabic,
        transliteration: dua.transliteration,
        translation: dua.translation,
        reference: dua.reference,
        contentType: 'dua',
      }
      : null);

  if (!data) return null;

  // Dynamic card theme styling
  const cardBgColor = isDark ? '#070912' : '#FDFDFB';
  const titleColor = isDark ? COLORS.gold2 : COLORS.gold;
  const arabicColor = isDark ? COLORS.gold2 : '#8F661B';
  const translitColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(30,27,24,0.75)';
  const translationColor = isDark ? '#FFFFFF' : '#1E1B18';
  const refColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(30,27,24,0.55)';
  const streakBgColor = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
  const streakCountColor = isDark ? '#FFFFFF' : '#EF4444';

  // Modal layout colors
  const modalBgColor = isDark ? '#111322' : '#FFFFFF';
  const modalBorderColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const modalTitleColor = isDark ? '#FFFFFF' : '#1C1917';
  const closeBtnBgColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const closeIconColor = isDark ? '#FFFFFF' : '#1C1917';

  const handleShareImage = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Wait a tiny bit for render layout stabilization
      await new Promise((resolve) => setTimeout(resolve, 100));

      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 0.95,
        result: 'tmpfile',
      });

      if (uri) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ${data.title}`,
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device.');
        }
      }
    } catch (err) {
      console.error('Failed to capture and share image:', err);
      Alert.alert('Sharing Error', 'Failed to generate and share the card image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: modalBgColor, borderColor: modalBorderColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: modalTitleColor }]}>Share Beautiful Card</Text>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: closeBtnBgColor }]} onPress={onClose} disabled={sharing}>
              <Ionicons name="close" size={22} color={closeIconColor} />
            </TouchableOpacity>
          </View>

          {/* Styled Shareable Card Container (Captured by ViewShot) */}
          <ScrollView
            style={{ width: '100%', maxHeight: Dimensions.get('window').height * 0.55 }}
            contentContainerStyle={{ width: '100%' }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.cardFrame, { backgroundColor: cardBgColor }]}>
              <View ref={viewRef} collapsable={false} style={styles.shareableCard}>
                {/* 1. Base dark/light canvas */}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? '#070912' : '#FDFDFB' }]} />

                {/* 2. Top-Left Gold Mesh Light Source */}
                <LinearGradient
                  colors={isDark ? ['rgba(201, 168, 76, 0.16)', 'rgba(201, 168, 76, 0.03)', 'transparent'] : ['rgba(201, 168, 76, 0.08)', 'rgba(201, 168, 76, 0.015)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.95, y: 0.95 }}
                />

                {/* 3. Bottom-Right Mesh Depth */}
                <LinearGradient
                  colors={isDark ? ['transparent', 'rgba(12, 16, 27, 0.9)', '#05070D'] : ['transparent', 'rgba(255, 255, 255, 0.9)', '#FFFFFF']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0.1, y: 0.1 }}
                  end={{ x: 1, y: 1 }}
                />

                {/* Islamic Geometric Golden Double Border */}
                <View style={styles.outerBorder}>
                  <View style={styles.innerBorder}>
                    {/* Decorative corner ornaments */}
                    <View style={[styles.cornerOrnament, styles.topLeft]} />
                    <View style={[styles.cornerOrnament, styles.topRight]} />
                    <View style={[styles.cornerOrnament, styles.bottomLeft]} />
                    <View style={[styles.cornerOrnament, styles.bottomRight]} />

                    {/* Header Ornament based on content type */}
                    <Ionicons
                      name={
                        data.contentType === 'hadith'
                          ? 'book-outline'
                          : data.contentType === 'ayah'
                            ? 'ribbon-outline'
                            : data.contentType === 'streak'
                              ? 'flame'
                              : 'moon-outline'
                      }
                      size={24}
                      color={data.contentType === 'streak' ? '#F59E0B' : COLORS.gold}
                      style={styles.starOrnament}
                    />

                    {data.contentType === 'streak' ? (
                      <View style={styles.streakContainer}>
                        <Text style={[styles.streakCardTitle, { color: titleColor }]}>{data.title}</Text>

                        {/* Large Center-Aligned Amiri Arabic Text */}
                        <Text style={[styles.cardArabic, { fontSize: 22, marginVertical: 8, color: arabicColor }]}>
                          {data.arabic}
                        </Text>

                        {/* Circular flame container */}
                        <View style={[styles.streakCircle, { backgroundColor: streakBgColor }]}>
                          <Ionicons name="flame" size={28} color="#EF4444" style={{ marginBottom: -2 }} />
                          <Text style={[styles.streakCountText, { color: streakCountColor }]}>{data.transliteration}</Text>
                        </View>

                        {/* Stats Text */}
                        <Text style={[styles.streakStatsText, { color: translationColor }]}>{data.translation}</Text>

                        {/* Reference */}
                        <Text style={[styles.cardRef, { marginTop: 6, color: refColor }]}>{data.reference}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.cardTitle, { color: titleColor }]}>{data.title}</Text>

                        {/* Large Center-Aligned Amiri Arabic Text with soft light shadow */}
                        <Text style={[styles.cardArabic, { color: arabicColor }]}>{data.arabic}</Text>

                        {/* Traditional Rub el Hizb / Islamic Ornate Divider */}
                        <View style={styles.ornateDivider}>
                          <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(201, 168, 76, 0.25)' : 'rgba(201, 168, 76, 0.15)' }]} />
                          <Text style={[styles.dividerStar, { color: COLORS.gold }]}>۞</Text>
                          <View style={[styles.dividerLine, { backgroundColor: isDark ? 'rgba(201, 168, 76, 0.25)' : 'rgba(201, 168, 76, 0.15)' }]} />
                        </View>

                        {/* Transliteration */}
                        {data.transliteration ? (
                          <Text style={[styles.cardTranslit, { color: translitColor }]}>{data.transliteration}</Text>
                        ) : null}

                        {/* Centered Translation */}
                        <Text style={[styles.cardTranslation, { color: translationColor }]}>"{data.translation}"</Text>

                        {/* Reference */}
                        <Text style={[styles.cardRef, { color: refColor }]}>{data.reference}</Text>
                      </>
                    )}

                    {/* Footer Watermark & Date Row */}
                    <View style={styles.footerRow}>
                      <View style={styles.logoAndBrand}>
                        <Image
                          source={isDark ? require('../../assets/logos/logo-dark.png') : require('../../assets/logos/logo-light.png')}
                          style={styles.logoImage}
                          resizeMode="contain"
                        />
                      </View>
                      <View style={[styles.dateCapsule, {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isDark ? 'rgba(201, 168, 76, 0.15)' : 'rgba(201, 168, 76, 0.1)'
                      }]}>
                        <Text style={[styles.footerDateText, { color: refColor }]}>
                          {getFormattedDate()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareImage}
            disabled={sharing}
            activeOpacity={0.8}
          >
            {sharing ? (
              <ActivityIndicator color={COLORS.bg} size="small" />
            ) : (
              <>
                <Ionicons name="image-outline" size={18} color={COLORS.bg} style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Generate & Share Image</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFrame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  shareableCard: {
    width: '100%',
    minHeight: 340,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  outerBorder: {
    width: '100%',
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 10,
    padding: 4,
  },
  innerBorder: {
    width: '100%',
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 26,
    paddingBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerOrnament: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: COLORS.gold,
    borderWidth: 1.8,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  starOrnament: {
    marginBottom: 6,
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardArabic: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    lineHeight: 38,
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(201, 168, 76, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ornateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60%',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 0.6,
  },
  dividerStar: {
    fontSize: 14,
    marginHorizontal: 8,
    lineHeight: 18,
    opacity: 0.85,
  },
  cardTranslit: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 8,
    paddingHorizontal: 10,
    opacity: 0.85,
  },
  cardTranslation: {
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16.5,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  cardRef: {
    fontSize: 8.5,
    textAlign: 'center',
    opacity: 0.7,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 22,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(201, 168, 76, 0.15)',
    paddingTop: 0,
  },
  logoAndBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    height: 80,
    width: 80,
  },
  dateCapsule: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerDateText: {
    fontSize: 9.5,
    fontWeight: '700',
    opacity: 0.85,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.gold,
    height: 52,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  shareBtnText: {
    color: COLORS.bg,
    fontWeight: 'bold',
    fontSize: 14,
  },
  streakContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: 1,
  },
  streakCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  streakCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  streakCountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  streakStatsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 14,
    marginVertical: 4,
    paddingHorizontal: 8,
  },
});
