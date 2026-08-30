import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_DRIVERS, PAYMENT_METHODS } from '@/services/mockData';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { AVAILABLE_COUPONS, applyCoupon } from '@/services/coupons';
import { addRewardPoints } from '@/services/rewardsService';

const TRIP_TYPES = [
  { id: 'city',    label: 'داخل المدينة', icon: 'location-city' as const },
  { id: 'village', label: 'داخل القرى',   icon: 'home-work' as const },
  { id: 'travel',  label: 'سفر',           icon: 'flight' as const },
];

export default function DriverProfileScreen() {
  const {
    id,
    appliedCouponCode,
    appliedCouponDiscount,
    appliedCouponType,
    appliedCouponMax,
  } = useLocalSearchParams<{
    id: string;
    appliedCouponCode?: string;
    appliedCouponDiscount?: string;
    appliedCouponType?: string;
    appliedCouponMax?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();

  const driver = MOCK_DRIVERS.find(d => d.id === id) ?? MOCK_DRIVERS[0];
  const [selectedTrip, setSelectedTrip] = useState('city');
  const [selectedPayment, setSelectedPayment] = useState('1');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string; discount: number; type: 'percent' | 'fixed'; maxDiscount?: number;
  } | null>(null);

  // Auto-apply coupon returned from coupons screen via params
  useEffect(() => {
    if (appliedCouponCode && appliedCouponDiscount && appliedCouponType) {
      setAppliedCoupon({
        code: appliedCouponCode,
        discount: Number(appliedCouponDiscount),
        type: appliedCouponType as 'percent' | 'fixed',
        maxDiscount: Number(appliedCouponMax) || undefined,
      });
    }
  }, [appliedCouponCode, appliedCouponDiscount, appliedCouponType, appliedCouponMax]);

  const basePrice =
    selectedTrip === 'city'    ? driver.cityPrice.from :
    selectedTrip === 'village' ? driver.villagePrice.from :
    driver.pricePerKm * 10;

  const finalPrice = appliedCoupon
    ? (() => {
        if (appliedCoupon.type === 'percent') {
          const disc = (basePrice * appliedCoupon.discount) / 100;
          const capped = appliedCoupon.maxDiscount ? Math.min(disc, appliedCoupon.maxDiscount) : disc;
          return Math.max(0, basePrice - capped);
        }
        return Math.max(0, basePrice - appliedCoupon.discount);
      })()
    : basePrice;

  // ── Save trip to Supabase ────────────────────────────────────────
  const saveTrip = async (): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const supabase = getSupabaseClient();

      // Find real driver id from drivers table (if exists) or use mock id
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('id')
        .limit(1)
        .single();

      const paymentMethod = PAYMENT_METHODS.find(m => m.id === selectedPayment);
      const tripTypeLabel =
        selectedTrip === 'city'    ? 'داخل المدينة' :
        selectedTrip === 'village' ? 'داخل القرى'   : 'سفر';

      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          driver_id: driverRow?.id ?? null,
          from_location: 'موقعك الحالي',
          to_location: 'الوجهة المطلوبة',
          distance: '0 كم',
          duration: '0 دقيقة',
          price: finalPrice,
          status: 'pending',
          payment_method: paymentMethod?.name ?? 'كاش',
        })
        .select('id')
        .single();

      if (error) {
        console.error('Trip insert error:', error.message);
        return null;
      }
      return data?.id ?? null;
    } catch (e) {
      console.error('saveTrip exception:', e);
      return null;
    }
  };

  const handleBookRide = async () => {
    const priceLabel = appliedCoupon
      ? `${finalPrice} ج.م (بعد خصم ${appliedCoupon.code})`
      : `${finalPrice} ج.م`;

    showAlert(
      'تأكيد الطلب',
      `سيتم طلب رحلة مع ${driver.name}\nوقت الوصول: ${driver.eta}\nالسعر: ${priceLabel}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: async () => {
            setBookingLoading(true);
            const tripId = await saveTrip();
            setBookingLoading(false);

            if (tripId) {
              // Award points for booking (5 pts per trip)
              if (user?.id) {
                await addRewardPoints(
                  user.id,
                  5,
                  `رحلة مع ${driver.name}`
                ).catch(() => {/* silent */});
              }
              router.push({
                pathname: '/trip-waiting',
                params: { tripId, driverName: driver.name, price: String(finalPrice) },
              } as any);
            } else {
              // Proceed even without saving (demo/offline mode)
              router.push('/trip-tracking');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Hero Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.hero}>
        <View style={[styles.heroHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn}>
            <MaterialIcons name="more-vert" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.driverHeroInfo}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: driver.avatar }} style={styles.heroAvatar} contentFit="cover" transition={200} />
            <View style={[styles.statusBadge, { backgroundColor: driver.isOnline ? Colors.success : Colors.offline }]}>
              <Text style={styles.statusText}>{driver.isOnline ? 'متاح الآن' : 'غير متاح'}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{driver.name}</Text>
          <View style={styles.ratingRow}>
            {[1,2,3,4,5].map(i => (
              <MaterialIcons key={i} name="star" size={18} color={i <= Math.floor(driver.rating) ? Colors.accent : 'rgba(255,255,255,0.3)'} />
            ))}
            <Text style={styles.ratingValue}>{driver.rating}</Text>
            <Text style={styles.ratingCount}>({driver.reviewCount} تقييم)</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Vehicle Info */}
        <View style={styles.vehicleCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400&h=200&fit=crop' }}
            style={styles.vehicleImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleRow}>
              <MaterialIcons name="directions-car" size={18} color={Colors.primary} />
              <Text style={styles.vehicleName}>{driver.vehicle}</Text>
            </View>
            <View style={styles.vehicleRow}>
              <MaterialIcons name="confirmation-number" size={18} color={Colors.primary} />
              <Text style={styles.vehiclePlate}>{driver.plate}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: 'وقت الوصول',    value: driver.eta,                                              icon: 'schedule',      color: Colors.primary },
            { label: 'داخل المدينة', value: `${driver.cityPrice.from} - ${driver.cityPrice.to} ج.م`, icon: 'location-city', color: Colors.success },
            { label: 'داخل القرى',   value: `${driver.villagePrice.from} - ${driver.villagePrice.to} ج.م`, icon: 'home',    color: Colors.accent },
          ].map((stat, i) => (
            <View key={i} style={styles.statItem}>
              <MaterialIcons name={stat.icon as any} size={20} color={stat.color} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Trip Type */}
        <View style={styles.section}>
          <View style={styles.tripTypesRow}>
            {TRIP_TYPES.map(type => (
              <TouchableOpacity
                key={type.id}
                style={[styles.tripTypeBtn, selectedTrip === type.id && styles.tripTypeBtnActive]}
                onPress={() => setSelectedTrip(type.id)}
                activeOpacity={0.85}
              >
                <MaterialIcons name={type.icon} size={18} color={selectedTrip === type.id ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.tripTypeText, selectedTrip === type.id && styles.tripTypeTextActive]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.priceNote}>
            <Text style={styles.priceNoteText}>سفر (بالكيلو متر)</Text>
            <Text style={styles.priceNoteValue}>{driver.pricePerKm} جنيه لكل كم</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>طريقة الدفع</Text>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity
              key={method.id}
              style={styles.paymentRow}
              onPress={() => setSelectedPayment(method.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.radioOuter, selectedPayment === method.id && styles.radioOuterActive]}>
                {selectedPayment === method.id && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.paymentName}>{method.name}</Text>
              <View style={[styles.paymentIcon, { backgroundColor: method.color + '20' }]}>
                <MaterialIcons name="payment" size={18} color={method.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Coupon */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.couponRow}
            onPress={() =>
              router.push({
                pathname: '/coupons',
                params: { price: String(basePrice), driverId: driver.id },
              } as any)
            }
            activeOpacity={0.85}
          >
            {appliedCoupon ? (
              <>
                <MaterialIcons name="close" size={18} color={Colors.error}
                  onTouchEnd={(e) => { e.stopPropagation(); setAppliedCoupon(null); }}
                />
                <Text style={[styles.couponText, { color: Colors.success }]}>
                  {appliedCoupon.code} - وفرت {basePrice - finalPrice} ج.م
                </Text>
                <MaterialIcons name="check-circle" size={18} color={Colors.success} />
              </>
            ) : (
              <>
                <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
                <Text style={styles.couponText}>إضافة كوبون خصم</Text>
                <MaterialIcons name="local-offer" size={20} color={Colors.accent} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      <View style={[styles.bookSection, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={styles.priceSummaryRow}>
          {appliedCoupon && (
            <Text style={styles.originalPrice}>{basePrice} ج.م</Text>
          )}
          <Text style={styles.finalPrice}>{finalPrice} ج.م</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, bookingLoading && { opacity: 0.7 }]}
          onPress={handleBookRide}
          disabled={bookingLoading}
          activeOpacity={0.9}
        >
          {bookingLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="navigation" size={20} color="#fff" />
              <Text style={styles.bookBtnText}>طلب الرحلة</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  hero: { paddingBottom: Spacing.xl },
  heroHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  moreBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  driverHeroInfo: { alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: Spacing.sm },
  heroAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.accent },
  statusBadge: {
    position: 'absolute', bottom: 0, alignSelf: 'center',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.bgNavy,
  },
  statusText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  heroName: { color: '#fff', fontSize: Typography.xxl, fontWeight: '800', marginBottom: Spacing.xs },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  ratingValue: { color: Colors.accent, fontSize: Typography.md, fontWeight: '700', marginRight: 4 },
  ratingCount: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm },
  body: { flex: 1, marginTop: -Spacing.lg },
  vehicleCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    overflow: 'hidden', ...Shadows.md,
  },
  vehicleImage: { width: '100%', height: 130 },
  vehicleInfo: { padding: Spacing.md },
  vehicleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  vehicleName: { fontSize: Typography.md, fontWeight: '600', color: Colors.textPrimary },
  vehiclePlate: { fontSize: Typography.md, color: Colors.textSecondary },
  statsRow: {
    flexDirection: 'row-reverse', marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm, gap: Spacing.xs,
  },
  statItem: {
    flex: 1, backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.md,
    padding: Spacing.sm, alignItems: 'center', ...Shadows.sm,
  },
  statValue: { fontSize: Typography.xs, fontWeight: '700', color: Colors.textPrimary, marginTop: 4, textAlign: 'center' },
  statLabel: { fontSize: 10, color: Colors.textLight, textAlign: 'center' },
  section: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  tripTypesRow: { flexDirection: 'row-reverse', gap: Spacing.xs, marginBottom: Spacing.sm },
  tripTypeBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: BorderRadius.md, gap: 6,
    backgroundColor: Colors.bgWhite, borderWidth: 1, borderColor: Colors.border,
  },
  tripTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tripTypeText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
  tripTypeTextActive: { color: '#fff' },
  priceNote: {
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, flexDirection: 'row-reverse', justifyContent: 'space-between',
  },
  priceNoteText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '500' },
  priceNoteValue: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '700' },
  paymentRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 'auto',
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },
  paymentName: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  paymentIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  couponRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  couponText: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  bookSection: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    backgroundColor: Colors.bgWhite,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  priceSummaryRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  originalPrice: {
    fontSize: Typography.base, color: Colors.textLight,
    textDecorationLine: 'line-through',
  },
  finalPrice: { fontSize: Typography.xl, fontWeight: '800', color: Colors.primary },
  bookBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md,
  },
  bookBtnText: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
});
