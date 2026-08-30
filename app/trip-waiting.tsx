import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { useNotifications } from '@/contexts/NotificationsContext';
import { scheduleRideAcceptedNotification } from '@/services/pushNotifications';

// ── Pulsing ring component ──────────────────────────────────────────
function PulseRing({ delay, size, color }: { delay: number; size: number; color: string }) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.4,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: color,
        opacity: opacityAnim,
        transform: [{ scale: scaleAnim }],
      }}
    />
  );
}

// ── Scanning dots ───────────────────────────────────────────────────
function ScanningDots() {
  const dots = [0, 1, 2];
  const anims = useRef(dots.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = dots.map(i =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(anims[i], { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anims[i], { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {dots.map(i => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: Colors.accent,
            opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
          }}
        />
      ))}
    </View>
  );
}

// ── Timeout configuration ─────────────────────────────────────────
// Change TIMEOUT_MINUTES to 1 for testing, 3 for production
const TIMEOUT_MINUTES = 1;
const TIMEOUT_SECONDS = TIMEOUT_MINUTES * 60;

// ── Main Screen ─────────────────────────────────────────────────────
export default function TripWaitingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { addNotification } = useNotifications();
  const supabase = getSupabaseClient();

  const { tripId, driverName: paramDriverName, price: paramPrice } = useLocalSearchParams<{
    tripId: string;
    driverName?: string;
    price?: string;
  }>();

  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);
  const [accepted, setAccepted] = useState(false);
  const [timeoutPromptShown, setTimeoutPromptShown] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef(false);
  const driverNameRef = useRef(paramDriverName ?? 'السائق');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer + countdown ────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(e => e + 1);
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── 3-minute timeout prompt ──────────────────────────────────────
  useEffect(() => {
    if (accepted || timeoutPromptShown) return;
    timeoutRef.current = setTimeout(() => {
      if (notifiedRef.current || accepted) return; // already accepted
      setTimeoutPromptShown(true);
      showAlert(
        'لا يزال البحث جارياً',
        `مضى أكثر من ${TIMEOUT_MINUTES} ${TIMEOUT_MINUTES === 1 ? 'دقيقة' : 'دقائق'} ولم يقبل أي سائق رحلتك بعد. هل تريد الانتظار أو إلغاء الطلب؟`,
        [
          {
            text: 'انتظر أكثر',
            style: 'cancel',
            onPress: () => setTimeoutPromptShown(false),
          },
          {
            text: 'إلغاء الطلب',
            style: 'destructive',
            onPress: async () => {
              if (pollRef.current) clearInterval(pollRef.current);
              if (tripId) {
                await supabase
                  .from('trips')
                  .update({ status: 'cancelled', cancellation_reason: 'driver_late', updated_at: new Date().toISOString() })
                  .eq('id', tripId);
              }
              router.back();
            },
          },
        ]
      );
    }, TIMEOUT_SECONDS * 1000); // configurable timeout
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [accepted, timeoutPromptShown, tripId]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Poll trip status ─────────────────────────────────────────────
  const pollTrip = useCallback(async () => {
    if (!tripId || notifiedRef.current) return;
    try {
      const { data } = await supabase
        .from('trips')
        .select('status, driver_id')
        .eq('id', tripId)
        .single();

      if (!data) return;

      if (data.status === 'active') {
        notifiedRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);

        // Fetch driver name
        let drvName = driverNameRef.current;
        if (data.driver_id) {
          const { data: drv } = await supabase
            .from('drivers')
            .select('name')
            .eq('id', data.driver_id)
            .single();
          if (drv?.name) { drvName = drv.name; driverNameRef.current = drv.name; }
        }

        scheduleRideAcceptedNotification(drvName);
        addNotification({
          type: 'ride_accepted',
          title: 'قبل السائق رحلتك!',
          body: `${drvName} قبل طلبك وهو في الطريق إليك`,
          time: 'الآن', icon: 'check-circle', iconColor: Colors.success,
        });

        setAccepted(true);
        // Navigate to trip-tracking after brief celebration
        setTimeout(() => {
          router.replace({ pathname: '/trip-tracking', params: { tripId } } as any);
        }, 1200);
      }

      if (data.status === 'cancelled') {
        notifiedRef.current = true;
        if (pollRef.current) clearInterval(pollRef.current);
        showAlert('تم إلغاء الرحلة', 'لم يتمكن أي سائق من قبول طلبك. حاول مرة أخرى.', [
          { text: 'حسناً', onPress: () => router.back() },
        ]);
      }
    } catch { /* silent */ }
  }, [tripId]);

  useEffect(() => {
    pollTrip();
    pollRef.current = setInterval(pollTrip, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollTrip]);

  const handleCancel = () => {
    showAlert('إلغاء الطلب', 'هل تريد إلغاء طلب الرحلة؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم، إلغاء',
        style: 'destructive',
        onPress: async () => {
          if (pollRef.current) clearInterval(pollRef.current);
          if (tripId) {
            await supabase
              .from('trips')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', tripId);
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.bgDark, Colors.bgNavy, '#1a1200']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Back */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <MaterialIcons name="arrow-forward" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}>

        {/* Pulse animation */}
        <View style={styles.pulseContainer}>
          <PulseRing delay={0}    size={180} color={accepted ? Colors.success : Colors.primary} />
          <PulseRing delay={500}  size={180} color={accepted ? Colors.success : Colors.primary} />
          <PulseRing delay={1000} size={180} color={accepted ? Colors.success : Colors.primary} />

          <LinearGradient
            colors={accepted
              ? [Colors.success + 'CC', Colors.success]
              : ['#E8A020CC', '#C47D0A']}
            style={styles.pulseCenter}
          >
            <MaterialIcons
              name={accepted ? 'check-circle' : 'directions-car'}
              size={52}
              color="#fff"
            />
          </LinearGradient>
        </View>

        {/* Status text */}
        <Text style={styles.statusTitle}>
          {accepted ? 'السائق قبل رحلتك!' : 'جارٍ البحث عن سائق...'}
        </Text>
        <Text style={styles.statusSub}>
          {accepted
            ? `${driverNameRef.current} في الطريق إليك`
            : 'انتظر قليلاً، نجهّز لك أفضل سائق قريب منك'}
        </Text>

        {/* Scanning dots */}
        {!accepted && (
          <View style={styles.dotsRow}>
            <Text style={styles.scanText}>يبحث</Text>
            <ScanningDots />
          </View>
        )}

        {/* Timer + Countdown */}
        <View style={[styles.timerCard, accepted && { borderColor: Colors.success + '60' }]}>
          <MaterialIcons name="timer" size={20} color={accepted ? Colors.success : Colors.accent} />
          <Text style={[styles.timerText, accepted && { color: Colors.success }]}>
            {formatTime(elapsed)}
          </Text>
          <Text style={styles.timerLabel}>وقت الانتظار</Text>
        </View>

        {/* Countdown to timeout alert */}
        {!accepted && !timeoutPromptShown && (
          <View style={styles.countdownCard}>
            <MaterialIcons
              name="hourglass-bottom"
              size={14}
              color={countdown < 30 ? Colors.error : Colors.accent}
            />
            <Text style={[styles.countdownText, countdown < 30 && { color: Colors.error }]}>
              {countdown > 0 ? formatTime(countdown) : 'منتهية'}
            </Text>
            <Text style={styles.countdownLabel}>حتى تنبيه المهلة</Text>
            {/* Countdown progress bar */}
            <View style={styles.countdownTrack}>
              <View
                style={[
                  styles.countdownFill,
                  {
                    width: `${(countdown / TIMEOUT_SECONDS) * 100}%`,
                    backgroundColor: countdown < 30 ? Colors.error : Colors.accent,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Trip info */}
        {paramPrice ? (
          <View style={styles.tripInfoCard}>
            <MaterialIcons name="payments" size={18} color={Colors.primary} />
            <Text style={styles.tripInfoText}>السعر المتوقع: {paramPrice} ج.م</Text>
          </View>
        ) : null}

        {/* Steps */}
        {!accepted && (
          <View style={styles.stepsCard}>
            {[
              { icon: 'search',         label: 'البحث عن سائق قريب منك',     done: true },
              { icon: 'person',         label: 'إرسال الطلب للسائق',           done: elapsed > 5 },
              { icon: 'directions-car', label: 'قبول السائق والانطلاق إليك',  done: false },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepDot, step.done && { backgroundColor: Colors.success }]}>
                  <MaterialIcons
                    name={step.done ? 'check' : step.icon as any}
                    size={14}
                    color={step.done ? '#fff' : Colors.textLight}
                  />
                </View>
                <Text style={[styles.stepText, step.done && { color: Colors.textPrimary, fontWeight: '600' }]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Cancel */}
        {!accepted && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
            <MaterialIcons name="close" size={18} color={Colors.error} />
            <Text style={styles.cancelText}>إلغاء الطلب</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute', right: Spacing.md,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg },
  pulseContainer: {
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  pulseCenter: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    ...{
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 12,
    },
  },
  statusTitle: {
    fontSize: Typography.xxl, fontWeight: '800',
    color: '#fff', textAlign: 'center', marginBottom: Spacing.xs,
  },
  statusSub: {
    fontSize: Typography.base, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: Spacing.lg,
  },
  scanText: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm },
  timerCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: Spacing.md,
  },
  timerText: { fontSize: Typography.xxxl, fontWeight: '800', color: Colors.accent, letterSpacing: 2 },
  timerLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)' },
  tripInfoCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.primary + '35',
    marginBottom: Spacing.md,
  },
  tripInfoText: { color: Colors.accent, fontSize: Typography.sm, fontWeight: '600' },
  stepsCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.xl,
    padding: Spacing.lg, width: '100%', gap: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Spacing.lg,
  },
  stepRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.md },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  stepText: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.45)', flex: 1, textAlign: 'right' },
  cancelBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.error + '60',
  },
  cancelText: { color: Colors.error, fontSize: Typography.base, fontWeight: '600' },
  countdownCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Spacing.md, width: '100%',
  },
  countdownText: { fontSize: Typography.base, fontWeight: '800', color: Colors.accent, letterSpacing: 1 },
  countdownLabel: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.35)', flex: 1, textAlign: 'right' },
  countdownTrack: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
  },
  countdownFill: { height: '100%', borderRadius: 2 },
});
