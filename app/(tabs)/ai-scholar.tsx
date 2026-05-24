import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { askScholar } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AIScholarScreen() {
  const isFocused = useIsFocused();
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    if (isFocused && !hasRendered) {
      // Small frame delay to ensure tab animation completes smoothly
      const timer = setTimeout(() => setHasRendered(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isFocused, hasRendered]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Assalamu Alaikum. I am your Senior Islamic Scholar AI advisor for Noor360. You may inquire about classic jurisprudence, Quranic context, or moral values. How can I help you today?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!hasRendered) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Map current conversation history to backend format
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Call central HTTP client
      const reply = await askScholar(history);

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: err.message || 'Apologies, but the Scholar AI connection was disrupted. Please verify your internet or try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI Scholar</Text>
          <Text style={styles.subtitle}>Compassionate and balanced Islamic guidance</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatScroll}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((item) => (
            <View
              key={item.id}
              style={[
                styles.messageRow,
                item.role === 'user' ? styles.userRow : styles.assistantRow,
              ]}
            >
              {item.role === 'assistant' && (
                <View style={styles.avatar}>
                  <Ionicons name="ribbon-outline" size={18} color={COLORS.gold} />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.role === 'user' ? styles.userText : styles.assistantText,
                  ]}
                >
                  {item.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageRow, styles.assistantRow]}>
              <View style={styles.avatar}>
                <Ionicons name="ribbon-outline" size={18} color={COLORS.gold} />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, styles.loadingBubble]}>
                <ActivityIndicator size="small" color={COLORS.teal} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          <TextInput
            placeholder="Inquire with the AI Scholar..."
            placeholderTextColor={COLORS.text3}
            value={inputText}
            onChangeText={setInputText}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.disabledSendBtn]}
            onPress={handleSend}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color={inputText.trim() ? COLORS.bg : COLORS.text3} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text2,
    marginTop: 4,
  },
  chatScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
  },
  assistantRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: COLORS.teal,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.bg2,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  loadingBubble: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: COLORS.bg,
    fontWeight: '600',
  },
  assistantText: {
    color: COLORS.text,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.bg2,
    borderTopWidth: 1,
    borderTopColor: COLORS.bg3,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  disabledSendBtn: {
    backgroundColor: COLORS.bg3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
