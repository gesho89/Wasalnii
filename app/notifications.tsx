import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DBNotification {
  id: string;
  user_id: string;
  type: 'trip' | 'offer' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  data?: any;
  created_at: string;
}

type TabKey = 'all' | 'trip' | 'offer' | 'system';

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: 'all',    label: 'الكل',    icon: 'notifications',    color: Colors.accent },
  { key: 'trip',   label: 'الرحلات', icon: 'directions-car',   color: Colors.primary },
  { key: 'offer',  label: 'العروض',  icon: 'local-offer',      color: '#10B981' },
  { key: 'system', label: 'النظام',  icon: 'settings',         color: '#8B5CF6' },
];

function getTypeConfig(type: string) {
  switch (type) {
    case 'trip':   return { icon: 'directions-car', color: Colors.primary,  bg: Colors.primary + '15' };
    case 'offer':  return { icon: 'local-offer',    color: '#10B981',       bg: '#10B98115' };
    case 'system': return { icon: 'info',           color: '#8B5CF6',       bg: '#8B5CF615' };
    default:       return { icon: 'notifications',  color: Colors.accent,   bg: Colors.accent + '15' };
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60)  return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function NotifSkeleton() {
  return (
    <View style={skStyles.card}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={skStyles.row}>
          <View style={skStyles.icon} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[skStyles.line, { width: '55%' }]} />
            <View style={[skStyles.line, { width: '80%', height: 10 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: { gap: 4, paddingHorizontal: Spacing.md },
  row: {
    flexDirection: 'row-reverse', gap: 12, alignItems: 'center',
    backgroundColor: '#1A2235', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  line: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { showAlert } = useAlert();

  const [notifications, setNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const supabase = getSupabaseClient();

  // ── Load notifications ──
  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!error && data) {
        // If no real notifications exist, seed mock ones for this user
        if (data.length === 0) {
          await seedMockNotifications(user.id);
          const { data: seeded } = await supabase
            .from('notifications').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }).limit(60);
          setNotifications((seeded as DBNotification[]) ?? []);
        } else {
          setNotifications(data as DBNotification[]);
        }
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  const seedMockNotifications = async (userId: string) => {
    const now = new Date();
    const mock = [
      { user_id: userId, type: 'trip',   title: 'تم قبول رحلتك',         message: 'السائق محمد في طريقه إليك ✓',                  is_read: false, created_at: new Date(now.getTime() - 5*60000).toISOString() },
      { user_id: userId, type: 'offer',  title: 'عرض خاص لك 🎁',         message: 'احصل على خصم 20% على رحلتك القادمة',           is_read: false, created_at: new Date(now.getTime() - 30*60000).toISOString() },
      { user_id: userId, type: 'system', title: 'مرحباً بك في تك توكي',  message: 'يسعدنا انضمامك لعائلة تك توكي!',               is_read: true,  created_at: new Date(now.getTime() - 2*3600000).toISOString() },
      { user_id: userId, type: 'trip',   title: 'اكتملت رحلتك بنجاح',    message: 'شكراً لاستخدامك تك توكي. قيّم تجربتك!',        is_read: true,  created_at: new Date(now.getTime() - 24*3600000).toISOString() },
      { user_id: userId, type: 'offer',  title: 'كوبون خصم جديد',         message: 'استخدم كود TUKTUKY10 للحصول على خصم 10 ج.م',  is_read: true,  created_at: new Date(now.getTime() - 48*3600000).toISOString() },
      { user_id: userId, type: 'system', title: 'تحديث التطبيق',           message: 'تم إصدار نسخة جديدة من تك توكي بميزات محسّنة', is_read: true,  created_at: new Date(now.getTime() - 72*3600000).toISOString() },
    ];
    await supabase.from('notifications').insert(mock);
  };

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // ── Mark one as read ──
  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  // ── Mark all as read ──
  const markAllRead = async () => {
    if (!user?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    showAlert('تم', 'تم تحديد جميع الإشعارات كمقروءة');
  };

  // ── Clear all ──
  const clearAll = () => {
    showAlert('حذف الإشعارات', 'هل تريد حذف جميع الإشعارات؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف الكل', style: 'destructive',
        onPress: async () => {
          if (!user?.id) return;
          setNotifications([]);
          await supabase.from('notifications').delete().eq('user_id', user.id);
        },
      },
    ]);
  };

  // ── Filtered ──
  const filtered = notifications.filter(n => activeTab === 'all' || n.type === activeTab);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const tabCount = (key: TabKey) =>
    key === 'all' ? notifications.filter(n => !n.is_read).length
    : notifications.filter(n => n.type === key && !n.is_read).length;

  // ── Render item ──
  const renderItem = ({ item }: { item: DBNotification }) => {
    const cfg = getTypeConfig(item.type);
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
        onPress={() => markRead(item.id)}
        activeOpacity={0.85}
      >
        {/* Unread indicator */}
        {!item.is_read && <View style={styles.unreadBar} />}

        {/* Type Icon */}
        <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={styles.notifBody}>
          <View style={styles.notifTopRow}>
            <Text style={styles.notifTime}>{formatDate(item.created_at)}</Text>
            {!item.is_read && (
              <View style={styles.unreadDot} />
            )}
          </View>
          <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <LinearGradient colors={['#0D0D0D', '#1A1400']} style={styles.header}>
        <View style={styles.headerRow}>
          {/* Actions */}
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead} activeOpacity={0.8}>
                <MaterialIcons name="done-all" size={14} color={Colors.accent} />
                <Text style={styles.markAllText}>قراءة الكل</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.8}>
              <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          </View>

          {/* Title + Badge */}
          <View style={styles.titleWrap}>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <Text style={styles.headerTitle}>الإشعارات</Text>
          </View>

          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── Type Tabs ── */}
        <View style={styles.tabsRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const cnt = tabCount(tab.key);
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={14}
                  color={isActive ? Colors.bgDark : 'rgba(255,255,255,0.45)'}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                {cnt > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{cnt}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* ── List ── */}
      {loading ? (
        <NotifSkeleton />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadNotifications(); }}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient colors={['rgba(232,160,32,0.1)', 'rgba(232,160,32,0.02)']} style={styles.emptyGrad}>
                <MaterialIcons name="notifications-none" size={50} color="rgba(232,160,32,0.35)" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'all' ? 'ستظهر إشعاراتك هنا' : `لا توجد إشعارات في قسم "${TABS.find(t => t.key === activeTab)?.label}"`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // Header
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: Typography.xxl, fontFamily: 'Tajawal_800ExtraBold' },
  unreadBadge: {
    backgroundColor: Colors.error, borderRadius: BorderRadius.full,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Tajawal_700Bold' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  markAllBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,208,80,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },
  markAllText: { color: Colors.accent, fontSize: 11, fontFamily: 'Tajawal_700Bold' },
  clearBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.error + '12', alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: Spacing.sm },
  tab: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  tabTextActive: { color: Colors.bgDark, fontFamily: 'Tajawal_700Bold' },
  tabBadge: {
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  tabBadgeActive: { backgroundColor: 'rgba(0,0,0,0.25)' },
  tabBadgeText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontFamily: 'Tajawal_700Bold' },
  tabBadgeTextActive: { color: Colors.bgDark },

  // List
  list: { padding: Spacing.md, gap: Spacing.xs, paddingBottom: 40 },

  // Notification Card
  notifCard: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#1A2235', borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    position: 'relative', overflow: 'hidden',
  },
  notifCardUnread: {
    borderColor: 'rgba(255,208,80,0.2)',
    backgroundColor: 'rgba(26,34,53,0.98)',
  },
  unreadBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: Colors.accent, borderTopLeftRadius: BorderRadius.xl, borderBottomLeftRadius: BorderRadius.xl,
  },
  notifIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifBody: { flex: 1 },
  notifTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  notifTime: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Tajawal_400Regular' },
  notifTitle: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.base, fontFamily: 'Tajawal_700Bold', textAlign: 'right', marginBottom: 4 },
  notifTitleUnread: { color: '#fff' },
  notifMessage: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', textAlign: 'right', lineHeight: 20 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: Spacing.xl },
  emptyGrad: { borderRadius: 50, padding: 24, marginBottom: 8 },
  emptyTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_700Bold' },
  emptySub: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', textAlign: 'center', lineHeight: 22 },
});
