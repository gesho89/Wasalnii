import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAlert } from '@/template';

type PaymentMethod = 'card' | 'vodafone' | 'etisalat' | 'orange' | 'we' | 'fawry' | 'instapay';

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  subLabel: string;
  icon: string;
  color: string;
  isOnline: boolean;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'card',
    label: 'بطاقة بنكية',
    subLabel: 'Visa / Mastercard / Meeza',
    icon: 'credit-card',
    color: '#2563EB',
    isOnline: true,
  },
  {
    id: 'vodafone',
    label: 'فودافون كاش',
    subLabel: 'ادفع عبر محفظة فودافون',
    icon: 'phone-android',
    color: '#E10A0A',
    isOnline: false,
  },
  {
    id: 'etisalat',
    label: 'اتصالات كاش',
    subLabel: 'ادفع عبر محفظة اتصالات',
    icon: 'phone-android',
    color: '#009B3A',
    isOnline: false,
  },
  {
    id: 'orange',
    label: 'أورنج كاش',
    subLabel: 'ادفع عبر محفظة أورنج',
    icon: 'phone-android',
    color: '#FF6600',
    isOnline: false,
  },
  {
    id: 'we',
    label: 'وي كاش',
    subLabel: 'ادفع عبر محفظة وي',
    icon: 'phone-android',
    color: '#7C3AED',
    isOnline: false,
  },
  {
    id: 'fawry',
    label: 'فوري',
    subLabel: 'ادفع في أقرب نقطة فوري',
    icon: 'store',
    color: '#F59E0B',
    isOnline: false,
  },
  {
    id: 'instapay',
    label: 'إنستا باي',
    subLabel: 'تحويل فوري عبر InstaPay',
    icon: 'bolt',
    color: '#059669',
    isOnline: false,
  },
];

