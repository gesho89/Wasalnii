import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const MENU_ITEMS = [
  { icon: 'account-circle', label: 'تعديل الملف الشخصي', color: Colors.primary },
  { icon: 'history', label: 'سجل الرحلات', color: Colors.success, route: '/(tabs)/trips' },
  { icon: 'account-balance-wallet', label: 'المحفظة', color: Colors.accent, route: '/(tabs)/wallet' },
  { icon: 'star', label: 'تقييماتي', color: Colors.warning },
  { icon: 'report-problem', label: 'الشكاوى', color: Colors.error, route: '/complaints' },
  { icon: 'emoji-events', label: 'نقاط المكافآت', color: Colors.accent, route: '/rewards' },
  { icon: 'drive-eta', label: 'لوحة السائق', color: '#8B5CF6', route: '/driver-dashboard' },
  { icon: 'app-registration', label: 'سجل كسائق', color: '#10B981', route: '/driver-register' },
  { icon: 'help-outline', label: 'المساعدة والدعم', color: Colors.info },
  { icon: 'privacy-tip', label: 'سياسة الخصوصية', color: Colors.textSecondary },
  { icon: 'settings', label: 'الإعدادات', color: Colors.textSecondary, route: '/settings' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { showAlert } = useAlert();
  const [tripCount, setTripCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) { setRefreshing(false); return; }
    try {
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'completed');
      setTripCount(count ?? 0);
    } catch {
      setTripCount(0);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleLogout = () => {
    showAlert('تسجيل الخروج', 'هل تريد تسجيل الخروج من الحساب؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const handleMenuPress = (item: typeof MENU_ITEMS[0]) => {
    if (item.route) {
      router.push(item.route as any);
    } else {
      showAlert('قريباً', 'هذه الميزة ستكون متاحة قريباً');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.profileHeader}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={user?.avatar
                ? { uri: user.avatar }
                : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face' }
              }
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => showAlert('قريباً', 'تحديث الصورة الشخصية سيكون متاحاً قريباً')}>
              <MaterialIcons name="camera-alt" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name ?? 'مستخدم تك توكي'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'الرحلات', value: tripCount > 0 ? tripCount.toString() : '0', icon: 'directions-car' },
            { label: 'التقييم', value: '4.8', icon: 'star' },
            { label: 'المحفظة', value: '0 ج', icon: 'account-balance-wallet' },
          ].map((stat, i) => (
            <View key={i} style={styles.statItem}>
              <MaterialIcons name={stat.icon as any} size={20} color={Colors.accent} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Menu */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStats(); }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                <MaterialIcons name={item.icon as any} size={20} color={item.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <Text style={styles.version}>الإصدار 1.0.0 · تك توكي</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  profileHeader: { paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatarWrapper: { position: 'relative', marginBottom: Spacing.sm },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.accent },
  editAvatarBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgNavy,
  },
  userName: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  userEmail: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, marginTop: 2 },
  userPhone: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, marginTop: 2 },
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: Typography.lg, fontFamily: 'Tajawal_700Bold' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs },
  menuScroll: { flex: 1 },
  menuCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    margin: Spacing.md, ...Shadows.sm, marginTop: -Spacing.md,
  },
  menuItem: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontFamily: 'Tajawal_500Medium' },
  logoutBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: Spacing.md, backgroundColor: Colors.error + '12',
    borderRadius: BorderRadius.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  logoutText: { fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', color: Colors.error },
  version: { textAlign: 'center', color: Colors.textLight, fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular', marginTop: Spacing.md },
});
