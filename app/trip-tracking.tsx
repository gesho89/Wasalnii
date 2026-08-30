import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_DRIVERS } from '@/services/mockData';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import MapViewWrapper from '@/components/MapViewWrapper';
import {
  scheduleRideAcceptedNotification,
  scheduleDriverArrivedNotification,
  scheduleTripCompletedNotification,
} from '@/services/pushNotifications';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  getCurrentLocation, watchLocation,
  DEFAULT_LOCATION, LatLng,
} from '@/services/locationService';
import type { LocationSubscription } from 'expo-location';

// ── Trip status → UI label mapping ─────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending:   'في انتظار قبول السائق',
  active:    'جارية الآن',
  arrived:   'السائق وصل إليك',
  completed: 'اكتملت الرحلة',
  cancelled: 'تم إلغاء الرحلة',
};

const STATUS_COLORS: Record<string, string> = {
  pending:   Colors.warning ?? '#F59E0B',
  active:    Colors.success,
  arrived:   Colors.primary,
  completed: Colors.primary,
  cancelled: Colors.error,
};

// ── Simulate driver moving toward user ──────────────────────────────
function simulateDriverMove(start: LatLng, target: LatLng, step: number): LatLng {
  const fraction = Math.min(1, step * 0.12);
  return {
    latitude: start.latitude + (target.latitude - start.latitude) * fraction,
    longitude: start.longitude + (target.longitude - start.longitude) * fraction,
  };
}

// ── Cancellation Reason Modal ──────────────────────────────────────
const CANCEL_REASONS = [
  { id: 'driver_late',    label: 'السائق تأخر',      icon: 'schedule' },
  { id: 'plan_changed',  label: 'تغيير الخطة',       icon: 'edit-location' },
  { id: 'wrong_order',   label: 'خطأ في الطلب',      icon: 'error-outline' },
  { id: 'found_other',   label: 'وجدت وسيلة أخرى',  icon: 'directions' },
  { id: 'other',         label: 'سبب آخر',           icon: 'more-horiz' },
] as const;

type CancelReasonId = typeof CANCEL_REASONS[number]['id'];

