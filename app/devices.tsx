import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Platform,
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
import * as Device from 'expo-device';

interface DeviceSession {
  id: string;
  user_id: string;
  device_name: string;
  os_name: string;
  os_version?: string;
  app_version?: string;
  ip_address?: string;
  is_current: boolean;
  last_active: string;
  created_at: string;
}

function getOsIcon(os: string) {
  const l = os.toLowerCase();
  if (l.includes('ios') || l.includes('iphone') || l.includes('ipad')) return 'phone-iphone';
  if (l.includes('android')) return 'phone-android';
  if (l.includes('windows')) return 'desktop-windows';
  if (l.includes('mac')) return 'laptop-mac';
  return 'devices';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 86400 * 7) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function DeviceSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={sk.card}>
          <View style={sk.icon} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[sk.line, { width: '55%' }]} />
            <View style={[sk.line, { width: '75%', height: 10 }]} />
            <View style={[sk.line, { width: '40%', height: 10 }]} />
          </View>
          <View style={[sk.btn]} />
        </View>
      ))}
    </View>
  );
}
const sk = StyleSheet.create({
  card: { flexDirection: 'row-reverse', gap: 12, alignItems: 'center', backgroundColor: '#1A2235', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  icon: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)' },
  line: { height: 13, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)' },
  btn: { width: 72, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DevicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthContext();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // ── Register current device on mount ──
  const registerCurrentDevice = async () => {
    if (!user?.id) return;
    const deviceName = Device.deviceName ?? `${Platform.OS} جهاز`;
    const osName = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
    const osVersion = Platform.Version?.toString() ?? '';

    // Upsert current device by checking for existing current session
    const { data: existing } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single();

    if (existing) {
      await supabase.from('user_sessions').update({
        device_name: deviceName,
        os_name: osName,
        os_version: osVersion,
        app_version: '1.0.0',
        last_active: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        device_name: deviceName,
        os_name: osName,
        os_version: osVersion,
        app_version: '1.0.0',
        is_current: true,
        last_active: new Date().toISOString(),
      });
    }
  };

  const loadSessions = useCallback(async () => {
    if (!user?.id) { setLoading(false); setRefreshing(false); return; }
    try {
      await registerCurrentDevice();
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active', { ascending: false });

      if (!error && data) setSessions(data as DeviceSession[]);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Revoke session ──
  const revokeSession = (session: DeviceSession) => {
    if (session.is_current) {
      showAlert('تسجيل الخروج', 'هل تريد تسجيل الخروج من هذا الجهاز الحالي؟', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'خروج', style: 'destructive',
          onPress: async () => {
            await supabase.from('user_sessions').delete().eq('id', session.id);
            await logout();
            router.replace('/');
          },
        },
      ]);
      return;
    }

    showAlert(
      'إلغاء جلسة الجهاز',
      `إلغاء جلسة "${session.device_name}"؟ سيحتاج المستخدم لتسجيل الدخول مجدداً على ذلك الجهاز.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الجلسة', style: 'destructive',
          onPress: async () => {
            setRevoking(session.id);
            try {
              await supabase.from('user_sessions').delete().eq('id', session.id);
              setSessions(prev => prev.filter(s => s.id !== session.id));
              showAlert('تم', 'تم إلغاء جلسة الجهاز بنجاح');
            } catch (e: any) {
              showAlert('خطأ', e.message ?? 'حدث خطأ');
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  // ── Revoke all other ──
  const revokeAllOthers = () => {
    const others = sessions.filter(s => !s.is_current);
    if (others.length === 0) { showAlert('تنبيه', 'لا توجد أجهزة أخرى مسجّلة'); return; }
    showAlert(
      'إلغاء جميع الأجهزة الأخرى',
      `سيتم إلغاء جلسات ${others.length} جهاز آخر. هل تريد المتابعة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الكل', style: 'destructive',
          onPress: async () => {
            const ids = others.map(s => s.id);
            await supabase.from('user_sessions').delete().in('id', ids);
            setSessions(prev => prev.filter(s => s.is_current));
            showAlert('تم', 'تم إلغاء جميع الجلسات الأخرى');
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: DeviceSession }) => {
    const osIcon = getOsIcon(item.os_name);
    const isRevoking = revoking === item.id;

    return (
      <View style={[styles.deviceCard, item.is_current && styles.deviceCardCurrent]}>
        {item.is_current && <View style={styles.currentBar} />}

        {/* OS Icon */}
        <View style={[styles.deviceIcon, { backgroundColor: item.is_current ? Colors.primary + '18' : 'rgba(255,255,255,0.07)' }]}>
          <MaterialIcons name={osIcon as any} size={26} color={item.is_current ? Colors.primary : 'rgba(255,255,255,0.5)'} />
        </View>

        {/* Info */}
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            {item.is_current && (
              <View style={styles.currentBadge}>
                <View style={styles.currentDot} />
                <Text style={styles.currentBadgeText}>الجهاز الحالي</Text>
              </View>
            )}
            <Text style={styles.deviceName} numberOfLines={1}>{item.device_name}</Text>
          </View>
          <Text style={styles.deviceOs}>{item.os_name} {item.os_version ?? ''}</Text>
          <View style={styles.deviceMeta}>
            <MaterialIcons name="schedule" size={11} color="rgba(255,255,255,0.3)" />
            <Text style={styles.deviceMetaText}>آخر نشاط: {formatDate(item.last_active)}</Text>
            {item.app_version && (
              <>
                <View style={styles.metaSep} />
                <Text style={styles.deviceMetaText}>v{item.app_version}</Text>
              </>
            )}
          </View>
          {item.ip_address && (
            <Text style={styles.deviceIp}>{item.ip_address}</Text>
          )}
        </View>

        {/* Revoke Button */}
        <TouchableOpacity
          style={[styles.revokeBtn, item.is_current && styles.revokeBtnCurrent, isRevoking && { opacity: 0.6 }]}
          onPress={() => revokeSession(item)}
          disabled={isRevoking}
          activeOpacity={0.8}
        >
          {isRevoking ? (
            <ActivityIndicator size="small" color={item.is_current ? Colors.warning : Colors.error} />
          ) : (
            <>
              <MaterialIcons
                name={item.is_current ? 'logout' : 'close'}
                size={14}
                color={item.is_current ? Colors.warning : Colors.error}
              />
              <Text style={[styles.revokeBtnText, item.is_current && styles.revokeBtnTextCurrent]}>
                {item.is_current ? 'خروج' : 'إلغاء'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const otherCount = sessions.filter(s => !s.is_current).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <LinearGradient colors={['#0D0D0D', '#1A1400']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerRight}>
            {otherCount > 0 && (
              <TouchableOpacity style={styles.revokeAllBtn} onPress={revokeAllOthers} activeOpacity={0.8}>
                <MaterialIcons name="devices-off" size={13} color={Colors.error} />
                <Text style={styles.revokeAllText}>إلغاء الكل</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle}>الأجهزة المسجّلة</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{sessions.length}</Text>
            <Text style={styles.summaryLabel}>إجمالي الأجهزة</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: Colors.success }]}>1</Text>
            <Text style={styles.summaryLabel}>الجهاز الحالي</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: otherCount > 0 ? Colors.warning : Colors.textSecondary }]}>
              {otherCount}
            </Text>
            <Text style={styles.summaryLabel}>أجهزة أخرى</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Security Note */}
      <View style={styles.securityNote}>
        <LinearGradient colors={['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.04)']} style={styles.securityNoteGrad}>
          <MaterialIcons name="security" size={18} color="#3B82F6" />
          <Text style={styles.securityNoteText}>
            إذا رأيت جهازاً لا تعرفه، قم بإلغاء جلسته فوراً وغيّر كلمة المرور
          </Text>
        </LinearGradient>
      </View>

      {loading ? (
        <DeviceSkeleton />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSessions(); }}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient colors={['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.02)']} style={styles.emptyGrad}>
                <MaterialIcons name="devices" size={48} color="rgba(59,130,246,0.4)" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>لا توجد أجهزة مسجّلة</Text>
              <Text style={styles.emptySub}>سيتم تسجيل هذا الجهاز تلقائياً</Text>
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
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  headerRight: { minWidth: 38, alignItems: 'flex-end' },
  revokeAllBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: Colors.error + '12', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.error + '25',
  },
  revokeAllText: { color: Colors.error, fontSize: 11, fontFamily: 'Tajawal_700Bold' },

  // Summary
  summaryRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
  summaryVal: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  summaryLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'Tajawal_400Regular' },

  // Security note
  securityNote: { marginHorizontal: Spacing.md, marginTop: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden' },
  securityNoteGrad: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8,
    padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
  },
  securityNoteText: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right', lineHeight: 20 },

  // List
  list: { padding: Spacing.md, gap: Spacing.sm },

  // Device Card
  deviceCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: '#1A2235', borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    position: 'relative', overflow: 'hidden',
  },
  deviceCardCurrent: { borderColor: 'rgba(59,130,246,0.25)' },
  currentBar: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.primary, borderTopRightRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl },
  deviceIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  deviceInfo: { flex: 1 },
  deviceNameRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 },
  deviceName: { color: '#fff', fontSize: Typography.base, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  currentBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '18', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '30' },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  currentBadgeText: { color: Colors.primary, fontSize: 10, fontFamily: 'Tajawal_700Bold' },
  deviceOs: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginBottom: 4 },
  deviceMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  deviceMetaText: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'Tajawal_400Regular' },
  metaSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  deviceIp: { color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginTop: 2 },

  // Revoke
  revokeBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: Colors.error + '10', borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.error + '25',
    minWidth: 68, justifyContent: 'center',
  },
  revokeBtnCurrent: { backgroundColor: Colors.warning + '10', borderColor: Colors.warning + '25' },
  revokeBtnText: { color: Colors.error, fontSize: 11, fontFamily: 'Tajawal_700Bold' },
  revokeBtnTextCurrent: { color: Colors.warning },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyGrad: { borderRadius: 50, padding: 22, marginBottom: 8 },
  emptyTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_700Bold' },
  emptySub: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular' },
});
