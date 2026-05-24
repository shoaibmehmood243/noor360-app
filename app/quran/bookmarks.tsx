import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { useQuran } from '../../src/hooks/useQuran';
import { saveBookmark } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import GoldBadge from '../../components/ui/GoldBadge';
import ArabicText from '../../components/ui/ArabicText';
import EmptyState from '../../components/ui/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ActiveTab = 'Bookmarks' | 'Notes';
type SortOption = 'Date saved' | 'Surah order' | 'Most recent';

interface UserNote {
  refId: string; // "surah:verse" e.g. "18:10"
  arabicText: string;
  noteText: string;
  reference: string;
  updatedAt: number;
}

export default function BookmarksNotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ addNoteRef?: string; arabicText?: string; reference?: string }>();
  const quran = useQuran();

  // Tab & Sort Settings
  const [activeTab, setActiveTab] = useState<ActiveTab>('Bookmarks');
  const [sortOption, setSortOption] = useState<SortOption>('Date saved');
  const [searchQuery, setSearchQuery] = useState('');

  // Notes Local Dataset
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit Note Modal controls
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<UserNote | null>(null);
  const [noteInputText, setNoteInputText] = useState('');
  const debounceTimer = useRef<any>(null);

  // Fetch initial datasets
  useEffect(() => {
    quran.syncBookmarks();
    loadNotes();
  }, []);

  // Listen to deep linked addNoteRef queries to launch Note modal directly from verse reader long press
  useEffect(() => {
    if (params.addNoteRef && params.arabicText && params.reference) {
      setActiveTab('Notes');
      const noteRef = params.addNoteRef;
      
      const prepareNoteLink = async () => {
        // Read active note list
        let currentNotes: UserNote[] = [];
        try {
          const cached = await AsyncStorage.getItem('quran_notes');
          if (cached) {
            currentNotes = JSON.parse(cached);
          }
        } catch (e) {
          console.warn('Failed to parse notes on deep link:', e);
        }

        const match = currentNotes.find((n) => n.refId === noteRef) || {
          refId: noteRef,
          arabicText: params.arabicText || '',
          noteText: '',
          reference: params.reference || '',
          updatedAt: Date.now(),
        };

        setSelectedNote(match);
        setNoteInputText(match.noteText);
        setNoteModalVisible(true);
      };

      prepareNoteLink();
    }
  }, [params.addNoteRef, params.arabicText, params.reference]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const cached = await AsyncStorage.getItem('quran_notes');
      if (cached) {
        setNotes(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to parse cached Quran notes:', e);
    } finally {
      setLoading(false);
    }
  };

  // Save specific note back to local storage
  const saveNoteToLocal = async (updatedNote: UserNote) => {
    try {
      const currentNotes = [...notes];
      const matchIndex = currentNotes.findIndex((n) => n.refId === updatedNote.refId);

      if (matchIndex >= 0) {
        currentNotes[matchIndex] = updatedNote;
      } else {
        currentNotes.push(updatedNote);
      }

      setNotes(currentNotes);
      await AsyncStorage.setItem('quran_notes', JSON.stringify(currentNotes));
    } catch (e) {
      console.warn('Failed to save notes locally:', e);
    }
  };

  // Delete note locally and sync
  const handleDeleteNote = async (refId: string) => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this custom note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const filtered = notes.filter((n) => n.refId !== refId);
          setNotes(filtered);
          await AsyncStorage.setItem('quran_notes', JSON.stringify(filtered));
        },
      },
    ]);
  };

  // Dynamic sorting & filtering logic for Bookmarks
  const getFilteredBookmarks = () => {
    let list = [...quran.bookmarks];

    // Filter by search bar query
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.reference.toLowerCase().includes(query) ||
          b.translation.toLowerCase().includes(query) ||
          b.arabicText.includes(query)
      );
    }

    // Apply selected sorting parameters
    if (sortOption === 'Surah order') {
      list.sort((a, b) => {
        const [aS, aV] = a.refId.split(':').map(Number);
        const [bS, bV] = b.refId.split(':').map(Number);
        if (aS !== bS) return aS - bS;
        return aV - bV;
      });
    } else if (sortOption === 'Most recent') {
      // Swipe order or reverse order of array
      list.reverse();
    }
    return list;
  };

  // Dynamic sorting & filtering logic for Notes
  const getFilteredNotes = () => {
    let list = [...notes];

    // Filter by search bar query
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.reference.toLowerCase().includes(query) ||
          n.noteText.toLowerCase().includes(query) ||
          n.arabicText.includes(query)
      );
    }

    // Apply selected sorting parameters
    if (sortOption === 'Surah order') {
      list.sort((a, b) => {
        const [aS, aV] = a.refId.split(':').map(Number);
        const [bS, bV] = b.refId.split(':').map(Number);
        if (aS !== bS) return aS - bS;
        return aV - bV;
      });
    } else if (sortOption === 'Most recent') {
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return list;
  };

  // Navigates directly to the Quran reader at selected coordinates
  const handleNavigateToVerse = (refId: string) => {
    const [surahId, verseNum] = refId.split(':');
    router.push({
      pathname: `/quran/${surahId}` as any,
      params: { highlightVerse: verseNum },
    });
  };

  // Opens note composer modal
  const handleOpenNoteEditor = (note: UserNote) => {
    setSelectedNote(note);
    setNoteInputText(note.noteText);
    setNoteModalVisible(true);
  };

  // 1-second debounced local storage save on typing
  const handleNoteTextChange = (text: string) => {
    setNoteInputText(text);
    if (selectedNote) {
      const updated = {
        ...selectedNote,
        noteText: text,
        updatedAt: Date.now(),
      };

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        saveNoteToLocal(updated);
      }, 1000);
    }
  };

  // POST note preference changes back to mongoDB upon closing the NoteModal
  const handleCloseNoteModal = async () => {
    if (selectedNote) {
      const finalNote = {
        ...selectedNote,
        noteText: noteInputText,
        updatedAt: Date.now(),
      };

      // Perform final immediate write
      await saveNoteToLocal(finalNote);

      // POST to backend database bookmarks
      try {
        await saveBookmark({
          type: 'quran',
          refId: finalNote.refId,
          arabicText: finalNote.arabicText,
          translation: `[Note]: ${finalNote.noteText}`,
          reference: finalNote.reference,
        });
      } catch (err) {
        console.warn('Failed to sync updated note to server:', err);
      }
    }
    setNoteModalVisible(false);
    setSelectedNote(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Companion</Text>
        <View style={styles.placeholderIcon} />
      </View>

      {/* 1. Custom Top Tab Switcher */}
      <View style={styles.tabContainer}>
        {(['Bookmarks', 'Notes'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. Interactive Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.text3} style={styles.searchIcon} />
          <TextInput
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            placeholderTextColor={COLORS.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={COLORS.text3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. Sort Selector Row */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortPills}>
          {(['Date saved', 'Surah order', 'Most recent'] as SortOption[]).map((option) => {
            const active = sortOption === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.sortPill, active && styles.sortPillActive]}
                onPress={() => setSortOption(option)}
              >
                <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List content segments */}
      {loading || quran.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Syncing logs...</Text>
        </View>
      ) : activeTab === 'Bookmarks' ? (
        <FlatList
          data={getFilteredBookmarks()}
          keyExtractor={(item) => item.refId}
          contentContainerStyle={styles.listPadding}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          ListEmptyComponent={
            <EmptyState
              iconName="bookmark-outline"
              title="No Bookmarks Found"
              subtitle="Hold down any verse in the reader screen to bookmark it instantly."
            />
          }
          renderItem={({ item }) => (
            <BookmarkItem
              item={item}
              screenWidth={SCREEN_WIDTH}
              onNavigate={handleNavigateToVerse}
              onRemove={(refId) => quran.removeBookmark(refId)}
            />
          )}
        />
      ) : (
        <FlatList
          data={getFilteredNotes()}
          keyExtractor={(item) => item.refId}
          contentContainerStyle={styles.listPadding}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          ListEmptyComponent={
            <EmptyState
              iconName="create-outline"
              title="No Study Notes Saved"
              subtitle="Notes can be added to any verse inside the reader options."
            />
          }
          renderItem={({ item }) => (
            <NoteCardItem
              item={item}
              onOpen={handleOpenNoteEditor}
              onDelete={handleDeleteNote}
              onNavigate={handleNavigateToVerse}
            />
          )}
        />
      )}

      {/* 4. Full Screen dark-mode Rich NoteComposer Modal */}
      {selectedNote && (
        <Modal
          animationType="slide"
          visible={noteModalVisible}
          onRequestClose={handleCloseNoteModal}
        >
          <SafeAreaView style={styles.modalWorkspace} edges={['left', 'right', 'top', 'bottom']}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reflections Composer</Text>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleCloseNoteModal}>
                <Text style={styles.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} keyboardShouldPersistTaps="handled">
              {/* Verse citation badge */}
              <View style={styles.modalBadgeRow}>
                <GoldBadge text={selectedNote.reference} />
              </View>

              {/* Original Amiri Arabic scripture */}
              <View style={styles.modalArabicCard}>
                <ArabicText text={selectedNote.arabicText} size={22} style={styles.modalArabicText} />
              </View>

              {/* Reflections multiline input */}
              <Text style={styles.composerHeading}>JOURNAL & NOTES</Text>
              <TextInput
                placeholder="Write your spiritual connection, lessons, or notes here..."
                placeholderTextColor={COLORS.text3}
                multiline
                value={noteInputText}
                onChangeText={handleNoteTextChange}
                style={styles.composerInput}
                textAlignVertical="top"
                autoFocus
              />
            </ScrollView>

            {/* Auto-save visual footer indicator */}
            <View style={styles.autoSaveRow}>
              <Ionicons name="cloud-done" size={16} color={COLORS.teal} />
              <Text style={styles.autoSaveText}>Real-time auto-saving... (AsyncStorage)</Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

interface BookmarkItemProps {
  item: any;
  screenWidth: number;
  onNavigate: (refId: string) => void;
  onRemove: (refId: string) => void;
}

const BookmarkItem = React.memo<BookmarkItemProps>(({
  item,
  screenWidth,
  onNavigate,
  onRemove,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={screenWidth - 40}
      decelerationRate="fast"
      contentContainerStyle={styles.swipeRow}
    >
      {/* Foreground Card */}
      <TouchableOpacity
        style={[styles.bookmarkCard, { width: screenWidth - 40 }]}
        onPress={() => onNavigate(item.refId)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <GoldBadge text={item.reference} />
          <Ionicons name="bookmark" size={16} color={COLORS.gold} />
        </View>
        <ArabicText text={item.arabicText} size={18} style={styles.arabicSnippet} />
        <Text numberOfLines={2} style={styles.translationSnippet}>
          {item.translation}
        </Text>
      </TouchableOpacity>

      {/* Background revealed Swipe Actions button */}
      <TouchableOpacity
        style={styles.deleteSwipeBtn}
        onPress={() => onRemove(item.refId)}
      >
        <Ionicons name="trash" size={20} color="#FFFFFF" />
        <Text style={styles.deleteSwipeBtnText}>Remove</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}, (prev, next) => {
  return (
    prev.item.refId === next.item.refId &&
    prev.item.arabicText === next.item.arabicText &&
    prev.item.translation === next.item.translation &&
    prev.item.reference === next.item.reference &&
    prev.screenWidth === next.screenWidth
  );
});

interface NoteCardItemProps {
  item: any;
  onOpen: (item: any) => void;
  onDelete: (refId: string) => void;
  onNavigate: (refId: string) => void;
}

const NoteCardItem = React.memo<NoteCardItemProps>(({
  item,
  onOpen,
  onDelete,
  onNavigate,
}) => {
  return (
    <Card style={styles.noteCard}>
      <View style={styles.noteHeader}>
        <GoldBadge text={item.reference} style={styles.noteBadge} />
        <View style={styles.noteActionsRow}>
          <TouchableOpacity
            onPress={() => onOpen(item)}
            style={styles.noteHeaderAction}
          >
            <Ionicons name="create" size={18} color={COLORS.teal} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item.refId)}
            style={styles.noteHeaderAction}
          >
            <Ionicons name="trash" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>

      <ArabicText text={item.arabicText} size={18} style={styles.arabicSnippet} />

      <TouchableOpacity
        onPress={() => onOpen(item)}
        style={styles.noteTextBox}
      >
        <Text style={styles.noteContentLabel}>YOUR STUDY NOTE:</Text>
        <Text style={styles.noteTextBody}>{item.noteText || 'Write your spiritual reflections here...'}</Text>
      </TouchableOpacity>

      <View style={styles.noteFooter}>
        <TouchableOpacity
          style={styles.readVerseBtn}
          onPress={() => onNavigate(item.refId)}
        >
          <Text style={styles.readVerseText}>Go to Verse →</Text>
        </TouchableOpacity>
        <Text style={styles.noteDate}>
          Updated {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
    </Card>
  );
}, (prev, next) => {
  return (
    prev.item.refId === next.item.refId &&
    prev.item.arabicText === next.item.arabicText &&
    prev.item.noteText === next.item.noteText &&
    prev.item.reference === next.item.reference &&
    prev.item.updatedAt === next.item.updatedAt
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(201, 168, 76, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholderIcon: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg2,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: COLORS.bg3,
  },
  tabText: {
    color: COLORS.text3,
    fontSize: 13,
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: COLORS.gold,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  sortLabel: {
    fontSize: 11,
    color: COLORS.text3,
    fontWeight: 'bold',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  sortPills: {
    alignItems: 'center',
  },
  sortPill: {
    backgroundColor: COLORS.bg2,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  sortPillActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  sortPillText: {
    fontSize: 11,
    color: COLORS.text2,
    fontWeight: '600',
  },
  sortPillTextActive: {
    color: COLORS.gold,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text3,
    marginTop: 10,
    fontSize: 13,
    fontWeight: 'bold',
  },
  listPadding: {
    paddingTop: 12,
    paddingBottom: 60,
  },
  swipeRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  bookmarkCard: {
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(201, 168, 76, 0.15)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  arabicSnippet: {
    color: '#FFFFFF',
    lineHeight: 34,
    textAlign: 'right',
    marginBottom: 8,
  },
  translationSnippet: {
    fontSize: 12,
    color: COLORS.text2,
    lineHeight: 17,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  deleteSwipeBtn: {
    backgroundColor: '#FF3B30',
    width: 80,
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteSwipeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  noteCard: {
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 12,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.25)', // beautiful gold amber-tinted borders
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteBadge: {
    backgroundColor: 'rgba(201, 168, 76, 0.12)',
  },
  noteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteHeaderAction: {
    padding: 4,
    marginLeft: 12,
  },
  noteTextBox: {
    backgroundColor: 'rgba(201, 168, 76, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    borderRadius: 6,
    padding: 12,
    marginVertical: 12,
  },
  noteContentLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.gold,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  noteTextBody: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.bg3,
    paddingTop: 12,
    marginTop: 4,
  },
  readVerseBtn: {
    paddingVertical: 4,
  },
  readVerseText: {
    color: COLORS.teal,
    fontSize: 12,
    fontWeight: 'bold',
  },
  noteDate: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: '600',
  },
  modalWorkspace: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(201,168,76,0.15)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
  },
  modalSaveText: {
    color: COLORS.bg,
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalBadgeRow: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalArabicCard: {
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
    padding: 20,
    marginBottom: 20,
  },
  modalArabicText: {
    color: '#FFFFFF',
    lineHeight: 44,
    textAlign: 'center',
  },
  composerHeading: {
    fontSize: 11,
    color: COLORS.text3,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  composerInput: {
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 180,
    lineHeight: 20,
  },
  autoSaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.bg3,
  },
  autoSaveText: {
    fontSize: 11,
    color: COLORS.text3,
    marginLeft: 6,
    fontWeight: 'bold',
  },
});