// Instructions for each local payment method
const LOCAL_INSTRUCTIONS: Record<string, { steps: string[]; phone?: string; note: string }> = {
  vodafone: {
    steps: ['اتصل بـ *9*رقمنا#', 'أو افتح تطبيق فودافون كاش', 'اختر "تحويل" وأدخل المبلغ'],
    phone: '01XXXXXXXXX',
    note: 'سيتم تأكيد دفعتك خلال دقائق',
  },
  etisalat: {
    steps: ['افتح تطبيق إي-فلوس', 'اختر "ادفع فاتورة"', 'أدخل رقمنا والمبلغ'],
    phone: '01XXXXXXXXX',
    note: 'التأكيد خلال 5 دقائق',
  },
  orange: {
    steps: ['افتح تطبيق أورنج كاش', 'اختر "تحويل أموال"', 'أدخل رقمنا والمبلغ'],
    phone: '01XXXXXXXXX',
    note: 'التأكيد فوري',
  },
  we: {
    steps: ['افتح تطبيق وي محفظتي', 'اختر "تحويل"', 'أدخل رقمنا والمبلغ'],
    phone: '01XXXXXXXXX',
    note: 'التأكيد خلال دقيقتين',
  },
  fawry: {
    steps: ['اذهب لأقرب نقطة فوري', 'أعطِ الكاشير كود الدفع', 'احتفظ بإيصال الدفع'],
    note: 'الدفع عبر أكثر من 160,000 نقطة',
  },
  instapay: {
    steps: ['افتح تطبيق InstaPay', 'اختر "ادفع" > "رقم هاتف"', 'أدخل رقمنا والمبلغ وأكد'],
    phone: '01XXXXXXXXX',
    note: 'التحويل فوري — أرسل لقطة الشاشة للسائق',
  },
};

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ amount?: string; tripId?: string; description?: string }>();

  const amount = parseFloat(params.amount ?? '65');
  const tripId = params.tripId ?? '';
  const description = params.description ?? 'دفع رحلة تك توكي';

  const [selected, setSelected] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'cancel'>('idle');

  // Handle deep link redirects from Stripe
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const { url } = event;
      if (url.includes('payment/success')) {
        setPaymentStatus('success');
        setLoading(false);
      } else if (url.includes('payment/cancel')) {
        setPaymentStatus('cancel');
        setLoading(false);
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);

    // Check initial URL (if app opened from deep link)
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    return () => sub.remove();
  }, []);

  const handleCardPayment = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { amount, tripId, description },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const txt = await error.context?.text();
            const parsed = txt ? JSON.parse(txt) : null;
            msg = parsed?.error ?? txt ?? error.message;
          } catch {
            msg = error.message;
          }
        }
        showAlert('خطأ في الدفع', msg);
        setLoading(false);
        return;
      }

      if (data?.url) {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [amount, tripId, description]);

  const handleLocalPayment = useCallback(() => {
    const instructions = LOCAL_INSTRUCTIONS[selected];
    if (!instructions) return;

    const steps = instructions.steps.join('\n');
    showAlert(
      `الدفع عبر ${PAYMENT_OPTIONS.find(p => p.id === selected)?.label}`,
      `${steps}\n\n${instructions.note}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تم الدفع',
          onPress: () => {
            setPaymentStatus('success');
          },
        },
      ]
    );
  }, [selected]);

  const handlePay = () => {
    if (selected === 'card') {
      handleCardPayment();
    } else {
      handleLocalPayment();
    }
  };

  const selectedOption = PAYMENT_OPTIONS.find(p => p.id === selected)!;

  // ── Success Screen ───────────────────────────────────────────────
  if (paymentStatus === 'success') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <LinearGradient colors={[Colors.bgDark, '#0A1A00']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>تم الدفع بنجاح! 🎉</Text>
          <Text style={styles.successSub}>شكراً لاستخدامك تك توكي</Text>
          <View style={styles.successAmount}>
            <Text style={styles.successAmountLabel}>المبلغ المدفوع</Text>
            <Text style={styles.successAmountValue}>{amount} ج.م</Text>
          </View>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.replace('/(tabs)')}
          >
            <LinearGradient colors={['#FFD050', '#E8A020']} style={styles.successBtnGrad}>
              <Text style={styles.successBtnText}>العودة للرئيسية</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Cancel Screen ───────────────────────────────────────────────
  if (paymentStatus === 'cancel') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.cancelCard}>
          <MaterialIcons name="cancel" size={60} color={Colors.error} />
          <Text style={styles.cancelTitle}>تم إلغاء الدفع</Text>
          <Text style={styles.cancelSub}>لم يتم خصم أي مبلغ من حسابك</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => setPaymentStatus('idle')}>
            <Text style={styles.retryText}>حاول مجدداً</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>العودة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Payment Screen ───────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الدفع</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>إجمالي الرحلة</Text>
          <Text style={styles.amountValue}>{amount} ج.م</Text>
          <Text style={styles.amountDesc}>{description}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Payment Methods */}
        <Text style={styles.sectionTitle}>اختر طريقة الدفع</Text>

        {/* Online Payment */}
        <Text style={styles.methodGroupLabel}>دفع إلكتروني</Text>
        {PAYMENT_OPTIONS.filter(p => p.isOnline).map(opt => (
          <PaymentOptionCard
            key={opt.id}
            option={opt}
            selected={selected === opt.id}
            onSelect={() => setSelected(opt.id)}
          />
        ))}

        {/* Local Wallets */}
        <Text style={styles.methodGroupLabel}>محافظ إلكترونية محلية</Text>
        {PAYMENT_OPTIONS.filter(p => !p.isOnline).map(opt => (
          <PaymentOptionCard
            key={opt.id}
            option={opt}
            selected={selected === opt.id}
            onSelect={() => setSelected(opt.id)}
          />
        ))}

        {/* Security Note */}
        <View style={styles.securityNote}>
          <MaterialIcons name="lock" size={16} color={Colors.success} />
          <Text style={styles.securityText}>
            جميع المدفوعات محمية ومشفرة بالكامل
          </Text>
        </View>

        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>

      {/* Pay Button */}
      <View style={[styles.payFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.payFooterContent}>
          <View style={styles.payInfo}>
            <Text style={styles.payInfoMethod}>{selectedOption.label}</Text>
            <Text style={styles.payInfoAmount}>{amount} ج.م</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, loading && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? [Colors.border, Colors.border] : ['#FFD050', '#E8A020', '#C47D0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payBtnGrad}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bgDark} />
              ) : (
                <>
                  <MaterialIcons name="lock" size={18} color={Colors.bgDark} />
                  <Text style={styles.payBtnText}>ادفع الآن</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PaymentOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: PaymentOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected, { borderColor: selected ? option.color : Colors.borderLight }]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={[styles.optionRadio, selected && { borderColor: option.color, backgroundColor: option.color }]}>
        {selected && <MaterialIcons name="check" size={14} color="#fff" />}
      </View>
      <View style={styles.optionInfo}>
        <Text style={[styles.optionLabel, selected && { color: option.color }]}>{option.label}</Text>
        <Text style={styles.optionSub}>{option.subLabel}</Text>
      </View>
      <View style={[styles.optionIcon, { backgroundColor: option.color + '18' }]}>
        <MaterialIcons name={option.icon as any} size={24} color={option.color} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  amountCard: {
    marginHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,208,80,0.12)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(232,160,32,0.35)',
  },
  amountLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, marginBottom: 4 },
  amountValue: { fontSize: 48, fontWeight: '900', color: Colors.accent, lineHeight: 56 },
  amountDesc: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, marginTop: 4 },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'right', marginHorizontal: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.xs,
  },
  methodGroupLabel: {
    fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary,
    textAlign: 'right', marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.xs,
  },
  optionCard: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: Colors.bgWhite,
    marginHorizontal: Spacing.md, marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  optionCardSelected: {
    backgroundColor: '#FFFBF0',
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  optionInfo: { flex: 1 },
  optionLabel: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  optionSub: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  optionRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  securityNote: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginTop: Spacing.lg,
    padding: Spacing.sm, borderRadius: BorderRadius.md,
    backgroundColor: Colors.success + '10',
  },
  securityText: { flex: 1, fontSize: Typography.xs, color: Colors.success, textAlign: 'right', fontWeight: '500' },
  payFooter: {
    backgroundColor: Colors.bgWhite, paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    ...Shadows.lg,
  },
  payFooterContent: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  payInfo: { flex: 1 },
  payInfoMethod: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right' },
  payInfoAmount: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },
  payBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.md },
  payBtnDisabled: { opacity: 0.7 },
  payBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 28, paddingVertical: 16,
  },
  payBtnText: { color: Colors.bgDark, fontSize: Typography.md, fontWeight: '800' },
  // Success
  successCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, alignItems: 'center', marginHorizontal: Spacing.lg,
    borderWidth: 1, borderColor: Colors.success + '30', ...Shadows.lg,
  },
  successIcon: { marginBottom: Spacing.md },
  successTitle: { fontSize: Typography.xxl, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  successSub: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.lg },
  successAmount: {
    backgroundColor: Colors.success + '10', borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', width: '100%', marginBottom: Spacing.lg,
  },
  successAmountLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  successAmountValue: { fontSize: 36, fontWeight: '900', color: Colors.success },
  successBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', width: '100%' },
  successBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  successBtnText: { color: Colors.bgDark, fontSize: Typography.md, fontWeight: '800' },
  // Cancel
  cancelCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, alignItems: 'center', marginHorizontal: Spacing.lg,
    ...Shadows.lg, gap: Spacing.sm,
  },
  cancelTitle: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.textPrimary },
  cancelSub: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.md },
  retryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: 32, paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  backLink: { marginTop: Spacing.xs },
  backLinkText: { color: Colors.textSecondary, fontSize: Typography.sm },
});
