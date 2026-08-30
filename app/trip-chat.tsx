import React, { useState, useEffect, useRef, useCallback, AppState, AppStateStatus } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  AppState as RNAppState,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { scheduleLocalNotification } from '@/services/pushNotifications';

// Quick-reply suggestions
const QUICK_REPLIES = [
  'أنا في الطريق',
  'وصلت إلى الموقع',
  'انتظرني دقيقة',
  'أين أنت بالضبط؟',
  'شكراً!',
];

interface Message {
  id: string;
  trip_id: string;
  sender_id: string;
  sender_role: 'rider' | 'driver';
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function TripChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const supabase = getSupabaseClient();

  const { tripId, driverName, role } = useLocalSearchParams<{
    tripId: string;
    driverName?: string;
    role?: 'rider' | 'driver';
  }>();

  const senderRole = role ?? 'rider';
  const otherName = senderRole === 'rider' ? (driverName ?? 'السائق') : 'الراكب';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageRef = useRef<string | null>(null);

  const appStateRef = useRef<AppStateStatus>('active');
  const unreadSinceLeaveRef = useRef<string[]>([]); // message ids notified
  const hasMarkedReadRef = useRef(false);

  // ── Mark incoming messages as read ──────────────────────────────
  const markMessagesAsRead = useCallback(async () => {
    if (!tripId || !user?.id) return;
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('trip_id', tripId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch { /* silent */ }
  }, [tripId, user?.id]);

  // ── Track app foreground/background ────────────────────────────
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (state: AppStateStatus) => {
      appStateRef.current = state;
      if (state === 'active') {
        // Clear unread when user comes back
        unreadSinceLeaveRef.current = [];
        markMessagesAsRead();
      }
    });
    return () => sub.remove();
  }, [markMessagesAsRead]);

  // ── Fetch messages ──────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!tripId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !data) return;

      // Only update state if new messages arrived
      const latestId = data[data.length - 1]?.id ?? null;
      if (latestId !== lastMessageRef.current) {
        lastMessageRef.current = latestId;

        // Check for new messages from the other party while app is backgrounded
        if (appStateRef.current !== 'active' && data.length > 0) {
          const newFromOther = data.filter(
            m => m.sender_id !== user?.id &&
              !unreadSinceLeaveRef.current.includes(m.id)
          );
          if (newFromOther.length > 0) {
            unreadSinceLeaveRef.current.push(...newFromOther.map(m => m.id));
            try {
              scheduleLocalNotification(
                `رسالة جديدة من ${otherName}`,
                newFromOther[newFromOther.length - 1].content,
              );
            } catch { /* silent */ }
          }
        }

        setMessages(data);
        // Scroll to bottom
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        // Mark messages as read on first load and on each refresh while active
        if (!hasMarkedReadRef.current || appStateRef.current === 'active') {
          hasMarkedReadRef.current = true;
          markMessagesAsRead();
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [tripId, user?.id, otherName]);

  // ── Poll every 3 seconds ────────────────────────────────────────
  useEffect(() => {
    fetchMessages();
    // Mark as read immediately on mount
    markMessagesAsRead();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages, markMessagesAsRead]);

  // ── Send message ────────────────────────────────────────────────
  const handleSend = async (text: string) => {
    const content = text.trim();
    if (!content || !tripId || !user?.id) return;

    setSending(true);
    setInput('');

    // Optimistic update
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      trip_id: tripId,
      sender_id: user.id,
      sender_role: senderRole,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const { error } = await supabase.from('messages').insert({
        trip_id: tripId,
        sender_id: user.id,
        sender_role: senderRole,
        content,
      });

      if (error) {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      } else {
        // Refresh to get real id
        await fetchMessages();
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  // ── Render message bubble ───────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const showHeader = !prev || prev.sender_id !== item.sender_id;
    // For sent messages: double-tick (blue) if read, double-tick (gray) if delivered, single-tick if temp
    const isTemp = item.id.startsWith('tmp-');

    return (
      <View style={[
        styles.msgWrapper,
        isMine ? styles.msgWrapperRight : styles.msgWrapperLeft,
      ]}>
        {showHeader && !isMine && (
          <Text style={styles.msgSenderLabel}>{otherName}</Text>
        )}
        <View style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
        ]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
            {item.content}
          </Text>
        </View>
        <View style={[styles.msgMeta, isMine ? styles.msgMetaRight : styles.msgMetaLeft]}>
          <Text style={[styles.msgTime]}>
            {formatTime(item.created_at)}
          </Text>
          {isMine && (
            <View style={styles.ticksWrap}>
              {isTemp ? (
                // Sending: single clock tick
                <MaterialIcons name="access-time" size={11} color="rgba(255,255,255,0.55)" />
              ) : item.is_read ? (
                // Read: double tick in blue
                <View style={styles.doubleTick}>
                  <MaterialIcons name="done" size={13} color="#4FC3F7" style={styles.tick1} />
                  <MaterialIcons name="done" size={13} color="#4FC3F7" style={styles.tick2} />
                </View>
              ) : (
                // Delivered: double tick in gray
                <View style={styles.doubleTick}>
                  <MaterialIcons name="done" size={13} color="rgba(255,255,255,0.6)" style={styles.tick1} />
                  <MaterialIcons name="done" size={13} color="rgba(255,255,255,0.6)" style={styles.tick2} />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherName}</Text>
          <View style={styles.headerOnline}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerStatus}>متاح الآن</Text>
          </View>
        </View>
        <View style={styles.headerIcon}>
          <MaterialIcons name="chat" size={20} color={Colors.accent} />
        </View>
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={56} color={Colors.borderLight} />
              <Text style={styles.emptyText}>لا توجد رسائل بعد</Text>
              <Text style={styles.emptySubText}>ابدأ المحادثة مع {otherName}</Text>
            </View>
          }
        />
      )}

      {/* Quick Replies */}
      <View style={styles.quickReplies}>
        <FlatList
          horizontal
          data={QUICK_REPLIES}
          keyExtractor={r => r}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRepliesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quickReplyChip}
              onPress={() => handleSend(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.quickReplyText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend(input)}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="اكتب رسالة..."
          placeholderTextColor={Colors.textLight}
          textAlign="right"
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => handleSend(input)}
          blurOnSubmit={false}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  headerOnline: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  headerStatus: { color: Colors.success, fontSize: Typography.xs, fontWeight: '600' },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accent + '20', alignItems: 'center', justifyContent: 'center',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: Spacing.md, gap: Spacing.xs, paddingBottom: Spacing.xl },
  msgWrapper: { marginVertical: 3 },
  msgWrapperRight: { alignItems: 'flex-start' },
  msgWrapperLeft: { alignItems: 'flex-end' },
  msgSenderLabel: {
    fontSize: Typography.xs, color: Colors.textSecondary,
    marginBottom: 3, fontWeight: '600', textAlign: 'right',
  },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.bgWhite,
    borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  bubbleText: { fontSize: Typography.base, lineHeight: 22 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextOther: { color: Colors.textPrimary },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  msgMetaRight: { alignSelf: 'flex-start' },
  msgMetaLeft: { alignSelf: 'flex-end' },
  msgTime: { fontSize: 10, color: Colors.textLight },
  ticksWrap: { flexDirection: 'row', alignItems: 'center' },
  doubleTick: { flexDirection: 'row', alignItems: 'center', width: 18, position: 'relative' },
  tick1: { position: 'absolute', left: 0 },
  tick2: { position: 'absolute', left: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  emptyText: { fontSize: Typography.lg, color: Colors.textSecondary, fontWeight: '700' },
  emptySubText: { fontSize: Typography.sm, color: Colors.textLight },
  quickReplies: {
    backgroundColor: Colors.bgWhite,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  quickRepliesList: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 7, flexDirection: 'row',
  },
  quickReplyChip: {
    backgroundColor: Colors.primary + '12', borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  quickReplyText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row-reverse', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: 8,
    backgroundColor: Colors.bgWhite,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    ...Shadows.sm,
  },
  input: {
    flex: 1, backgroundColor: Colors.bgLight, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: Typography.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.borderLight,
    maxHeight: 100, minHeight: 42,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
});
