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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';

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
  const cardBgColor = isDark ? '#0F0C1E' : '#FCFAF3'; // Dark purple/navy or Light cream
  const titleColor = isDark ? COLORS.gold2 : COLORS.gold; // Golden title color to match the brand identity
  const arabicColor = isDark ? COLORS.gold2 : '#B45309'; // Rich gold or deep gold/amber
  const translitColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(30,27,24,0.75)'; // Soft white or soft dark gray
  const translationColor = isDark ? '#FFFFFF' : '#1E1B18'; // White or near-black
  const refColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(30,27,24,0.55)'; // Muted white or muted dark
  const streakBgColor = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)';
  const streakCountColor = isDark ? '#FFFFFF' : '#EF4444'; // Red or white

  // Modal layout colors
  const modalBgColor = isDark ? '#161326' : '#FFFFFF';
  const modalBorderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
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
              <View ref={viewRef} collapsable={false} style={[styles.shareableCard, { backgroundColor: cardBgColor }]}>
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
                        <Text style={[styles.cardArabic, { fontSize: 20, marginVertical: 4, color: arabicColor }]}>
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
                        <Text style={[styles.cardRef, { marginTop: 4, color: refColor }]}>{data.reference}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.cardTitle, { color: titleColor }]}>{data.title}</Text>

                        {/* Large Center-Aligned Amiri Arabic Text */}
                        <Text style={[styles.cardArabic, { color: arabicColor }]}>{data.arabic}</Text>

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

                    {/* Footer Watermark */}
                    <View style={styles.watermarkRow}>
                      <Ionicons name="sparkles" size={12} color={COLORS.gold} style={{ marginRight: 4 }} />
                      <Text style={styles.watermarkText}>Noor360</Text>
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
    backgroundColor: '#161326',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFrame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#0F0C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  shareableCard: {
    width: '100%',
    minHeight: 320,
    backgroundColor: '#0F0C1E',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerBorder: {
    width: '100%',
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 8,
    padding: 4,
  },
  innerBorder: {
    width: '100%',
    flex: 1,
    borderWidth: 0.5,
    borderColor: COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerOrnament: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: COLORS.gold,
    borderWidth: 2,
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  cardArabic: {
    fontSize: 18,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardTranslit: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  cardTranslation: {
    fontSize: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  cardRef: {
    fontSize: 8.5,
    color: COLORS.text3,
    textAlign: 'center',
    opacity: 0.7,
  },
  watermarkRow: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  watermarkText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 0.5,
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
