import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { WALLET_TRANSACTIONS, PAYMENT_METHODS } from '@/services/mockData';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

type FilterKey = 'الكل' | 'هذا الأسبوع' | 'هذا الشهر' | 'واردة' | 'صادرة';

const FILTERS: FilterKey[] = ['الكل', 'هذا الأسبوع', 'هذا الشهر', 'واردة', 'صادرة'];

function getTransactionConfig(type: string) {
  if (type === 'credit') return { icon: 'arrow-downward', color: Colors.success, bg: Colors.success + '15', sign: '+', label: 'وارد' };
  return { icon: 'arrow-upward', color: Colors.error, bg: Colors.error + '15', sign: '-', label: 'صادر' };
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();
  const router = useRouter();

  const [balance] = useState(580.00);
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [charging, setCharging] = useState(false);
  const [completedTrips, setCompletedTrips] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('trips').select('price, status')
          .eq('user_id', user.id).eq('status', 'completed');
        if (data) {
          setCompletedTrips(data.length);
          setTotalSpent(data.reduce((s, t) => s + Number(t.price), 0));
        }
      } catch {}
    })();
  }, [user?.id]);

  const handleCharge = async () => {
    if (!chargeAmount || isNaN(parseFloat(chargeAmount)) || parseFloat(chargeAmount) <= 0) {
      showAlert('تنبيه', 'أدخل مبلغ صحيح للشحن');
      return;
    }
    setCharging(true);
    await new Promise(r => setTimeout(r, 1500));
    setCharging(false);
    setChargeModal(false);
    setChargeAmount('');
    showAlert('تم الشحن', `تم إضافة ${chargeAmount} ج.م إلى محفظتك بنجاح`);
  };

  // Filter transactions
  const filteredTransactions = WALLET_TRANSACTIONS.filter(t => {
    const matchSearch = !searchQuery || t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'واردة') return t.type === 'credit' && matchSearch;
    if (activeFilter === 'صادرة') return t.type === 'debit' && matchSearch;
    return matchSearch;
  });

  const totalIn = WALLET_TRANSACTIONS.filter(t => t.type === 'credit').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalOut = WALLET_TRANSACTIONS.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount), 0);

  const renderTransaction = ({ item }: { item: typeof WALLET_TRANSACTIONS[0] }) => {
    const cfg = getTransactionConfig(item.type);
    return (
      <View style={styles.txRow}>
        <View style={styles.txLeft}>
          <Text style={[styles.txAmount, { color: cfg.color }]}>
            {cfg.sign}{Math.abs(item.amount)} ج.م
          </Text>
          <Text style={styles.txDate}>{item.date}</Text>
          <View style={[styles.txStatusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.txStatusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.txCenter}>
          <Text style={styles.txDesc}>{item.description}</Text>
          <Text style={styles.txRef}>مرجع: #{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={[styles.txIconWrap, { backgroundColor: cfg.bg }]}>
          <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[1]}>

        {/* ── Premium Balance Card ── */}
        <View style={styles.balanceSection}>
          <LinearGradient
            colors={['#0D0D0D', '#1A1200', '#0D0D0D']}
            style={styles.balanceCardBg}
          >
            {/* Header Row */}
            <View style={styles.walletHeaderRow}>
              <TouchableOpacity style={styles.walletSettingsBtn} onPress={() => router.push('/settings' as any)}>
                <MaterialIcons name="settings" size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              <Text style={styles.walletTitle}>محفظتي</Text>
              <View style={styles.walletBadge}>
                <MaterialIcons name="account-balance-wallet" size={14} color={Colors.accent} />
                <Text style={styles.walletBadgeText}>نشطة</Text>
              </View>
            </View>

            {/* Balance Display */}
            <View style={styles.balanceDisplay}>
              <TouchableOpacity onPress={() => setBalanceVisible(v => !v)} style={styles.eyeToggle}>
                <MaterialIcons name={balanceVisible ? 'visibility' : 'visibility-off'} size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
              <View style={styles.balanceAmountWrap}>
                {balanceVisible ? (
                  <>
                    <Text style={styles.balanceInt}>{Math.floor(balance).toLocaleString()}</Text>
                    <View style={styles.balanceCentsWrap}>
                      <Text style={styles.balanceCents}>.{(balance % 1).toFixed(2).slice(2)}</Text>
                      <Text style={styles.balanceCurr}>ج.م</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.balanceHidden}>● ● ● ●</Text>
                )}
              </View>
              <Text style={styles.balanceLabel}>الرصيد المتاح</Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.success + '18' }]}>
                  <MaterialIcons name="arrow-downward" size={14} color={Colors.success} />
                </View>
                <Text style={[styles.statVal, { color: Colors.success }]}>{totalIn} ج.م</Text>
                <Text style={styles.statLbl}>إجمالي الوارد</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.error + '18' }]}>
                  <MaterialIcons name="arrow-upward" size={14} color={Colors.error} />
                </View>
                <Text style={[styles.statVal, { color: Colors.error }]}>{totalOut} ج.م</Text>
                <Text style={styles.statLbl}>إجمالي الصادر</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <View style={[styles.statIconWrap, { backgroundColor: Colors.primary + '18' }]}>
                  <MaterialIcons name="directions-car" size={14} color={Colors.primary} />
                </View>
                <Text style={[styles.statVal, { color: Colors.primary }]}>{completedTrips}</Text>
                <Text style={styles.statLbl}>رحلات مكتملة</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              {[
                { icon: 'add', label: 'شحن', color: Colors.success, onPress: () => setChargeModal(true) },
                { icon: 'remove', label: 'سحب', color: Colors.error, onPress: () => showAlert('قريباً', 'السحب سيكون متاحاً قريباً') },
                { icon: 'swap-horiz', label: 'تحويل', color: '#3B82F6', onPress: () => showAlert('قريباً', 'التحويل سيكون متاحاً قريباً') },
                { icon: 'receipt-long', label: 'كشف', color: Colors.accent, onPress: () => showAlert('قريباً', 'كشف الحساب سيكون متاحاً قريباً') },
              ].map((action, i) => (
                <TouchableOpacity key={i} style={styles.quickAction} onPress={action.onPress} activeOpacity={0.8}>
                  <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18', borderColor: action.color + '30' }]}>
                    <MaterialIcons name={action.icon as any} size={22} color={action.color} />
                  </View>
                  <Text style={styles.quickActionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ── Payment Methods (sticky header placeholder) ── */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>طرق الدفع</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentRow}>
            {PAYMENT_METHODS.slice(0, 4).map(method => (
              <TouchableOpacity key={method.id} style={styles.paymentCard} activeOpacity={0.85}>
                <View style={[styles.paymentIconWrap, { backgroundColor: method.color + '15' }]}>
                  <MaterialIcons name="payment" size={22} color={method.color} />
                </View>
                <Text style={styles.paymentName}>{method.name}</Text>
                <View style={styles.paymentAddBtn}>
                  <MaterialIcons name="add" size={12} color={Colors.accent} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Weekly Stats ── */}
        <View style={styles.weeklySection}>
          <Text style={styles.sectionTitle}>هذا الأسبوع</Text>
          <View style={styles.weeklyRow}>
            {[
              { label: 'الإثنين', val: 45, max: 100 },
              { label: 'الثلاثاء', val: 80, max: 100 },
              { label: 'الأربعاء', val: 30, max: 100 },
              { label: 'الخميس', val: 95, max: 100 },
              { label: 'الجمعة', val: 60, max: 100 },
              { label: 'السبت', val: 70, max: 100 },
              { label: 'الأحد', val: 50, max: 100 },
            ].map((day, i) => (
              <View key={i} style={styles.weeklyBar}>
                <Text style={styles.weeklyVal}>{day.val > 0 ? day.val : ''}</Text>
                <View style={styles.weeklyBarTrack}>
                  <View style={[
                    styles.weeklyBarFill,
                    {
                      height: `${day.val}%`,
                      backgroundColor: i === 3 ? Colors.accent : Colors.primary + '70',
                    },
                  ]} />
                </View>
                <Text style={styles.weeklyLabel} numberOfLines={1}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Transactions ── */}
        <View style={styles.txSection}>
          {/* Header */}
          <View style={styles.txHeader}>
            <TouchableOpacity style={styles.txSeeAll}>
              <Text style={styles.txSeeAllText}>عرض الكل</Text>
              <MaterialIcons name="chevron-left" size={16} color={Colors.accent} />
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>آخر المعاملات</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={18} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="ابحث في المعاملات"
              placeholderTextColor="rgba(255,255,255,0.25)"
              textAlign="right"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.35)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* List */}
          {filteredTransactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <LinearGradient colors={['rgba(232,160,32,0.1)', 'rgba(232,160,32,0.02)']} style={styles.emptyTxGrad}>
                <MaterialIcons name="receipt-long" size={44} color="rgba(232,160,32,0.3)" />
              </LinearGradient>
              <Text style={styles.emptyTxTitle}>لا توجد معاملات</Text>
              <Text style={styles.emptyTxSub}>لم تقم بأي عمليات مالية بعد</Text>
            </View>
          ) : (
            filteredTransactions.map((item, i) => (
              <View key={item.id}>
                {renderTransaction({ item })}
                {i < filteredTransactions.length - 1 && <View style={styles.txSeparator} />}
              </View>
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* ── Charge Modal ── */}
      <Modal visible={chargeModal} transparent animationType="slide" statusBarTranslucent>
        <View style={modalStyles.overlay}>
          <TouchableOpacity style={modalStyles.backdrop} activeOpacity={1} onPress={() => setChargeModal(false)} />
          <View style={[modalStyles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={modalStyles.handle} />

            <View style={modalStyles.header}>
              <TouchableOpacity onPress={() => setChargeModal(false)}>
                <MaterialIcons name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              <Text style={modalStyles.title}>شحن المحفظة</Text>
              <View style={modalStyles.titleIcon}>
                <MaterialIcons name="account-balance-wallet" size={18} color={Colors.accent} />
              </View>
            </View>

            <Text style={modalStyles.label}>المبلغ المراد إضافته</Text>
            <View style={modalStyles.inputWrap}>
              <Text style={modalStyles.currency}>ج.م</Text>
              <TextInput
                style={modalStyles.input}
                value={chargeAmount}
                onChangeText={setChargeAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                textAlign="right"
                autoFocus
              />
            </View>

            <View style={modalStyles.quickRow}>
              {['50', '100', '200', '500'].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={[modalStyles.quickBtn, chargeAmount === amt && modalStyles.quickBtnActive]}
                  onPress={() => setChargeAmount(amt)}
                  activeOpacity={0.8}
                >
                  <Text style={[modalStyles.quickBtnText, chargeAmount === amt && modalStyles.quickBtnTextActive]}>
                    {amt} ج
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={modalStyles.payMethodRow}>
              <Text style={modalStyles.payMethodLabel}>طريقة الدفع:</Text>
              <View style={styles.filterChip}>
                <MaterialIcons name="payment" size={13} color={Colors.accent} />
                <Text style={[styles.filterChipText, { color: Colors.accent }]}>فيزا / ماستر</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[modalStyles.chargeBtn, charging && { opacity: 0.7 }]}
              onPress={handleCharge}
              disabled={charging}
              activeOpacity={0.88}
            >
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} style={modalStyles.chargeBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {charging ? (
                  <ActivityIndicator color={Colors.bgDark} size="small" />
                ) : (
                  <MaterialIcons name="add" size={20} color={Colors.bgDark} />
                )}
                <Text style={modalStyles.chargeBtnText}>
                  {charging ? 'جاري الشحن...' : `شحن ${chargeAmount ? chargeAmount + ' ج.م' : 'الآن'}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // Balance Section
  balanceSection: {},
  balanceCardBg: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  walletHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  walletTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  walletBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,208,80,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },
  walletBadgeText: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },
  walletSettingsBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center',
  },

  // Balance Display
  balanceDisplay: { alignItems: 'center', paddingVertical: Spacing.lg },
  eyeToggle: { marginBottom: 4 },
  balanceAmountWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 4 },
  balanceInt: { color: '#fff', fontSize: 56, fontFamily: 'Tajawal_800ExtraBold', lineHeight: 60 },
  balanceCentsWrap: { alignItems: 'flex-start', paddingBottom: 8 },
  balanceCents: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.lg, fontFamily: 'Tajawal_700Bold' },
  balanceCurr: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  balanceHidden: { color: 'rgba(255,255,255,0.4)', fontSize: 32, letterSpacing: 6, paddingVertical: 10 },
  balanceLabel: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular' },

  // Stats
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: Spacing.md,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: Typography.md, fontFamily: 'Tajawal_800ExtraBold' },
  statLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Tajawal_400Regular', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },

  // Quick Actions
  quickActions: { flexDirection: 'row-reverse', justifyContent: 'space-around' },
  quickAction: { alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  quickActionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },

  // Payment Methods
  paymentSection: { backgroundColor: '#1A2235', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { color: '#fff', fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', textAlign: 'right', marginBottom: Spacing.sm },
  paymentRow: { paddingBottom: 4, gap: Spacing.sm },
  paymentCard: {
    alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg, padding: Spacing.sm, width: 80,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paymentName: { fontSize: 10, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontFamily: 'Tajawal_400Regular' },
  paymentAddBtn: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,208,80,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },

  // Weekly
  weeklySection: { backgroundColor: '#1A2235', padding: Spacing.md, marginTop: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  weeklyRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', height: 90, gap: 4 },
  weeklyBar: { flex: 1, alignItems: 'center', height: '100%' },
  weeklyVal: { fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 2 },
  weeklyBarTrack: { flex: 1, width: '80%', justifyContent: 'flex-end', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3 },
  weeklyBarFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  weeklyLabel: { fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 3, textAlign: 'center' },

  // Transactions
  txSection: { backgroundColor: '#1A2235', padding: Spacing.md, marginTop: 4 },
  txHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  txSeeAll: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  txSeeAllText: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },

  // Search
  searchBar: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', paddingVertical: 2 },

  // Filter Chips
  filterRow: { paddingBottom: Spacing.sm, gap: 6 },
  filterChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, fontFamily: 'Tajawal_500Medium' },
  filterChipTextActive: { color: Colors.bgDark, fontFamily: 'Tajawal_700Bold' },

  // Transaction Row
  txRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, gap: Spacing.sm },
  txIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txCenter: { flex: 1 },
  txDesc: { color: '#fff', fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold', textAlign: 'right' },
  txRef: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'Tajawal_400Regular', textAlign: 'right', marginTop: 3 },
  txLeft: { alignItems: 'flex-end', gap: 3 },
  txAmount: { fontSize: Typography.base, fontFamily: 'Tajawal_800ExtraBold' },
  txDate: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Tajawal_400Regular' },
  txStatusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  txStatusText: { fontSize: 9, fontFamily: 'Tajawal_700Bold' },
  txSeparator: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: Spacing.sm },

  // Empty
  emptyTx: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxGrad: { borderRadius: 50, padding: 22, marginBottom: 4 },
  emptyTxTitle: { color: '#fff', fontSize: Typography.md, fontFamily: 'Tajawal_700Bold' },
  emptyTxSub: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular' },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: '#1A2235', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: Spacing.md },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  title: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  titleIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,208,80,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', textAlign: 'right', marginBottom: Spacing.sm },
  inputWrap: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: 'rgba(255,208,80,0.25)',
  },
  currency: { color: Colors.accent, fontSize: Typography.xl, fontFamily: 'Tajawal_700Bold', paddingRight: 8 },
  input: { flex: 1, color: '#fff', fontSize: 36, fontFamily: 'Tajawal_800ExtraBold', paddingVertical: 14 },
  quickRow: { flexDirection: 'row-reverse', gap: Spacing.sm, marginBottom: Spacing.md },
  quickBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  quickBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  quickBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold' },
  quickBtnTextActive: { color: Colors.bgDark },
  payMethodRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  payMethodLabel: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium' },
  chargeBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  chargeBtnGrad: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  chargeBtnText: { color: Colors.bgDark, fontSize: Typography.md, fontFamily: 'Tajawal_800ExtraBold' },
});
