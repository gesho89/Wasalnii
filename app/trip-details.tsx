import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_TRIPS } from '@/services/mockData';
import { useAlert } from '@/template';

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [printing, setPrinting] = useState(false);

  const trip = MOCK_TRIPS.find(t => t.id === id) ?? MOCK_TRIPS[0];

  const handlePrintInvoice = async () => {
    setPrinting(true);
    await new Promise(r => setTimeout(r, 1500));
    setPrinting(false);
    showAlert('الفاتورة', 'تم إرسال الفاتورة إلى بريدك الإلكتروني بنجاح');
  };

  const handleReorder = () => {
    showAlert(
      'إعادة الطلب',
      `هل تريد إعادة طلب رحلة مع ${trip.driver.name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'نعم، اطلب', onPress: () => router.push(`/driver/${trip.driver.id}`) },
      ]
    );
  };

  const baseFare = Math.round(trip.price * 0.6);
  const distanceFare = Math.round(trip.price * 0.3);
  const serviceFee = trip.price - baseFare - distanceFare;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>تفاصيل الرحلة</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: trip.status === 'completed' ? Colors.success + '25' : Colors.error + '25',
          }]}>
            <Text style={[styles.statusText, {
              color: trip.status === 'completed' ? Colors.success : Colors.error,
            }]}>
              {trip.status === 'completed' ? 'مكتملة' : 'ملغاة'}
            </Text>
          </View>
        </View>

        {/* Trip ID & Date */}
        <View style={styles.tripMeta}>
          <Text style={styles.tripDate}>{trip.date} · {trip.time}</Text>
          <Text style={styles.tripId}>#{trip.id}</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Map Route Placeholder */}
        <View style={styles.mapContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=300&fit=crop' }}
            style={styles.mapImage}
            contentFit="cover"
            transition={200}
          />
          {/* Route overlay */}
          <View style={styles.mapOverlay}>
            <View style={styles.routeLine}>
              <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
              <View style={styles.routeConnector} />
              <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
            </View>
          </View>
          {/* Distance badge */}
          <View style={styles.distanceBadge}>
            <MaterialIcons name="straighten" size={14} color={Colors.primary} />
            <Text style={styles.distanceText}>{trip.distance}</Text>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>مسار الرحلة</Text>
          <View style={styles.routeBlock}>
            <View style={styles.routeItem}>
              <View style={styles.routeIconBg}>
                <MaterialIcons name="radio-button-checked" size={18} color={Colors.success} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>نقطة الانطلاق</Text>
                <Text style={styles.routeText}>{trip.from}</Text>
              </View>
            </View>
            <View style={styles.routeVertical} />
            <View style={styles.routeItem}>
              <View style={styles.routeIconBg}>
                <MaterialIcons name="location-on" size={18} color={Colors.error} />
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>نقطة الوصول</Text>
                <Text style={styles.routeText}>{trip.to}</Text>
              </View>
            </View>
          </View>

          {/* Trip Stats */}
          <View style={styles.statsRow}>
            {[
              { label: 'المسافة', value: trip.distance, icon: 'straighten', color: Colors.primary },
              { label: 'المدة', value: trip.duration, icon: 'schedule', color: Colors.success },
              { label: 'التقييم', value: trip.rating > 0 ? `${trip.rating} ★` : '-', icon: 'star', color: Colors.accent },
            ].map((s, i) => (
              <View key={i} style={styles.statItem}>
                <MaterialIcons name={s.icon as any} size={18} color={s.color} />
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Driver Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>معلومات السائق</Text>
          <TouchableOpacity
            style={styles.driverRow}
            onPress={() => router.push(`/driver/${trip.driver.id}`)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{trip.driver.name}</Text>
              <Text style={styles.driverVehicle}>{trip.driver.vehicle}</Text>
              <View style={styles.ratingRow}>
                {[1,2,3,4,5].map(i => (
                  <MaterialIcons key={i} name="star" size={13} color={i <= trip.driver.rating ? Colors.accent : Colors.border} />
                ))}
                <Text style={styles.ratingText}>{trip.driver.rating}</Text>
              </View>
            </View>
            <Image source={{ uri: trip.driver.avatar }} style={styles.driverAvatar} contentFit="cover" transition={200} />
          </TouchableOpacity>

          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleDetailItem}>
              <Text style={styles.vehicleDetailVal}>{trip.driver.plate}</Text>
              <Text style={styles.vehicleDetailLabel}>رقم اللوحة</Text>
            </View>
            <View style={styles.vehicleDetailDivider} />
            <View style={styles.vehicleDetailItem}>
              <Text style={styles.vehicleDetailVal}>{trip.driver.vehicleType}</Text>
              <Text style={styles.vehicleDetailLabel}>نوع المركبة</Text>
            </View>
            <View style={styles.vehicleDetailDivider} />
            <View style={styles.vehicleDetailItem}>
              <Text style={styles.vehicleDetailVal}>{trip.driver.trips.toLocaleString()}</Text>
              <Text style={styles.vehicleDetailLabel}>إجمالي الرحلات</Text>
            </View>
          </View>
        </View>

        {/* Price Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ملخص السعر</Text>
          <View style={styles.priceRows}>
            {[
              { label: 'أجرة الأساسية', value: baseFare },
              { label: 'رسوم المسافة', value: distanceFare },
              { label: 'رسوم الخدمة', value: serviceFee },
            ].map((row, i) => (
              <View key={i} style={styles.priceRow}>
                <Text style={styles.priceVal}>{row.value} ج.م</Text>
                <Text style={styles.priceLabel}>{row.label}</Text>
              </View>
            ))}
            <View style={styles.priceDivider} />
            <View style={[styles.priceRow, styles.priceTotalRow]}>
              <Text style={styles.priceTotalVal}>{trip.price} ج.م</Text>
              <Text style={styles.priceTotalLabel}>الإجمالي</Text>
            </View>
          </View>

          <View style={styles.paymentMethodRow}>
            <View style={styles.paymentBadge}>
              <MaterialIcons name="payment" size={16} color={Colors.primary} />
              <Text style={styles.paymentBadgeText}>محفظة تك توكي</Text>
            </View>
            <Text style={styles.paymentLabel}>طريقة الدفع</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity style={styles.printBtn} onPress={handlePrintInvoice} disabled={printing} activeOpacity={0.85}>
          {printing ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              <MaterialIcons name="receipt-long" size={18} color={Colors.primary} />
              <Text style={styles.printBtnText}>طباعة الفاتورة</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.reorderBtn} onPress={handleReorder} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={18} color="#fff" />
          <Text style={styles.reorderBtnText}>إعادة الطلب</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingBottom: Spacing.lg, paddingHorizontal: Spacing.md },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full },
  statusText: { fontSize: Typography.sm, fontWeight: '700' },
  tripMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingBottom: Spacing.sm },
  tripId: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm },
  tripDate: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.sm },
  mapContainer: {
    height: 180, position: 'relative',
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md,
  },
  mapImage: { width: '100%', height: '100%' },
  mapOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(26,86,219,0.08)',
  },
  routeLine: { alignItems: 'center' },
  routeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  routeConnector: { width: 3, height: 60, backgroundColor: Colors.primary, opacity: 0.7 },
  distanceBadge: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6, ...Shadows.sm,
  },
  distanceText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.primary },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    margin: Spacing.md, marginBottom: 0, padding: Spacing.md, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.md },
  routeBlock: { marginBottom: Spacing.md },
  routeItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: Spacing.sm },
  routeIconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right' },
  routeText: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right' },
  routeVertical: { width: 2, height: 20, backgroundColor: Colors.border, marginVertical: 4, marginRight: 16 },
  statsRow: { flexDirection: 'row-reverse', gap: Spacing.xs },
  statItem: {
    flex: 1, backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md,
    padding: Spacing.sm, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: Typography.base, fontWeight: '700' },
  statLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  driverRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  driverAvatar: { width: 54, height: 54, borderRadius: 27 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  driverVehicle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginVertical: 2 },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: Typography.xs, color: Colors.textSecondary, marginRight: 4 },
  vehicleDetails: {
    flexDirection: 'row-reverse', backgroundColor: Colors.bgLight,
    borderRadius: BorderRadius.md, padding: Spacing.md,
  },
  vehicleDetailItem: { flex: 1, alignItems: 'center', gap: 4 },
  vehicleDetailVal: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  vehicleDetailLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  vehicleDetailDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  priceRows: { gap: Spacing.xs },
  priceRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: Typography.base, color: Colors.textSecondary },
  priceVal: { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
  priceDivider: { height: 1.5, backgroundColor: Colors.border, marginVertical: 4, borderStyle: 'dashed' },
  priceTotalRow: {},
  priceTotalLabel: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
  priceTotalVal: { fontSize: Typography.xl, fontWeight: '800', color: Colors.primary },
  paymentMethodRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  paymentLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  paymentBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  paymentBadgeText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '600' },
  bottomActions: {
    flexDirection: 'row-reverse', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    backgroundColor: Colors.bgWhite,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    ...Shadows.lg,
  },
  printBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  printBtnText: { color: Colors.primary, fontSize: Typography.base, fontWeight: '600' },
  reorderBtn: {
    flex: 1.5, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, ...Shadows.md,
  },
  reorderBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
});