function CancelReasonModal({
  visible,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  onConfirm: (reason: CancelReasonId) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<CancelReasonId | null>(null);

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <View style={cancelStyles.overlay}>
        <View style={cancelStyles.backdrop} />
        <View style={cancelStyles.sheet}>
          <View style={cancelStyles.handle} />
          <Text style={cancelStyles.title}>سبب الإلغاء</Text>
          <Text style={cancelStyles.sub}>اختر سبب إلغاء رحلتك</Text>

          <View style={cancelStyles.list}>
            {CANCEL_REASONS.map(reason => (
              <TouchableOpacity
                key={reason.id}
                style={[cancelStyles.item, selected === reason.id && cancelStyles.itemSelected]}
                onPress={() => setSelected(reason.id)}
                activeOpacity={0.85}
              >
                <View style={[cancelStyles.itemIcon, selected === reason.id && cancelStyles.itemIconSelected]}>
                  <MaterialIcons
                    name={reason.icon as any}
                    size={18}
                    color={selected === reason.id ? '#fff' : Colors.textSecondary}
                  />
                </View>
                <Text style={[cancelStyles.itemLabel, selected === reason.id && cancelStyles.itemLabelSelected]}>
                  {reason.label}
                </Text>
                <View style={[cancelStyles.radio, selected === reason.id && cancelStyles.radioSelected]}>
                  {selected === reason.id && <View style={cancelStyles.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={cancelStyles.btnRow}>
            <TouchableOpacity style={cancelStyles.backBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={cancelStyles.backText}>رجوع</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cancelStyles.confirmBtn, !selected && cancelStyles.confirmDisabled]}
              onPress={() => selected && onConfirm(selected)}
              disabled={!selected}
              activeOpacity={0.9}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
              <Text style={cancelStyles.confirmText}>تأكيد الإلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Rating Modal ────────────────────────────────────────────────────
function RatingModal({
  driverName,
  tripId,
  onClose,
}: {
  driverName: string;
  tripId: string | null;
  onClose: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    if (tripId) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('trips')
          .update({ rating: stars, updated_at: new Date().toISOString() })
          .eq('id', tripId);
      } catch { /* silent */ }
    }
    setSubmitted(true);
    setTimeout(onClose, 1600);
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <KeyboardAvoidingView
        style={rStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={rStyles.backdrop} />
        <View style={rStyles.sheet}>
          {submitted ? (
            <View style={rStyles.successWrap}>
              <View style={rStyles.successIcon}>
                <MaterialIcons name="check" size={36} color="#fff" />
              </View>
              <Text style={rStyles.successTitle}>شكراً لتقييمك!</Text>
              <Text style={rStyles.successSub}>مساهمتك تساعدنا في تحسين الخدمة</Text>
            </View>
          ) : (
            <>
              <Text style={rStyles.title}>قيّم رحلتك</Text>
              <Text style={rStyles.sub}>كيف كانت تجربتك مع {driverName}؟</Text>
              <View style={rStyles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setStars(i)}
                    onPressIn={() => setHovered(i)}
                    onPressOut={() => setHovered(0)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  >
                    <MaterialIcons
                      name="star"
                      size={46}
                      color={(hovered || stars) >= i ? Colors.accent : Colors.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <Text style={rStyles.ratingLabel}>
                  {stars === 1 ? 'سيء جداً 😞' : stars === 2 ? 'سيء 😕' : stars === 3 ? 'مقبول 😐' : stars === 4 ? 'جيد 😊' : 'ممتاز! 🤩'}
                </Text>
              )}
              <TextInput
                style={rStyles.commentInput}
                placeholder="اكتب تعليقك هنا (اختياري)..."
                placeholderTextColor={Colors.textLight}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
              <View style={rStyles.btnRow}>
                <TouchableOpacity style={rStyles.skipBtn} onPress={onClose} activeOpacity={0.85}>
                  <Text style={rStyles.skipText}>تخطي</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rStyles.submitBtn, stars === 0 && rStyles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={stars === 0}
                  activeOpacity={0.9}
                >
                  <Text style={rStyles.submitText}>إرسال التقييم</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────
export default function TripTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { addNotification } = useNotifications();
  const supabase = getSupabaseClient();

  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  // ── Trip data from Supabase ──────────────────────────────────────
  const [tripStatus, setTripStatus] = useState<string>('pending');
  const [tripPrice, setTripPrice] = useState<number>(0);
  const [fromLocation, setFromLocation] = useState<string>('موقعك الحالي');
  const [toLocation, setToLocation] = useState<string>('الوجهة المحددة');
  const [tripLoading, setTripLoading] = useState(true);
  const prevStatusRef = useRef<string>('pending');

  // ── Driver data ──────────────────────────────────────────────────
  const fallbackDriver = MOCK_DRIVERS[0];
  const [driverName, setDriverName] = useState(fallbackDriver.name);
  const [driverVehicle, setDriverVehicle] = useState(fallbackDriver.vehicle);
  const [driverPlate, setDriverPlate] = useState(fallbackDriver.plate);
  const [driverRating, setDriverRating] = useState(fallbackDriver.rating);
  const [driverAvatar, setDriverAvatar] = useState(fallbackDriver.avatar);

  // ── UI state ─────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [showRating, setShowRating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  // ── Unread chat badge ────────────────────────────────────────────
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastSeenMsgTimestampRef = useRef<string | null>(null);
  const chatOpenedRef = useRef(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  // ── Real user location ───────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<LatLng>(DEFAULT_LOCATION);
  const locationSubRef = useRef<LocationSubscription | null>(null);

  // ── Simulated driver position ────────────────────────────────────
  const [driverPos, setDriverPos] = useState<LatLng>({
    latitude: DEFAULT_LOCATION.latitude + 0.008,
    longitude: DEFAULT_LOCATION.longitude + 0.008,
  });
  const driverStepRef = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load real user location ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const loc = await getCurrentLocation();
      setUserLocation(loc);
      setDriverPos({
        latitude: loc.latitude + 0.008,
        longitude: loc.longitude + 0.008,
      });
      const sub = await watchLocation(newLoc => setUserLocation(newLoc));
      locationSubRef.current = sub;
    })();
    return () => { locationSubRef.current?.remove(); };
  }, []);

  // ── Poll unread messages from driver ─────────────────────────────
  const pollUnreadMessages = useCallback(async () => {
    if (!tripId || chatOpenedRef.current) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const query = supabase
        .from('messages')
        .select('id, created_at')
        .eq('trip_id', tripId)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      // If we have a seen timestamp, only count newer ones
      const { data } = lastSeenMsgTimestampRef.current
        ? await query.gt('created_at', lastSeenMsgTimestampRef.current)
        : await query;
      setUnreadChatCount(data?.length ?? 0);
    } catch { /* silent */ }
  }, [tripId]);

  // ── Fetch trip from Supabase ─────────────────────────────────────
  const fetchTrip = useCallback(async () => {
    if (!tripId) { setTripLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error || !data) { setTripLoading(false); return; }

      const newStatus = data.status as string;
      setTripStatus(newStatus);
      setTripPrice(Number(data.price) ?? 0);
      setFromLocation(data.from_location ?? 'موقعك الحالي');
      setToLocation(data.to_location ?? 'الوجهة المحددة');

      if (data.driver_id) {
        const { data: drv } = await supabase
          .from('drivers')
          .select('name, vehicle, plate, rating, avatar_url')
          .eq('id', data.driver_id)
          .single();
        if (drv) {
          setDriverName(drv.name ?? fallbackDriver.name);
          setDriverVehicle(drv.vehicle ?? fallbackDriver.vehicle);
          setDriverPlate(drv.plate ?? fallbackDriver.plate);
          setDriverRating(Number(drv.rating) ?? fallbackDriver.rating);
          if (drv.avatar_url) setDriverAvatar(drv.avatar_url);
        }
      }

      setTripLoading(false);

      const prev = prevStatusRef.current;
      if (prev !== newStatus) {
        prevStatusRef.current = newStatus;

        if (newStatus === 'arrived' && !notifiedRef.current.has('arrived')) {
          notifiedRef.current.add('arrived');
          scheduleDriverArrivedNotification();
          addNotification({
            type: 'driver_arrived',
            title: 'السائق وصل إليك!',
            body: `${driverName} وصل وينتظرك الآن`,
            time: 'الآن', icon: 'directions-car', iconColor: Colors.primary,
          });
        }

        if (newStatus === 'active' && !notifiedRef.current.has('active')) {
          notifiedRef.current.add('active');
          scheduleRideAcceptedNotification(driverName);
          addNotification({
            type: 'ride_accepted',
            title: 'قبل السائق رحلتك!',
            body: `${driverName} قبل رحلتك وهو في الطريق إليك`,
            time: 'الآن', icon: 'check-circle', iconColor: Colors.success,
          });
        }

        if (newStatus === 'completed' && !notifiedRef.current.has('completed')) {
          notifiedRef.current.add('completed');
          scheduleTripCompletedNotification(tripPrice);
          addNotification({
            type: 'trip_completed',
            title: 'اكتملت رحلتك',
            body: `وصلت إلى وجهتك بأمان. تكلفة الرحلة ${tripPrice} ج.م`,
            time: 'الآن', icon: 'flag', iconColor: Colors.accent,
          });
          if (tripPollRef.current) clearInterval(tripPollRef.current);
          if (msgPollRef.current) clearInterval(msgPollRef.current);
          setTimeout(() => setShowRating(true), 600);
        }

        if (newStatus === 'cancelled' && !notifiedRef.current.has('cancelled')) {
          notifiedRef.current.add('cancelled');
          addNotification({
            type: 'trip_cancelled',
            title: 'تم إلغاء الرحلة',
            body: 'تم إلغاء رحلتك',
            time: 'الآن', icon: 'cancel', iconColor: Colors.error,
          });
        }
      }
    } catch (e) {
      console.error('fetchTrip error:', e);
      setTripLoading(false);
    }
  }, [tripId, driverName, tripPrice]);

  // ── Polling setup ────────────────────────────────────────────────
  useEffect(() => {
    fetchTrip();
    tripPollRef.current = setInterval(fetchTrip, 5000);
    // Poll unread messages every 5 seconds
    if (tripId) {
      pollUnreadMessages();
      msgPollRef.current = setInterval(pollUnreadMessages, 5000);
    }
    return () => {
      if (tripPollRef.current) clearInterval(tripPollRef.current);
      if (msgPollRef.current) clearInterval(msgPollRef.current);
    };
  }, [fetchTrip, pollUnreadMessages, tripId]);

  // ── Driver position simulation ───────────────────────────────────
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      driverStepRef.current += 1;
      setDriverPos(prev => simulateDriverMove(prev, userLocation, driverStepRef.current));
    }, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [userLocation]);

  // ── Trip timer (only when active) ───────────────────────────────
  useEffect(() => {
    if (tripStatus !== 'active') return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [tripStatus]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCancel = () => {
    if (tripStatus !== 'pending' && tripStatus !== 'active') return;
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (reason: CancelReasonId) => {
    setShowCancelModal(false);
    if (tripId) {
      await supabase
        .from('trips')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);
    }
    router.back();
  };

  const handleOpenChat = () => {
    // Mark as seen
    chatOpenedRef.current = true;
    lastSeenMsgTimestampRef.current = new Date().toISOString();
    setUnreadChatCount(0);
    // Re-enable polling after user leaves chat
    setTimeout(() => { chatOpenedRef.current = false; }, 2000);
    router.push({
      pathname: '/trip-chat',
      params: { tripId, driverName, role: 'rider' },
    } as any);
  };

  const DESTINATION: LatLng = {
    latitude: userLocation.latitude + 0.018,
    longitude: userLocation.longitude + 0.014,
  };

  const routeCoords: LatLng[] = [
    userLocation,
    { latitude: userLocation.latitude + 0.006, longitude: userLocation.longitude + 0.004 },
    driverPos,
    { latitude: userLocation.latitude + 0.014, longitude: userLocation.longitude + 0.010 },
    DESTINATION,
  ];

  const statusColor = STATUS_COLORS[tripStatus] ?? Colors.primary;
  const statusLabel = STATUS_LABELS[tripStatus] ?? tripStatus;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {showCancelModal && (
        <CancelReasonModal
          visible={showCancelModal}
          onConfirm={handleConfirmCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showRating && (
        <RatingModal
          driverName={driverName}
          tripId={tripId ?? null}
          onClose={() => { setShowRating(false); router.back(); }}
        />
      )}

      {/* Map */}
      <View style={styles.mapArea}>
        <MapViewWrapper
          origin={userLocation}
          destination={DESTINATION}
          driverPosition={driverPos}
          routeCoords={routeCoords}
          driverName={driverName}
          showUserLocation={true}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        />
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 10 }]} onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.liveIndicator}>
          <View style={[styles.liveDot, { backgroundColor: tripStatus === 'cancelled' ? Colors.error : Colors.success }]} />
          <Text style={styles.liveText}>
            {tripLoading ? 'جارٍ التحميل...' : 'مباشر'}
          </Text>
        </View>
      </View>

      {/* Bottom Card */}
      <View style={[styles.tripCard, { paddingBottom: insets.bottom + Spacing.md }]}>

        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            {tripLoading ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            )}
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {tripStatus === 'active' && (
            <Text style={styles.elapsedTime}>{formatTime(elapsed)}</Text>
          )}
          {tripStatus === 'pending' && !tripLoading && (
            <View style={styles.pollingBadge}>
              <ActivityIndicator size="small" color={Colors.textSecondary} />
              <Text style={styles.pollingText}>بانتظار السائق</Text>
            </View>
          )}
        </View>

        {/* Driver Info */}
        <View style={styles.driverRow}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.driverVehicle}>{driverVehicle} · {driverPlate}</Text>
            <View style={styles.ratingRow}>
              <MaterialIcons name="star" size={14} color={Colors.accent} />
              <Text style={styles.rating}>{driverRating}</Text>
            </View>
          </View>
          <Image source={{ uri: driverAvatar }} style={styles.driverAvatar} contentFit="cover" transition={200} />
        </View>

        {/* Progress Steps */}
        <View style={styles.progressRow}>
          {(['pending', 'active', 'arrived', 'completed'] as const).map((s, i) => {
            const stages = ['pending', 'active', 'arrived', 'completed'];
            const currentIdx = stages.indexOf(tripStatus);
            const done = i <= currentIdx;
            return (
              <View key={s} style={styles.progressStep}>
                <View style={[styles.progressDot, { backgroundColor: done ? Colors.primary : Colors.border }]} />
                {i < 3 && (
                  <View style={[styles.progressLine, { backgroundColor: i < currentIdx ? Colors.primary : Colors.border }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeItem}>
            <MaterialIcons name="location-on" size={18} color={Colors.success} />
            <Text style={styles.routeText}>{fromLocation}</Text>
          </View>
          <View style={styles.routeItem}>
            <MaterialIcons name="flag" size={18} color={Colors.error} />
            <Text style={styles.routeText}>{toLocation}</Text>
          </View>
          {tripPrice > 0 && (
            <View style={[styles.routeItem, { backgroundColor: Colors.primaryLight ?? Colors.bgLight }]}>
              <MaterialIcons name="payments" size={18} color={Colors.primary} />
              <Text style={[styles.routeText, { color: Colors.primary, fontWeight: '700' }]}>
                {tripPrice} ج.م
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          {(tripStatus === 'pending' || tripStatus === 'active') && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
              <MaterialIcons name="close" size={20} color={Colors.error} />
              <Text style={[styles.actionText, { color: Colors.error }]}>إلغاء الطلب</Text>
            </TouchableOpacity>
          )}
          {tripId && (tripStatus === 'active' || tripStatus === 'arrived') && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: Colors.primary }]}
              onPress={handleOpenChat}
            >
              <View style={styles.chatIconWrap}>
                <MaterialIcons name="chat" size={20} color={Colors.primary} />
                {unreadChatCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {unreadChatCount > 9 ? '9+' : String(unreadChatCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.actionText, { color: Colors.primary }]}>دردشة</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.actionBtnPrimary,
              (tripStatus === 'pending' || tripStatus === 'cancelled') && { opacity: 0.6 },
            ]}
            disabled={tripStatus === 'pending' || tripStatus === 'cancelled'}
          >
            <MaterialIcons name="phone" size={20} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>اتصال بالسائق</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  mapArea: { flex: 1, position: 'relative' },
  backBtn: {
    position: 'absolute', right: Spacing.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgWhite, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  liveIndicator: {
    position: 'absolute', top: 14, left: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  tripCard: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: Spacing.lg, ...Shadows.lg,
  },
  statusSection: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontWeight: '700', fontSize: Typography.sm },
  elapsedTime: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
  pollingBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  pollingText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
  driverRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.md },
  driverInfo: { flex: 1 },
  driverName: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  driverVehicle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginVertical: 2 },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  rating: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  driverAvatar: { width: 60, height: 60, borderRadius: 30, marginLeft: Spacing.md },
  progressRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    marginBottom: Spacing.md, paddingHorizontal: Spacing.sm,
  },
  progressStep: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center' },
  progressDot: { width: 12, height: 12, borderRadius: 6 },
  progressLine: { flex: 1, height: 3, marginHorizontal: 2 },
  routeSection: { marginBottom: Spacing.md, gap: Spacing.xs },
  routeItem: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md, padding: 12,
  },
  routeText: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, textAlign: 'right' },
  actionsRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.error,
  },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  actionText: { fontSize: Typography.sm, fontWeight: '600' },
  chatIconWrap: { position: 'relative' },
  chatBadge: {
    position: 'absolute', top: -6, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bgWhite,
  },
  chatBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

const cancelStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.bgWhite,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: Spacing.xl + 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md,
  },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  list: { gap: Spacing.sm, marginBottom: Spacing.lg },
  item: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  itemSelected: { backgroundColor: Colors.error + '08', borderColor: Colors.error + '60' },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bgWhite, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  itemIconSelected: { backgroundColor: Colors.error, borderColor: Colors.error },
  itemLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  itemLabelSelected: { color: Colors.error, fontWeight: '700' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.error },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  btnRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  backBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  backText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn: {
    flex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.error,
  },
  confirmDisabled: { opacity: 0.45 },
  confirmText: { fontSize: Typography.base, color: '#fff', fontWeight: '700' },
});

const rStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: Spacing.xl + 10, alignItems: 'center', ...Shadows.lg,
  },
  title: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  ratingLabel: { fontSize: Typography.md, fontWeight: '600', color: Colors.accent, marginBottom: Spacing.md },
  commentInput: {
    width: '100%', backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.borderLight, minHeight: 80,
    marginBottom: Spacing.lg, textAlign: 'right',
  },
  btnRow: { flexDirection: 'row-reverse', gap: Spacing.sm, width: '100%' },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  skipText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center', ...Shadows.md,
  },
  submitDisabled: { backgroundColor: Colors.border },
  submitText: { fontSize: Typography.base, color: '#fff', fontWeight: '700' },
  successWrap: { alignItems: 'center', paddingVertical: Spacing.xl },
  successIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  successTitle: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  successSub: { fontSize: Typography.base, color: Colors.textSecondary },
});
