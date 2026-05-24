import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useDuasStore } from '../../../src/store/duasStore';
import { COLORS } from '../../../constants/theme';
import Card from '../../../components/ui/Card';
import ArabicGeometricBg from '../../../components/ui/ArabicGeometricBg';
import { Dua } from '../../../src/api/client';
import AppHeader from '../../../components/AppHeader';
import TasbeehIcon from '../../../components/icons/TasbeehIcon';
import NamesIcon from '../../../components/icons/NamesIcon';

const CATEGORY_EMOJIS: Record<string, string> = {
  'morning-adhkar': '🌅',
  'evening-adhkar': '🌌',
  'food-eating': '🍲',
  'before-sleep': '🌙',
  'upon-waking': '☀️',
  'travel': '🚗',
  'protection': '🛡️',
  'entering-home': '🏡',
  'stress-anxiety': '🌀',
  'gratitude': '💖',
};

export default function DuasIndexScreen() {
  const store = useDuasStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDuas, setFilteredDuas] = useState<Dua[]>([]);

  useEffect(() => {
    store.fetchCategories();
    store.fetchDuaOfDay();
    store.syncBookmarks();
  }, []);

  // Determine the title of the moment
  const getMomentGreeting = () => {
    const hours = new Date().getHours();
    if (hours >= 4 && hours < 12) {
      return { title: 'Dua of the Morning', icon: 'sunny-outline', subtitle: 'Start with light & protection' };
    } else if (hours >= 12 && hours < 17) {
      return { title: 'Dua of the Afternoon', icon: 'sunny', subtitle: 'Gratitude & wholesome blessings' };
    } else {
      return { title: 'Dua of the Night', icon: 'moon-outline', subtitle: 'Rest in ultimate peace & trust' };
    }
  };

  const moment = getMomentGreeting();

  // Handle global search across all categories
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDuas([]);
      return;
    }

    const fetchAllAndFilter = async () => {
      try {
        const results: Dua[] = [];
        // Map through active categories and fetch duas to filter globally
        for (const cat of store.categories) {
          const response = await fetch(`http://192.168.202.78:5000/api/duas/${cat.id}`);
          const json = await response.json();
          if (json.data) {
            results.push(...json.data);
          }
        }

        const query = searchQuery.toLowerCase().trim();
        const filtered = results.filter(
          (d) =>
            d.title.toLowerCase().includes(query) ||
            d.translation.toLowerCase().includes(query) ||
            d.transliteration.toLowerCase().includes(query) ||
            d.arabic.includes(query)
        );
        setFilteredDuas(filtered);
      } catch (err) {
        console.warn('Global search query failure:', err);
      }
    };

    const debounceTimer = setTimeout(fetchAllAndFilter, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, store.categories]);

  const handleShareDua = async (dua: Dua) => {
    try {
      await Share.share({
        message: `🕌 *${dua.title}* \n\n${dua.arabic}\n\n_${dua.transliteration}_\n\n"${dua.translation}"\n\nReference: ${dua.reference} • Shared via Noor360`,
      });
    } catch (e: any) {
      console.warn('Share failed:', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Background patterns */}
      <ArabicGeometricBg size={420} style={styles.backgroundOverlay} />
      <AppHeader onSettingsPress={() => router.push('/settings')} />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Duas & Dhikr</Text>
            <Text style={styles.headerSubtitle}>Prophetic Supplications & Remembrance</Text>
          </View>
          <TouchableOpacity style={styles.tasbeehShortcutBtn} onPress={() => router.push('/duas/tasbeeh')}>
            <View>
              <TasbeehIcon color={COLORS.gold} size={24} />
            </View>
            {/* <Ionicons name="calculator-outline" size={20} color={COLORS.gold} /> */}
            <Text style={styles.tasbeehShortcutText}>Tasbeeh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBarBg}>
          <Ionicons name="search" size={18} color={COLORS.text3} style={styles.searchIcon} />
          <TextInput
            placeholder="Search duas by translation, title or Arabic..."
            placeholderTextColor={COLORS.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={COLORS.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {searchQuery ? (
        // Search Results list
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Search Results ({filteredDuas.length})</Text>
          {filteredDuas.length === 0 ? (
            <View style={styles.emptySearch}>
              <Ionicons name="alert-circle-outline" size={48} color={COLORS.text3} />
              <Text style={styles.emptySearchText}>No supplications match your search.</Text>
            </View>
          ) : (
            filteredDuas.map((item) => {
              const isBookmarked = store.bookmarkedDuaIds.includes(item.id);
              return (
                <Card key={item.id} style={styles.duaCard}>
                  <View style={styles.duaCardHeader}>
                    <Text style={styles.duaCardTitle}>{item.title}</Text>
                    <View style={styles.duaCardActions}>
                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => store.toggleBookmark(item)}
                      >
                        <Ionicons
                          name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                          size={18}
                          color={isBookmarked ? COLORS.gold : COLORS.text2}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleShareDua(item)}>
                        <Ionicons name="share-social-outline" size={18} color={COLORS.text2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.duaArabic}>{item.arabic}</Text>
                  <Text style={styles.duaTranslit}>{item.transliteration}</Text>
                  <Text style={styles.duaTrans}>{item.translation}</Text>
                  <Text style={styles.duaRef}>Reference: {item.reference}</Text>
                </Card>
              );
            })
          )}
        </ScrollView>
      ) : (
        // Main Duas dashboard
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Dua of the Moment */}
          {store.duaOfDay && (
            <Card style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.heroIconBox}>
                  <Ionicons name={moment.icon as any} size={18} color={COLORS.gold} />
                </View>
                <View style={styles.heroHeaderText}>
                  <Text style={styles.heroMomentTitle}>{moment.title}</Text>
                  <Text style={styles.heroMomentSub}>{moment.subtitle}</Text>
                </View>
              </View>

              <View style={styles.heroDuaContent}>
                <Text style={styles.heroDuaTitle}>{store.duaOfDay.title}</Text>
                <Text style={styles.heroDuaArabic}>{store.duaOfDay.arabic}</Text>
                <Text style={styles.heroDuaTranslation} numberOfLines={3}>
                  "{store.duaOfDay.translation}"
                </Text>
              </View>

              <View style={styles.heroFooter}>
                <Text style={styles.heroRef}>Ref: {store.duaOfDay.reference}</Text>
                <TouchableOpacity
                  style={styles.heroActionBtn}
                  onPress={() => {
                    const isBookmarked = store.bookmarkedDuaIds.includes(store.duaOfDay!.id);
                    store.toggleBookmark(store.duaOfDay!);
                  }}
                >
                  <Ionicons
                    name={store.bookmarkedDuaIds.includes(store.duaOfDay.id) ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={COLORS.gold}
                  />
                  <Text style={styles.heroActionBtnText}>
                    {store.bookmarkedDuaIds.includes(store.duaOfDay.id) ? 'Saved' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Quick Tools Row */}
          <Text style={styles.sectionTitle}>Spiritual Companions</Text>
          <View style={styles.toolsRow}>
            <TouchableOpacity style={styles.toolCard} onPress={() => router.push('/duas/tasbeeh')}>
              <View style={styles.toolIconWrapper}>
                <TasbeehIcon color={COLORS.gold} size={24} />
              </View>
              <Text style={styles.toolTitle}>Tasbeeh Counter</Text>
              <Text style={styles.toolSubtitle}>Keep track of daily dhikr</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.toolCard, { borderColor: 'rgba(201,168,76,0.15)' }]} onPress={() => router.push('/duas/names')}>
              <View style={[styles.toolIconWrapper, { backgroundColor: 'rgba(201,168,76,0.08)' }]}>
                <NamesIcon color={COLORS.gold} size={24} />
              </View>
              <Text style={styles.toolTitle}>99 Names of Allah</Text>
              <Text style={styles.toolSubtitle}>Learn & memorize attributes</Text>
            </TouchableOpacity>
          </View>

          {/* Browse Categories */}
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          {store.isLoading ? (
            <View style={styles.centeredLoader}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {store.categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryCard}
                  onPress={() => router.push(`/duas/${cat.id}`)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.categoryEmoji}>{CATEGORY_EMOJIS[cat.id] || '🕌'}</Text>
                    <Text style={styles.categoryCount}>{cat.count} duas</Text>
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backgroundOverlay: {
    opacity: 0.6,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 4,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBarBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    paddingBottom: 10,
  },
  heroIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  heroHeaderText: {
    flex: 1,
  },
  heroMomentTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  heroMomentSub: {
    fontSize: 10,
    color: COLORS.text3,
    marginTop: 2,
  },
  heroDuaContent: {
    paddingVertical: 14,
  },
  heroDuaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: 8,
  },
  heroDuaArabic: {
    fontSize: 18,
    color: COLORS.gold2,
    textAlign: 'right',
    fontFamily: 'Amiri_400Regular',
    lineHeight: 28,
    marginBottom: 8,
  },
  heroDuaTranslation: {
    fontSize: 12,
    color: COLORS.text2,
    lineHeight: 16,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.02)',
    paddingTop: 10,
  },
  heroRef: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: '500',
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroActionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 6,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryCount: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: 'bold',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    lineHeight: 18,
  },
  centeredLoader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptySearch: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 13,
    color: COLORS.text3,
    marginTop: 12,
  },
  duaCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  duaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  duaCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.teal,
    maxWidth: '75%',
  },
  duaCardActions: {
    flexDirection: 'row',
  },
  cardActionBtn: {
    marginLeft: 12,
    padding: 2,
  },
  duaArabic: {
    fontSize: 19,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    textAlign: 'right',
    lineHeight: 30,
    marginBottom: 10,
  },
  duaTranslit: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.text3,
    lineHeight: 16,
    marginBottom: 6,
  },
  duaTrans: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
    marginBottom: 10,
  },
  duaRef: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: '500',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tasbeehShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(201, 168, 76, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tasbeehShortcutText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  toolCard: {
    flex: 0.485,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
  },
  toolIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(45,212,191,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  toolTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  toolSubtitle: {
    fontSize: 10,
    color: COLORS.text3,
    marginTop: 2,
  },
});
