import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, Platform, KeyboardAvoidingView, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_TRIPS } from '@/services/mockData';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TripItem {
  id: string;
  from_location?: string;
  to_location?: string;
  from?: string;
  to?: string;
  price: number;
  status: string;
  created_at?: string;
  date?: string;
  time?: string;
  distance?: string;
  duration?: string;
  rating?: number;
  driver?: { name: string; vehicle: string; avatar: string; rating: number; id: string; vehicleType: string; trips: number; plate: string };
  driver_id?: string;
}

type FilterKey = 'الكل' | 'جارية' | 'قادمة' | 'مكتملة' | 'ملغاة';

const FILTERS: { key: FilterKey; icon: string; color: string }[] = [
  { key: 'الكل', icon: 'format-list-bulleted', color: Colors.textSecondary },
  { key: 'جارية', icon: 'directions-car', color: Colors.primary },
  { key: 'قادمة', icon: 'schedule', color: '#3B82F6' },
  { key: 'مكتملة', icon: 'check-circle', color: Colors.success },
  { key: 'ملغاة', icon: 'cancel', color: Colors.error },
];

// ─── Rating Modal ─────────────────────────────────────────────────────────────
function TripRatingModal({
  tripId, visible, onClose, onSaved,
}: {
  tripId: string; visible: boolean; onClose: () => void; onSaved: (id: string, stars: number) => void;
}) {
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.from('trips').update({ rating: stars, updated_at: new Date().toISOString() }).eq('id', tripId);
      setDone(true);
      onSaved(tripId, stars);
      setTimeout(onClose, 1200);
    } finally { setSubmitting(false); }
  };

  const ratingLabels = ['', 'سيء جداً 😞', 'سيء 😕', 'مقبول 😐', 'جيد 😊', 'ممتاز! 🤩'];

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={rStyle.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={rStyle.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={rStyle.sheet}>
          {done ? (
            <View style={rStyle.success}>
              <LinearGradient colors={[Colors.success + '25', Colors.success + '05']} style={rStyle.successGrad}>
                <View style={rStyle.successIconWrap}>
                  <MaterialIcons name="check-circle" size={44} color={Colors.success} />
                </View>
              </LinearGradient>
              <Text style={rStyle.successText}>شكراً لتقييمك!</Text>
            </View>
          ) : (
            <>
              <View style={rStyle.handle} />
              <Text style={rStyle.title}>كيف كانت تجربتك؟</Text>
              <Text style={rStyle.subtitle}>قيّم هذه الرحلة لمساعدتنا في تحسين الخدمة</Text>
              <View style={rStyle.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <TouchableOpacity key={i} onPress={() => setStars(i)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} activeOpacity={0.7}>
                    <MaterialIcons
                      name={stars >= i ? 'star' : 'star-outline'}
                      size={46}
                      color={stars >= i ? Colors.accent : 'rgba(255,255,255,0.2)'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <View style={rStyle.ratingLabelWrap}>
                  <Text style={rStyle.ratingLabel}>{ratingLabels[stars]}</Text>
                </View>
              )}
              <View style={rStyle.btnRow}>
                <TouchableOpacity style={rStyle.skipBtn} onPress={onClose}>
                  <Text style={rStyle.skipText}>تخطي</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rStyle.submitBtn, (stars === 0 || submitting) && rStyle.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={stars === 0 || submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={rStyle.submitText}>إرسال التقييم</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Status Config ────────────────────────────────────────────────────────────
function getStatusConfig(status: string) {
  switch (status) {
    case 'completed': return { bg: Colors.success + '18', text: Colors.success, label: 'مكتملة', icon: 'check-circle', dot: Colors.success };
    case 'cancelled': return { bg: Colors.error + '18', text: Colors.error, label: 'ملغاة', icon: 'cancel', dot: Colors.error };
    case 'active': return { bg: Colors.primary + '18', text: Colors.primary, label: 'جارية', icon: 'directions-car', dot: Colors.primary };
    default: return { bg: '#3B82F6' + '18', text: '#3B82F6', label: 'قيد الانتظار', icon: 'schedule', dot: '#3B82F6' };
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('الكل');
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingTripId, setRatingTripId] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!user?.id) {
      setTrips(MOCK_TRIPS as any);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('trips').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50);
      if (error || !data || data.length === 0) {
        setTrips(MOCK_TRIPS as any);
      } else {
        setTrips(data);
      }
    } catch {
      setTrips(MOCK_TRIPS as any);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const filteredTrips = trips.filter(trip => {
    if (activeFilter === 'الكل') return true;
    if (activeFilter === 'مكتملة') return trip.status === 'completed';
    if (activeFilter === 'ملغاة') return trip.status === 'cancelled';
    if (activeFilter === 'جارية') return trip.status === 'active';
    if (activeFilter === 'قادمة') return trip.status === 'pending';
    return true;
  });

  const getFrom = (t: TripItem) => t.from_location ?? t.from ?? '-';
  const getTo = (t: TripItem) => t.to_location ?? t.to ?? '-';
  const getDate = (t: TripItem) => {
    if (t.created_at) return new Date(t.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
    return t.date ?? '-';
  };
  const getTime = (t: TripItem) => {
    if (t.created_at) return new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return t.time ?? '';
  };

  const handleRatingSaved = (tripId: string, stars: number) => {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, rating: stars } : t));
    setRatingTripId(null);
  };

  // ── Summary counts ──
  const counts = {
    all: trips.length,
    active: trips.filter(t => t.status === 'active').length,
    pending: trips.filter(t => t.status === 'pending').length,
    completed: trips.filter(t => t.status === 'completed').length,
    cancelled: trips.filter(t => t.status === 'cancelled').length,
  };

  // ── Trip Card ──
  const renderTrip = ({ item, index }: { item: TripItem; index: number }) => {
    const statusCfg = getStatusConfig(item.status);
    const isCompleted = item.status === 'completed';
    const hasRating = (item.rating ?? 0) > 0;

    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => router.push({ pathname: '/trip-details', params: { id: item.id } } as any)}
        activeOpacity={0.88}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
            <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
          {/* Date & Time */}
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={12} color="rgba(255,255,255,0.35)" />
            <Text style={styles.dateText}>{getTime(item)} · {getDate(item)}</Text>
          </View>
        </View>

        {/* Driver Row */}
        <View style={styles.driverSection}>
          {item.driver ? (
            <Image source={{ uri: item.driver.avatar }} style={styles.driverAvatar} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.driverAvatar, styles.driverAvatarFallback]}>
              <MaterialIcons name="directions-car" size={22} color={Colors.accent} />
            </View>
          )}
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{item.driver?.name ?? 'سائق تك توكي'}</Text>
            <View style={styles.driverMeta}>
              <Text style={styles.vehicleText}>{item.driver?.vehicle ?? 'توك توك'}</Text>
              {item.driver?.rating && (
                <>
                  <View style={styles.metaDot} />
                  <MaterialIcons name="star" size={11} color={Colors.accent} />
                  <Text style={styles.ratingMetaText}>{item.driver.rating}</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.priceAmount}>{item.price}</Text>
            <Text style={styles.priceCurrency}>ج.م</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeLineWrap}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <View style={styles.routeConnector} />
            <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
          </View>
          <View style={styles.routeTexts}>
            <Text style={styles.routeText} numberOfLines={1}>{getFrom(item)}</Text>
            <View style={{ height: 10 }} />
            <Text style={styles.routeText} numberOfLines={1}>{getTo(item)}</Text>
          </View>
        </View>

        {/* Footer */}
        {(item.distance || item.duration || isCompleted) && (
          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              {isCompleted && !hasRating && (
                <TouchableOpacity
                  style={styles.rateBtn}
                  onPress={e => { e.stopPropagation(); setRatingTripId(item.id); }}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="star-outline" size={13} color={Colors.accent} />
                  <Text style={styles.rateBtnText}>قيّم الرحلة</Text>
                </TouchableOpacity>
              )}
              {isCompleted && hasRating && (
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <MaterialIcons key={i} name="star" size={14} color={i <= (item.rating ?? 0) ? Colors.accent : 'rgba(255,255,255,0.15)'} />
                  ))}
                </View>
              )}
            </View>
            {(item.distance || item.duration) && (
              <View style={styles.tripStats}>
                {item.distance && (
                  <View style={styles.statChip}>
                    <MaterialIcons name="straighten" size={11} color="rgba(255,255,255,0.45)" />
                    <Text style={styles.statChipText}>{item.distance}</Text>
                  </View>
                )}
                {item.duration && (
                  <View style={styles.statChip}>
                    <MaterialIcons name="timer" size={11} color="rgba(255,255,255,0.45)" />
                    <Text style={styles.statChipText}>{item.duration}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Empty State ──
  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <LinearGradient colors={['rgba(232,160,32,0.12)', 'rgba(232,160,32,0.03)']} style={styles.emptyIconGrad}>
          <MaterialIcons name="history" size={52} color="rgba(232,160,32,0.4)" />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>لا توجد رحلات</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === 'الكل'
          ? 'لم تقم بأي رحلة بعد. ابدأ رحلتك الأولى الآن!'
          : `لا توجد رحلات بحالة "${activeFilter}"`}
      </Text>
      {activeFilter === 'الكل' && (
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => router.push('/(tabs)' as any)}
          activeOpacity={0.88}
        >
          <LinearGradient colors={['#FFD050', '#E8A020']} style={styles.emptyBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <MaterialIcons name="add" size={18} color={Colors.bgDark} />
            <Text style={styles.emptyBtnText}>احجز رحلة جديدة</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const filterCount = (key: FilterKey) => {
    if (key === 'الكل') return counts.all;
    if (key === 'جارية') return counts.active;
    if (key === 'قادمة') return counts.pending;
    if (key === 'مكتملة') return counts.completed;
    if (key === 'ملغاة') return counts.cancelled;
    return 0;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {ratingTripId && (
        <TripRatingModal
          tripId={ratingTripId}
          visible={true}
          onClose={() => setRatingTripId(null)}
          onSaved={handleRatingSaved}
        />
      )}

      {/* ── Dark Header ── */}
      <LinearGradient colors={['#0D0D0D', '#1A1400']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSummary}>
            <Text style={styles.headerTripsCount}>{counts.all}</Text>
            <Text style={styles.headerTripsLabel}>رحلة</Text>
          </View>
          <Text style={styles.headerTitle}>رحلاتي</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => { setRefreshing(true); loadTrips(); }}
          >
            <MaterialIcons name="refresh" size={22} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Filter Tabs ── */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item: f }) => {
            const isActive = activeFilter === f.key;
            const cnt = filterCount(f.key);
            return (
              <TouchableOpacity
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(f.key)}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={f.icon as any}
                  size={14}
                  color={isActive ? Colors.bgDark : 'rgba(255,255,255,0.45)'}
                />
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {f.key}
                </Text>
                {cnt > 0 && (
                  <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                      {cnt}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </LinearGradient>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loaderText}>جاري تحميل رحلاتك...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={t => t.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadTrips(); }}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // Header
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  headerTitle: { color: '#fff', fontSize: Typography.xxl, fontFamily: 'Tajawal_800ExtraBold' },
  headerSummary: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  headerTripsCount: { color: Colors.accent, fontSize: Typography.lg, fontFamily: 'Tajawal_800ExtraBold' },
  headerTripsLabel: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,208,80,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Filters
  filtersList: { paddingBottom: Spacing.sm, gap: Spacing.xs },
  filterTab: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: Colors.accent, borderColor: Colors.accent,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  filterTabText: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  filterTabTextActive: { color: Colors.bgDark, fontFamily: 'Tajawal_700Bold' },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountActive: { backgroundColor: 'rgba(13,13,13,0.25)' },
  filterCountText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'Tajawal_700Bold' },
  filterCountTextActive: { color: Colors.bgDark },

  // List
  listContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 30 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular' },

  // Trip Card
  tripCard: {
    backgroundColor: '#1A2235',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },
  dateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'Tajawal_400Regular' },

  // Driver
  driverSection: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: 'rgba(255,208,80,0.25)' },
  driverAvatarFallback: { backgroundColor: 'rgba(232,160,32,0.1)', alignItems: 'center', justifyContent: 'center' },
  driverDetails: { flex: 1 },
  driverName: { color: '#fff', fontSize: Typography.base, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  driverMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 2 },
  vehicleText: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  ratingMetaText: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs },
  priceBox: { alignItems: 'flex-end' },
  priceAmount: { color: Colors.accent, fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  priceCurrency: { color: 'rgba(232,160,32,0.6)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },

  // Divider
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: Spacing.sm },

  // Route
  routeSection: { flexDirection: 'row-reverse', gap: 10, marginBottom: Spacing.sm },
  routeLineWrap: { alignItems: 'center', paddingTop: 5, gap: 0 },
  routeDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  routeConnector: { width: 1.5, flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 2, minHeight: 14 },
  routeTexts: { flex: 1, justifyContent: 'space-between' },
  routeText: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', textAlign: 'right' },

  // Footer
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerLeft: {},
  rateBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,208,80,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.25)',
  },
  rateBtnText: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },
  starsRow: { flexDirection: 'row-reverse', gap: 2 },
  tripStats: { flexDirection: 'row-reverse', gap: 6 },
  statChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  statChipText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Tajawal_400Regular' },

  // Empty
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIconWrap: { marginBottom: Spacing.lg },
  emptyIconGrad: { borderRadius: 50, padding: 28 },
  emptyTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_700Bold', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  emptyBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  emptyBtnGrad: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText: { color: Colors.bgDark, fontSize: Typography.base, fontFamily: 'Tajawal_700Bold' },
});

const rStyle = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1A2235', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: Spacing.xl + 8, alignItems: 'center',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: Spacing.md },
  title: { fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.45)', fontFamily: 'Tajawal_400Regular', marginBottom: Spacing.lg, textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: Spacing.md },
  ratingLabelWrap: { backgroundColor: 'rgba(255,208,80,0.1)', borderRadius: BorderRadius.full, paddingHorizontal: 16, paddingVertical: 6, marginBottom: Spacing.lg },
  ratingLabel: { fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', color: Colors.accent },
  btnRow: { flexDirection: 'row-reverse', gap: Spacing.sm, width: '100%', marginTop: Spacing.sm },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  skipText: { fontSize: Typography.base, color: 'rgba(255,255,255,0.5)', fontFamily: 'Tajawal_500Medium' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontSize: Typography.base, color: '#fff', fontFamily: 'Tajawal_700Bold' },
  success: { alignItems: 'center', paddingVertical: Spacing.xl },
  successGrad: { borderRadius: 50, padding: 20, marginBottom: Spacing.md },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.success + '20', alignItems: 'center', justifyContent: 'center' },
  successText: { fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold', color: '#fff' },
});
