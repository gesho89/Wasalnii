import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import { AVAILABLE_COUPONS, applyCoupon, Coupon } from '@/services/coupons';

export default function CouponsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ price?: string; driverId?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const originalPrice = Number(params.price) || 65;

  const handleApplyCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);

    const found = AVAILABLE_COUPONS.find(
      c => c.code.toLowerCase() === code.trim().toUpperCase() && !c.isUsed
    );

    if (!found) {
      showAlert('كود غير صالح', 'الكود الذي أدخلته غير صحيح أو منتهي الصلاحية');
      return;
    }
    if (originalPrice < found.minAmount) {
      showAlert('الحد الأدنى', `هذا الكود يتطلب حد أدنى ${found.minAmount} ج.م`);
      return;
    }
    setAppliedCoupon(found);
    setCode('');
  };

  const handleSelectCoupon = (coupon: Coupon) => {
    if (coupon.isUsed) {
      showAlert('مستخدم', 'هذا الكوبون تم استخدامه مسبقاً');
      return;
    }
    if (originalPrice < coupon.minAmount) {
      showAlert('الحد الأدنى', `هذا الكوبون يتطلب حد أدنى ${coupon.minAmount} ج.م`);
      return;
    }
    setAppliedCoupon(coupon);
    // Auto-apply immediately if driverId is available
    if (params.driverId) {
      router.navigate({
        pathname: '/driver/[id]',
        params: {
          id: params.driverId,
          appliedCouponCode: coupon.code,
          appliedCouponDiscount: String(coupon.discount),
          appliedCouponType: coupon.type,
          appliedCouponMax: String(coupon.maxDiscount ?? 0),
        },
      } as any);
    }
  };

  const discountedPrice = appliedCoupon ? applyCoupon(appliedCoupon, originalPrice) : originalPrice;
  const savedAmount = originalPrice - discountedPrice;

  const handleConfirm = () => {
    if (!appliedCoupon || !params.driverId) {
      router.back();
      return;
    }
    // Navigate back to driver screen with coupon params attached
    router.navigate({
      pathname: '/driver/[id]',
      params: {
        id: params.driverId,
        appliedCouponCode: appliedCoupon.code,
        appliedCouponDiscount: String(appliedCoupon.discount),
        appliedCouponType: appliedCoupon.type,
        appliedCouponMax: String(appliedCoupon.maxDiscount ?? 0),
      },
    } as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>كوبونات الخصم</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Code Input */}
        <View style={styles.codeInputRow}>
          <TouchableOpacity
            style={[styles.applyBtn, loading && { opacity: 0.7 }]}
            onPress={handleApplyCode}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.applyBtnText}>تطبيق</Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.codeInput}
            placeholder="أدخل كود الخصم..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={code}
            onChangeText={setCode}
            textAlign="right"
            autoCapitalize="characters"
          />
          <MaterialIcons name="confirmation-number" size={20} color="rgba(255,255,255,0.6)" style={styles.codeIcon} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Applied Coupon Summary */}
        {appliedCoupon && (
          <View style={styles.appliedCard}>
            <TouchableOpacity style={styles.removeCoupon} onPress={() => setAppliedCoupon(null)}>
              <MaterialIcons name="close" size={16} color={Colors.error} />
            </TouchableOpacity>
            <View style={styles.appliedInfo}>
              <Text style={styles.appliedTitle}>تم تطبيق الكوبون!</Text>
              <Text style={styles.appliedCode}>{appliedCoupon.code}</Text>
            </View>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>وفرت {savedAmount} ج.م</Text>
            </View>
            <MaterialIcons name="check-circle" size={28} color={Colors.success} />
          </View>
        )}

        {/* Price Summary */}
        {originalPrice > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص السعر</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryVal}>{originalPrice} ج.م</Text>
              <Text style={styles.summaryLabel}>السعر الأصلي</Text>
            </View>
            {appliedCoupon && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryVal, { color: Colors.success }]}>- {savedAmount} ج.م</Text>
                <Text style={styles.summaryLabel}>قيمة الخصم</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalVal}>{discountedPrice} ج.م</Text>
              <Text style={styles.totalLabel}>الإجمالي</Text>
            </View>
          </View>
        )}

        {/* Available Coupons */}
        <Text style={styles.sectionTitle}>العروض المتاحة</Text>
        {AVAILABLE_COUPONS.map(coupon => {
          const isApplied = appliedCoupon?.id === coupon.id;
          return (
            <TouchableOpacity
              key={coupon.id}
              style={[
                styles.couponCard,
                coupon.isUsed && styles.couponUsed,
                isApplied && styles.couponApplied,
              ]}
              onPress={() => handleSelectCoupon(coupon)}
              activeOpacity={coupon.isUsed ? 1 : 0.88}
            >
              {/* Left stripe */}
              <View style={[styles.couponStripe, { backgroundColor: coupon.isUsed ? Colors.border : coupon.color }]} />

              {/* Dashed separator */}
              <View style={styles.couponDash} />

              {/* Right side */}
              <View style={styles.couponRight}>
                <View style={styles.couponCodeRow}>
                  {isApplied && (
                    <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                  )}
                  {coupon.isUsed && (
                    <View style={styles.usedBadge}>
                      <Text style={styles.usedBadgeText}>مستخدم</Text>
                    </View>
                  )}
                  <Text style={[styles.couponCode, coupon.isUsed && styles.couponCodeUsed]}>
                    {coupon.code}
                  </Text>
                </View>
                <Text style={[styles.couponDesc, coupon.isUsed && { color: Colors.textLight }]}>
                  {coupon.description}
                </Text>
                <View style={styles.couponMeta}>
                  <Text style={[styles.couponExpiry, coupon.isUsed && { color: Colors.textLight }]}>
                    {coupon.expiresIn}
                  </Text>
                  <Text style={[styles.couponMin, coupon.isUsed && { color: Colors.textLight }]}>
                    حد أدنى {coupon.minAmount} ج.م
                  </Text>
                </View>
              </View>

              {/* Left badge */}
              <View style={[styles.couponLeft, { backgroundColor: coupon.isUsed ? Colors.bgLight : coupon.color + '12' }]}>
                <MaterialIcons name={coupon.icon as any} size={24} color={coupon.isUsed ? Colors.textLight : coupon.color} />
                <Text style={[styles.discountAmount, { color: coupon.isUsed ? Colors.textLight : coupon.color }]}>
                  {coupon.type === 'percent' ? `${coupon.discount}%` : `${coupon.discount} ج`}
                </Text>
                <Text style={[styles.discountLabel, { color: coupon.isUsed ? Colors.textLight : coupon.color }]}>خصم</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirm Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.9}>
          <Text style={styles.confirmBtnText}>
            {appliedCoupon
              ? `تأكيد - الدفع ${discountedPrice} ج.م`
              : 'متابعة بدون خصم'}
          </Text>
          <MaterialIcons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  codeInputRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, marginTop: Spacing.xs,
  },
  codeIcon: { paddingHorizontal: 4 },
  codeInput: {
    flex: 1, color: '#fff', fontSize: Typography.base,
    paddingVertical: 14, textAlign: 'right',
  },
  applyBtn: {
    backgroundColor: Colors.accent, borderRadius: BorderRadius.sm,
    paddingHorizontal: 18, paddingVertical: 10,
    minWidth: 70, alignItems: 'center',
  },
  applyBtnText: { color: Colors.bgDark, fontSize: Typography.sm, fontWeight: '800' },
  scroll: { padding: Spacing.md },
  appliedCard: {
    backgroundColor: Colors.success + '12', borderRadius: BorderRadius.lg,
    borderWidth: 1.5, borderColor: Colors.success + '40',
    padding: Spacing.md, flexDirection: 'row-reverse', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  appliedInfo: { flex: 1 },
  appliedTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.success, textAlign: 'right' },
  appliedCode: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },
  savingsBadge: {
    backgroundColor: Colors.success, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  savingsText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  removeCoupon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  summaryTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  summaryLabel: { fontSize: Typography.base, color: Colors.textSecondary },
  summaryVal: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
  totalRow: { borderBottomWidth: 0, paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
  totalVal: { fontSize: Typography.xl, fontWeight: '800', color: Colors.primary },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  couponCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    flexDirection: 'row-reverse', marginBottom: Spacing.sm,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  couponUsed: { opacity: 0.6 },
  couponApplied: { borderColor: Colors.success, borderWidth: 1.5 },
  couponStripe: { width: 5 },
  couponDash: {
    width: 1, marginVertical: 12,
    borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderLight,
  },
  couponRight: { flex: 1, padding: Spacing.md },
  couponCodeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  couponCode: { fontSize: Typography.md, fontWeight: '800', color: Colors.textPrimary },
  couponCodeUsed: { color: Colors.textLight },
  couponDesc: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  couponMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  couponExpiry: { fontSize: Typography.xs, color: Colors.warning, fontWeight: '500' },
  couponMin: { fontSize: Typography.xs, color: Colors.textLight },
  couponLeft: {
    width: 88, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: 4,
  },
  discountAmount: { fontSize: Typography.xl, fontWeight: '800' },
  discountLabel: { fontSize: Typography.xs, fontWeight: '600' },
  usedBadge: {
    backgroundColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  usedBadgeText: { fontSize: 10, color: Colors.textLight, fontWeight: '600' },
  footer: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md,
  },
  confirmBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
});
