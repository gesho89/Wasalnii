import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, Switch, Platform, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { awardTripCompletionPoints } from '@/services/rewardsService';
import * as Location from 'expo-location';

// Conditional map import
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  } catch {}
}

interface DriverData {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  vehicle_type: string;
  plate: string;
  rating: number;
  total_trips: number;
  is_online: boolean;
  avatar_url: string | null;
}

interface TripRow {
  id: string;
  user_id: string;
  from_location: string;
  to_location: string;
  price: number;
  distance: string;
  duration: string;
  status: string;
  created_at: string;
  payment_method: string;
}

// ── Rate Rider Modal ─────────────────────────────────────────────────
function RateRiderModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (stars: number) => void;
}) {
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    await onSubmit(stars);
    setDone(true);
    setSubmitting(false);
    setTimeout(() => { setDone(false); setStars(0); }, 1200);
  };

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <View style={riderRatingStyles.overlay}>
        <View style={riderRatingStyles.backdrop} />
        <View style={riderRatingStyles.sheet}>
          {done ? (
            <View style={riderRatingStyles.success}>
              <View style={riderRatingStyles.successIcon}>
                <MaterialIcons name="check" size={30} color="#fff" />
              </View>
              <Text style={riderRatingStyles.successText}>تم حفظ التقييم!</Text>
            </View>
          ) : (
            <>
              <View style={riderRatingStyles.handle} />
              <Text style={riderRatingStyles.title}>قيّم الراكب</Text>
              <Text style={riderRatingStyles.sub}>كيف كان سلوك الراكب؟</Text>
              <View style={riderRatingStyles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setStars(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name="star"
                      size={44}
                      color={stars >= i ? Colors.accent : Colors.borderLight}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <Text style={riderRatingStyles.label}>
                  {stars === 1 ? 'سيء جداً 😞' : stars === 2 ? 'سيء 😕' : stars === 3 ? 'مقبول 😐' : stars === 4 ? 'جيد 😊' : 'ممتاز! 🤩'}
                </Text>
              )}
              <View style={riderRatingStyles.btnRow}>
                <TouchableOpacity style={riderRatingStyles.skipBtn} onPress={onClose}>
                  <Text style={riderRatingStyles.skipText}>تخطي</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[riderRatingStyles.submitBtn, (stars === 0 || submitting) && riderRatingStyles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={stars === 0 || submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={riderRatingStyles.submitText}>إرسال</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function DriverDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [driver, setDriver] = useState<DriverData | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed'>('pending');
  const [completingTrip, setCompletingTrip] = useState<string | null>(null);

  // ── Rate rider state ───────────────────────────────────────────
  const [ratingRiderId, setRatingRiderId] = useState<{ tripId: string; riderId: string } | null>(null);

  // ── Live location ──────────────────────────────────────────────
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverIdRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }

      const { data: driverData, error: driverErr } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverErr || !driverData) {
        showAlert('تنبيه', 'لم يتم العثور على ملف السائق. يرجى إكمال التسجيل أولاً.', [
          { text: 'إكمال التسجيل', onPress: () => router.replace('/driver-register') },
        ]);
        setLoading(false);
        return;
      }

      setDriver(driverData);
      driverIdRef.current = driverData.id;

      const { data: tripsData } = await supabase
        .from('trips')
        .select('*')
        .eq('driver_id', driverData.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (tripsData) setTrips(tripsData);
    } catch (e) {
      console.error('Driver dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Start live GPS tracking ────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mounted) setDriverLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (newLoc) => {
          if (mounted) setDriverLocation({ latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude });
        }
      );
    })();
    return () => {
      mounted = false;
      locationWatchRef.current?.remove();
    };
  }, []);

  // ── Push location to Supabase every 10 seconds ──────────────────
  useEffect(() => {
    if (!driverLocation || !driverIdRef.current) return;
    const push = async () => {
      if (!driverIdRef.current || !driverLocation) return;
      await supabase
        .from('drivers')
        .update({
          lat: driverLocation.latitude,
          lng: driverLocation.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driverIdRef.current);
    };
    push();
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = setInterval(push, 10000);
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [driverLocation]);

  const toggleOnline = async () => {
    if (!driver) return;
    setTogglingOnline(true);
    const newStatus = !driver.is_online;
    const { error } = await supabase
      .from('drivers')
      .update({ is_online: newStatus, updated_at: new Date().toISOString() })
      .eq('id', driver.id);

    if (error) { showAlert('خطأ', 'فشل تحديث الحالة'); }
    else { setDriver(prev => prev ? { ...prev, is_online: newStatus } : prev); }
    setTogglingOnline(false);
  };

  // ── Rate rider ────────────────────────────────────────────────
  const handleRateRider = async (tripId: string, riderId: string, stars: number) => {
    try {
      if (!driver?.id) return;
      await supabase.from('rider_ratings').insert({
        trip_id: tripId,
        driver_id: driver.id,
        rider_id: riderId,
        rating: stars,
      });
      setRatingRiderId(null);
    } catch { /* silent */ }
  };

  // ── Mark driver as arrived ────────────────────────────────────
  const handleArrived = async (tripId: string) => {
    await supabase
      .from('trips')
      .update({ status: 'arrived', updated_at: new Date().toISOString() })
      .eq('id', tripId);
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'arrived' } : t));
  };

  // ── Complete trip + award rewards ─────────────────────────────
  const handleCompleteTrip = async (trip: TripRow) => {
    showAlert(
      'تأكيد إتمام الرحلة',
      `هل تريد تأكيد إتمام رحلة ${trip.from_location} ← ${trip.to_location}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: async () => {
            setCompletingTrip(trip.id);
            try {
              const { error } = await supabase
                .from('trips')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', trip.id);

              if (error) { showAlert('خطأ', 'فشل تحديث حالة الرحلة'); return; }

              if (driver) {
                await supabase
                  .from('drivers')
                  .update({ total_trips: (driver.total_trips ?? 0) + 1, updated_at: new Date().toISOString() })
                  .eq('id', driver.id);
                setDriver(prev => prev ? { ...prev, total_trips: (prev.total_trips ?? 0) + 1 } : prev);
              }

              if (trip.user_id) {
                await awardTripCompletionPoints(trip.user_id, Number(trip.price), trip.from_location, trip.to_location);
              }

              setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, status: 'completed' } : t));
              showAlert('تم بنجاح', 'تم إتمام الرحلة ومنح النقاط للراكب');
            } finally {
              setCompletingTrip(null);
            }
          },
        },
      ]
    );
  };

  // ── Cancel trip ───────────────────────────────────────────────
  const handleCancelTrip = async (tripId: string) => {
    showAlert('إلغاء الرحلة', 'هل أنت متأكد من إلغاء هذه الرحلة؟', [
      { text: 'رجوع', style: 'cancel' },
      {
        text: 'إلغاء الرحلة',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('trips')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', tripId);
          setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'cancelled' } : t));
        },
      },
    ]);
  };

  // ── Start trip pending → active ───────────────────────────────
  const handleStartTrip = async (tripId: string) => {
    await supabase
      .from('trips')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', tripId);
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'active' } : t));
  };

  const filteredTrips = trips.filter(t => {
    if (activeTab === 'pending')   return t.status === 'pending';
    if (activeTab === 'active')    return t.status === 'active' || t.status === 'arrived';
    return t.status === 'completed';
  });

  const today = new Date().toDateString();
  const dailyEarnings = trips
    .filter(t => t.status === 'completed' && new Date(t.created_at).toDateString() === today)
    .reduce((sum, t) => sum + Number(t.price), 0);
  const totalEarnings = trips
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.price), 0);
  const completedToday = trips.filter(
    t => t.status === 'completed' && new Date(t.created_at).toDateString() === today
  ).length;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="drive-eta" size={64} color={Colors.borderLight} />
        <Text style={styles.noDriverText}>لم يتم العثور على ملف سائق</Text>
        <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/driver-register')}>
          <Text style={styles.registerBtnText}>سجل كسائق</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Rate Rider Modal */}
      {ratingRiderId && (
        <RateRiderModal
          visible={true}
          onClose={() => setRatingRiderId(null)}
          onSubmit={(stars) => handleRateRider(ratingRiderId.tripId, ratingRiderId.riderId, stars)}
        />
      )}

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>لوحة السائق</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
            <MaterialIcons name="notifications-none" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Driver Info */}
        <View style={styles.driverCard}>
          <View style={styles.driverCardContent}>
            <View style={styles.driverMeta}>
              <View style={styles.onlineRow}>
                <Text style={[styles.onlineLabel, { color: driver.is_online ? Colors.success : Colors.textSecondary }]}>
                  {driver.is_online ? 'متاح للرحلات' : 'غير متاح'}
                </Text>
                {togglingOnline ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Switch
                    value={driver.is_online}
                    onValueChange={toggleOnline}
                    trackColor={{ false: Colors.border, true: Colors.success + '60' }}
                    thumbColor={driver.is_online ? Colors.success : Colors.textLight}
                    ios_backgroundColor={Colors.border}
                  />
                )}
              </View>
              <Text style={styles.driverName}>{driver.name}</Text>
              <Text style={styles.driverVehicle}>{driver.vehicle} · {driver.plate}</Text>
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={16} color={Colors.accent} />
                <Text style={styles.rating}>{driver.rating?.toFixed(1)}</Text>
                <Text style={styles.totalTrips}>({driver.total_trips} رحلة)</Text>
              </View>
            </View>
            <Image
              source={driver.avatar_url
                ? { uri: driver.avatar_url }
                : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' }
              }
              style={styles.driverAvatar}
              contentFit="cover"
              transition={200}
            />
          </View>
          <View style={[styles.statusBar, { backgroundColor: driver.is_online ? Colors.success + '20' : Colors.error + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: driver.is_online ? Colors.success : Colors.offline }]} />
            <Text style={[styles.statusText, { color: driver.is_online ? Colors.success : Colors.offline }]}>
              {driver.is_online
                ? 'أنت متاح الآن — ستظهر للركاب القريبين'
                : 'أنت غير متاح — فعّل الاستقبال لقبول الرحلات'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={Colors.accent}
          />
        }
      >
        {/* ── Live Map Section ── */}
        <View style={styles.mapSection}>
          <TouchableOpacity style={styles.mapToggleBtn} onPress={() => setShowMap(v => !v)} activeOpacity={0.85}>
            <MaterialIcons name="my-location" size={18} color={driverLocation ? Colors.success : Colors.textSecondary} />
            <Text style={styles.mapToggleText}>
              {showMap ? 'إخفاء الخريطة الحية' : 'عرض الخريطة الحية'}
            </Text>
            <View style={[styles.locationStatusDot, { backgroundColor: driverLocation ? Colors.success : Colors.offline }]} />
            <MaterialIcons name={showMap ? 'expand-less' : 'expand-more'} size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {showMap && (
            <View style={styles.mapContainer}>
              {Platform.OS !== 'web' && MapView && driverLocation ? (
                <MapView
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  region={{
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                  }}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                >
                  {Marker && (
                    <Marker coordinate={driverLocation} title="موقعك الحالي">
                      <View style={styles.driverMarker}>
                        <MaterialIcons name="directions-car" size={16} color="#fff" />
                      </View>
                    </Marker>
                  )}
                </MapView>
              ) : (
                <View style={styles.mapFallback}>
                  <MaterialIcons name="map" size={44} color={Colors.borderLight} />
                  <Text style={styles.mapFallbackText}>
                    {driverLocation
                      ? `موقعك: ${driverLocation.latitude.toFixed(5)}, ${driverLocation.longitude.toFixed(5)}`
                      : 'جارٍ تحديد موقعك...'}
                  </Text>
                  {!driverLocation && <ActivityIndicator size="small" color={Colors.accent} style={{ marginTop: 8 }} />}
                </View>
              )}

              {driverLocation && (
                <View style={styles.coordBadge}>
                  <View style={[styles.locationStatusDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.coordText}>
                    {driverLocation.latitude.toFixed(5)}, {driverLocation.longitude.toFixed(5)}
                  </Text>
                  <Text style={styles.updateNote}>يُحدَّث كل 10 ث</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="أرباح اليوم"    value={`${dailyEarnings.toFixed(0)} ج.م`} icon="today"                  color={Colors.success} />
          <StatCard label="رحلات اليوم"    value={completedToday.toString()}           icon="directions-car"         color={Colors.primary} />
          <StatCard label="إجمالي الأرباح" value={`${totalEarnings.toFixed(0)} ج.م`} icon="account-balance-wallet" color={Colors.accent}  />
          <StatCard label="تقييمي"         value={driver.rating?.toFixed(1) ?? '5.0'} icon="star"                   color="#F59E0B" />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          {[
            { icon: 'description',    label: 'المستندات', color: Colors.primary,       route: '/driver-registration-docs' },
            { icon: 'settings',       label: 'الإعدادات', color: Colors.textSecondary, route: '/settings' },
            { icon: 'report-problem', label: 'الشكاوى',  color: Colors.error,         route: '/complaints' },
            { icon: 'emoji-events',   label: 'المكافآت', color: Colors.accent,        route: '/rewards' },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionBtn} onPress={() => router.push(a.route as any)}>
              <MaterialIcons name={a.icon as any} size={20} color={a.color} />
              <Text style={styles.actionText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trips Section */}
        <View style={styles.tripsSection}>
          <Text style={styles.tripsSectionTitle}>الرحلات</Text>

          <View style={styles.tabRow}>
            {([
              { key: 'pending',   label: 'معلقة',  icon: 'schedule'      },
              { key: 'active',    label: 'جارية',  icon: 'directions-car' },
              { key: 'completed', label: 'مكتملة', icon: 'check-circle'  },
            ] as const).map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialIcons name={tab.icon} size={14} color={activeTab === tab.key ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label} ({trips.filter(t =>
                    tab.key === 'active'
                      ? (t.status === 'active' || t.status === 'arrived')
                      : t.status === tab.key
                  ).length})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredTrips.length === 0 ? (
            <View style={styles.emptyTrips}>
              <MaterialIcons name="inbox" size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? 'لا توجد رحلات معلقة' :
                 activeTab === 'active'  ? 'لا توجد رحلات جارية' : 'لا توجد رحلات مكتملة'}
              </Text>
            </View>
          ) : (
            filteredTrips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                isCompleting={completingTrip === trip.id}
                onComplete={() => handleCompleteTrip(trip)}
                onStart={() => handleStartTrip(trip.id)}
                onArrived={() => handleArrived(trip.id)}
                onCancel={() => handleCancelTrip(trip.id)}
                onRateRider={trip.status === 'arrived'
                  ? () => setRatingRiderId({ tripId: trip.id, riderId: trip.user_id })
                  : undefined
                }
              />
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={[statStyles.card, { borderColor: color + '30' }]}>
      <View style={[statStyles.icon, { backgroundColor: color + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function TripCard({
  trip,
  isCompleting,
  onComplete,
  onStart,
  onArrived,
  onCancel,
  onRateRider,
}: {
  trip: TripRow;
  isCompleting: boolean;
  onComplete: () => void;
  onStart: () => void;
  onArrived: () => void;
  onCancel: () => void;
  onRateRider?: () => void;
}) {
  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    pending:   { color: Colors.warning,  label: 'معلقة',  icon: 'schedule'       },
    active:    { color: Colors.primary,  label: 'جارية',  icon: 'directions-car' },
    arrived:   { color: Colors.success,  label: 'وصلت',   icon: 'place'          },
    completed: { color: Colors.success,  label: 'مكتملة', icon: 'check-circle'   },
    cancelled: { color: Colors.error,    label: 'ملغية',  icon: 'cancel'         },
  };
  const cfg = statusConfig[trip.status] ?? statusConfig['pending'];
  const date = new Date(trip.created_at).toLocaleDateString('ar-EG');
  const time = new Date(trip.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={tripCardStyles.card}>
      <View style={tripCardStyles.top}>
        <View style={[tripCardStyles.statusBadge, { backgroundColor: cfg.color + '18' }]}>
          <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[tripCardStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={tripCardStyles.price}>{trip.price} ج.م</Text>
      </View>

      <View style={tripCardStyles.route}>
        <View style={tripCardStyles.routeItem}>
          <MaterialIcons name="location-on" size={14} color={Colors.success} />
          <Text style={tripCardStyles.routeText} numberOfLines={1}>{trip.from_location}</Text>
        </View>
        <View style={tripCardStyles.routeItem}>
          <MaterialIcons name="flag" size={14} color={Colors.error} />
          <Text style={tripCardStyles.routeText} numberOfLines={1}>{trip.to_location}</Text>
        </View>
      </View>

      <View style={tripCardStyles.bottom}>
        <Text style={tripCardStyles.meta}>{trip.distance} · {trip.duration}</Text>
        <Text style={tripCardStyles.date}>{date} {time}</Text>
      </View>

      {/* pending: cancel + start */}
      {trip.status === 'pending' && (
        <View style={tripCardStyles.actions}>
          <TouchableOpacity
            style={[tripCardStyles.actionBtn, { backgroundColor: Colors.error + '15', borderColor: Colors.error + '40' }]}
            onPress={onCancel}
          >
            <MaterialIcons name="close" size={14} color={Colors.error} />
            <Text style={[tripCardStyles.actionText, { color: Colors.error }]}>إلغاء</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tripCardStyles.actionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
            onPress={onStart}
          >
            <MaterialIcons name="play-arrow" size={14} color={Colors.primary} />
            <Text style={[tripCardStyles.actionText, { color: Colors.primary }]}>بدء الرحلة</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* active: arrived button */}
      {trip.status === 'active' && (
        <View style={tripCardStyles.actions}>
          <TouchableOpacity
            style={[tripCardStyles.actionBtn, { backgroundColor: Colors.accent + '20', borderColor: Colors.accent + '50', flex: 1 }]}
            onPress={onArrived}
          >
            <MaterialIcons name="place" size={14} color={Colors.primaryDark} />
            <Text style={[tripCardStyles.actionText, { color: Colors.primaryDark }]}>وصلت للراكب</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* arrived: complete trip + rate rider */}
      {trip.status === 'arrived' && (
        <View style={tripCardStyles.actions}>
          {onRateRider && (
            <TouchableOpacity
              style={[tripCardStyles.actionBtn, { backgroundColor: Colors.accent + '15', borderColor: Colors.accent + '40' }]}
              onPress={onRateRider}
            >
              <MaterialIcons name="star-outline" size={14} color={Colors.accent} />
              <Text style={[tripCardStyles.actionText, { color: Colors.accent }]}>قيّم الراكب</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[tripCardStyles.actionBtn, tripCardStyles.completeBtn, isCompleting && { opacity: 0.6 }]}
            onPress={onComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={14} color="#fff" />
                <Text style={[tripCardStyles.actionText, { color: '#fff' }]}>إتمام الرحلة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  notifBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  driverCard: {
    marginHorizontal: Spacing.md, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: BorderRadius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  driverCardContent: { flexDirection: 'row-reverse', padding: Spacing.md, alignItems: 'flex-start' },
  driverAvatar: { width: 70, height: 70, borderRadius: 35, marginLeft: Spacing.md },
  driverMeta: { flex: 1 },
  onlineRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  onlineLabel: { fontSize: Typography.sm, fontWeight: '700' },
  driverName: { color: '#fff', fontSize: Typography.lg, fontWeight: '700', textAlign: 'right' },
  driverVehicle: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, textAlign: 'right', marginTop: 2 },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6 },
  rating: { color: Colors.accent, fontWeight: '700', fontSize: Typography.base },
  totalTrips: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs },
  statusBar: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    padding: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: Typography.xs, fontWeight: '600', flex: 1, textAlign: 'right' },
  scroll: { flex: 1 },
  mapSection: {
    backgroundColor: Colors.bgWhite, margin: Spacing.md, marginBottom: 0,
    borderRadius: BorderRadius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  mapToggleBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  mapToggleText: { flex: 1, fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  locationStatusDot: { width: 8, height: 8, borderRadius: 4 },
  mapContainer: { position: 'relative' },
  map: { width: '100%', height: 220 },
  mapFallback: {
    height: 160, alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.bgLight,
  },
  mapFallbackText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.md },
  coordBadge: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  coordText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  updateNote: { color: 'rgba(255,255,255,0.5)', fontSize: 9 },
  driverMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  statsGrid: {
    flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm,
    padding: Spacing.md, paddingBottom: 0,
  },
  actionsRow: {
    flexDirection: 'row-reverse', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  actionText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  tripsSection: {
    backgroundColor: Colors.bgWhite, margin: Spacing.md, marginTop: 0,
    borderRadius: BorderRadius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  tripsSectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  tabRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: Spacing.md },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderLight,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  emptyTrips: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: Typography.base, color: Colors.textLight },
  noDriverText: { fontSize: Typography.lg, color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' },
  registerBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, paddingHorizontal: 32, paddingVertical: 14,
  },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
});

const statStyles = StyleSheet.create({
  card: {
    width: '48%', backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, ...Shadows.sm,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
});

const tripCardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  top: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: Typography.xs, fontWeight: '700' },
  price: { fontSize: Typography.lg, fontWeight: '800', color: Colors.primary },
  route: { gap: 6, marginBottom: 8 },
  routeItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  routeText: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, textAlign: 'right' },
  bottom: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  meta: { fontSize: Typography.xs, color: Colors.textSecondary },
  date: { fontSize: Typography.xs, color: Colors.textLight },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  completeBtn: { backgroundColor: Colors.success, borderColor: Colors.success },
  actionText: { fontSize: Typography.xs, fontWeight: '700' },
});

const riderRatingStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: Spacing.xl + 8, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  label: { fontSize: Typography.md, fontWeight: '600', color: Colors.accent, marginBottom: Spacing.lg },
  btnRow: { flexDirection: 'row-reverse', gap: Spacing.sm, width: '100%', marginTop: Spacing.md },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  skipText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, color: '#fff', fontWeight: '700' },
  success: { alignItems: 'center', paddingVertical: Spacing.xl },
  successIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  successText: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
});
