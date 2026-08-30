import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import {
  RewardData, RewardTransaction, LEVEL_CONFIG, REDEEM_OPTIONS,
} from '@/services/rewardsService';

// ─── Level helpers ────────────────────────────────────────────────────────────
const NEXT_LEVEL: Record<string, string | null> = {
  bronze: 'silver', silver: 'gold', gold: 'platinum', platinum: null,
};

function getLevelProgress(rewards: RewardData) {
  const cfg = LEVEL_CONFIG[rewards.level as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.bronze;
  const nextKey = NEXT_LEVEL[rewards.level];
  const nextCfg = nextKey ? LEVEL_CONFIG[nextKey as keyof typeof LEVEL_CONFIG] : null;
  const span = nextCfg ? nextCfg.min - cfg.min : 1;
  const done = rewards.total_earned - cfg.min;
  const pct = Math.min(100, Math.max(0, (done / span) * 100));
  const toNext = nextCfg ? Math.max(0, nextCfg.min - rewards.total_earned) : 0;
  return { cfg, nextCfg, pct, toNext };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonBox({ w, h, style }: { w?: number | string; h: number; style?: any }) {
  return <View style={[{ width: w ?? '100%', height: h, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.07)' }, style]} />;
}

function RewardsSkeleton() {
  return (
    <View style={{ padding: Spacing.md, gap: 12 }}>
      <SkeletonBox h={180} style={{ borderRadius: 20 }} />
      <SkeletonBox h={120} style={{ borderRadius: 16 }} />
      <SkeletonBox h={90} style={{ borderRadius: 16 }} />
    </View>
  );
}

// ─── Transaction Item ─────────────────────────────────────────────────────────
function TxItem({ tx }: { tx: RewardTransaction }) {
  const isEarn = tx.type === 'earn';
  return (
    <View style={txStyles.row}>
      <View style={txStyles.right}>
        <Text style={[txStyles.pts, { color: isEarn ? Colors.success : Colors.error }]}>
          {isEarn ? '+' : ''}{tx.points}
        </Text>
        <Text style={txStyles.date}>{new Date(tx.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</Text>
      </View>
      <View style={txStyles.mid}>
        <Text style={txStyles.desc} numberOfLines={2}>{tx.description}</Text>
        <View style={[txStyles.typeBadge, { backgroundColor: isEarn ? Colors.success + '15' : Colors.error + '15' }]}>
          <Text style={[txStyles.typeText, { color: isEarn ? Colors.success : Colors.error }]}>
            {isEarn ? 'اكتساب' : 'استبدال'}
          </Text>
        </View>
      </View>
      <View style={[txStyles.iconWrap, { backgroundColor: isEarn ? Colors.success + '15' : Colors.error + '15' }]}>
        <MaterialIcons name={isEarn ? 'add-circle' : 'remove-circle'} size={24} color={isEarn ? Colors.success : Colors.error} />
      </View>
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  iconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mid: { flex: 1 },
  desc: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', textAlign: 'right' },
  typeBadge: { alignSelf: 'flex-end', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  typeText: { fontSize: 10, fontFamily: 'Tajawal_700Bold' },
  right: { alignItems: 'flex-end', minWidth: 52 },
  pts: { fontSize: Typography.lg, fontFamily: 'Tajawal_800ExtraBold' },
  date: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'Tajawal_400Regular', marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [rewards, setRewards] = useState<RewardData | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      // Demo fallback
      setRewards({ id: 'demo', user_id: 'demo', points: 730, total_earned: 1230, total_redeemed: 500, level: 'silver' });
      setTransactions([
        { id: '1', user_id: 'demo', points: 50,   type: 'earn',   description: 'رحلة من التحرير إلى مدينة نصر', created_at: new Date(Date.now() - 2*3600000).toISOString() },
        { id: '2', user_id: 'demo', points: -100, type: 'redeem', description: 'استبدال بخصم 5 ج.م',           created_at: new Date(Date.now() - 24*3600000).toISOString() },
        { id: '3', user_id: 'demo', points: 35,   type: 'earn',   description: 'رحلة من الدقي إلى وسط البلد', created_at: new Date(Date.now() - 48*3600000).toISOString() },
        { id: '4', user_id: 'demo', points: 70,   type: 'earn',   description: 'مكافأة الإحالة',              created_at: new Date(Date.now() - 72*3600000).toISOString() },
      ]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Load rewards row (create if missing)
      let { data: rwData } = await supabase
        .from('rewards').select('*').eq('user_id', user.id).single();

      if (!rwData) {
        const { data: newRw } = await supabase
          .from('rewards')
          .insert({ user_id: user.id, points: 0, total_earned: 0, total_redeemed: 0, level: 'bronze' })
          .select().single();
        rwData = newRw;
      }

      const { data: txData } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (rwData) setRewards(rwData as RewardData);
      if (txData) setTransactions(txData as RewardTransaction[]);
    } catch {}

    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Redeem ──
  const handleRedeem = (option: typeof REDEEM_OPTIONS[0]) => {
    if (!rewards) return;
    if (rewards.points < option.points) {
      showAlert('رصيد غير كافٍ', `تحتاج ${option.points} نقطة. رصيدك الحالي: ${rewards.points} نقطة`);
      return;
    }
    showAlert(
      'تأكيد الاستبدال',
      `استبدال ${option.points} نقطة بـ "${option.label}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استبدال الآن',
          onPress: async () => {
            if (!user?.id) {
              // Demo mode local update
              setRewards(prev => prev ? { ...prev, points: prev.points - option.points, total_redeemed: prev.total_redeemed + option.points } : prev);
              showAlert('تم الاستبدال! ✓', `تم استبدال ${option.points} نقطة بـ ${option.label}`);
              return;
            }
            setRedeeming(option.id);
            try {
              const newPoints = rewards.points - option.points;
              const newRedeemed = rewards.total_redeemed + option.points;
              const newLevel = newPoints >= 2000 ? 'platinum' : newPoints >= 1000 ? 'gold' : newPoints >= 500 ? 'silver' : 'bronze';

              await supabase.from('rewards').update({
                points: newPoints,
                total_redeemed: newRedeemed,
                level: newLevel,
                updated_at: new Date().toISOString(),
              }).eq('user_id', user.id);

              await supabase.from('reward_transactions').insert({
                user_id: user.id,
                points: -option.points,
                type: 'redeem',
                description: `استبدال بـ ${option.label}`,
              });

              await loadData();
              showAlert('تم الاستبدال! ✓', `تم استبدال ${option.points} نقطة بـ ${option.label} بنجاح`);
            } catch (e: any) {
              showAlert('خطأ', e.message ?? 'حدث خطأ أثناء الاستبدال');
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#0D0D0D', '#1A1400']} style={styles.headerShell}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>نقاط المكافآت</Text>
            <View style={{ width: 38 }} />
          </View>
        </LinearGradient>
        <RewardsSkeleton />
      </View>
    );
  }

  const progress = rewards ? getLevelProgress(rewards) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── Header + Hero ── */}
      <LinearGradient colors={['#0D0D0D', '#1A1400', '#0D0D0D']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>نقاط المكافآت</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }} activeOpacity={0.8}>
            <MaterialIcons name="refresh" size={20} color={Colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Hero Points Card */}
        <View style={styles.heroCard}>
          <LinearGradient colors={['rgba(255,208,80,0.14)', 'rgba(232,160,32,0.06)']} style={styles.heroGrad}>
            {/* Level Badge */}
            {progress && (
              <View style={[styles.levelBadge, { borderColor: progress.cfg.color + '60', backgroundColor: progress.cfg.color + '18' }]}>
                <Text style={styles.levelIcon}>{progress.cfg.icon}</Text>
                <Text style={[styles.levelLabel, { color: progress.cfg.color }]}>{progress.cfg.label}</Text>
              </View>
            )}

            {/* Points */}
            <Text style={styles.pointsValue}>{(rewards?.points ?? 0).toLocaleString()}</Text>
            <Text style={styles.pointsLabel}>نقطة متاحة</Text>

            {/* Progress */}
            {progress && (
              <View style={styles.progressBlock}>
                <View style={styles.progressLabelRow}>
                  {progress.nextCfg ? (
                    <>
                      <Text style={styles.progressNext}>{progress.nextCfg.label} {progress.nextCfg.icon}</Text>
                      <Text style={styles.progressSub}>{progress.toNext.toLocaleString()} نقطة للمستوى التالي</Text>
                    </>
                  ) : (
                    <Text style={styles.progressSub}>أعلى مستوى 🎉</Text>
                  )}
                </View>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={['#FFD050', '#E8A020']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${progress.pct}%` }]}
                  />
                </View>
                <Text style={styles.progressPct}>{Math.round(progress.pct)}%</Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { val: (rewards?.total_earned ?? 0).toLocaleString(), label: 'مجموع مكتسب', color: Colors.success },
                { val: (rewards?.total_redeemed ?? 0).toLocaleString(), label: 'مجموع مستبدل', color: Colors.error },
              ].map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.statsDivider} />}
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                    <Text style={styles.statLbl}>{s.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} colors={[Colors.accent]} />
        }
      >
        {/* ── Earn Points Guide ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>كيف تكسب النقاط؟</Text>
          <View style={styles.earnGrid}>
            {[
              { icon: 'directions-car', label: 'لكل رحلة',    pts: '5 – 50',  color: Colors.primary },
              { icon: 'star',           label: 'تقييم رحلة',  pts: '+10',     color: Colors.accent },
              { icon: 'person-add',     label: 'دعوة صديق',   pts: '+100',    color: '#10B981' },
              { icon: 'cake',           label: 'يوم ميلادك',  pts: '+50',     color: '#8B5CF6' },
            ].map((item, i) => (
              <View key={i} style={styles.earnCard}>
                <View style={[styles.earnIcon, { backgroundColor: item.color + '15' }]}>
                  <MaterialIcons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.earnLabel}>{item.label}</Text>
                <Text style={[styles.earnPts, { color: item.color }]}>{item.pts} نقطة</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Redeem ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.redeemBalanceBadge}>
              <MaterialIcons name="stars" size={14} color={Colors.accent} />
              <Text style={styles.redeemBalanceText}>{rewards?.points ?? 0} نقطة</Text>
            </View>
            <Text style={styles.sectionTitle}>استبدل نقاطك</Text>
          </View>
          <View style={styles.redeemGrid}>
            {REDEEM_OPTIONS.map(opt => {
              const can = (rewards?.points ?? 0) >= opt.points;
              const isLoading = redeeming === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.redeemCard, !can && styles.redeemDisabled]}
                  onPress={() => handleRedeem(opt)}
                  activeOpacity={can ? 0.85 : 1}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={opt.color} size="small" />
                  ) : (
                    <>
                      <View style={[styles.redeemIcon, { backgroundColor: opt.color + '18' }]}>
                        <MaterialIcons name={opt.icon as any} size={26} color={can ? opt.color : 'rgba(255,255,255,0.25)'} />
                      </View>
                      <Text style={[styles.redeemLabel, !can && styles.redeemLabelDis]}>{opt.label}</Text>
                      <View style={[styles.redeemBadge, { backgroundColor: can ? opt.color : 'rgba(255,255,255,0.12)' }]}>
                        <MaterialIcons name="stars" size={10} color={can ? Colors.bgDark : 'rgba(255,255,255,0.3)'} />
                        <Text style={[styles.redeemBadgeText, !can && styles.redeemBadgeTextDis]}>
                          {opt.points}
                        </Text>
                      </View>
                      {!can && (
                        <Text style={styles.redeemNeed}>
                          يلزم {opt.points - (rewards?.points ?? 0)} نقطة
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Membership Levels ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>مستويات العضوية</Text>
          {(Object.entries(LEVEL_CONFIG) as [string, any][]).map(([key, cfg], i, arr) => {
            const isCurrent = rewards?.level === key;
            return (
              <View key={key} style={[styles.levelRow, isCurrent && styles.levelRowActive]}>
                {isCurrent && <View style={[styles.levelActiveBar, { backgroundColor: cfg.color }]} />}
                <View style={styles.levelRowLeft}>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: cfg.color }]}>
                      <Text style={styles.currentBadgeText}>مستواك</Text>
                    </View>
                  )}
                  <Text style={styles.levelRange} numberOfLines={1}>
                    {cfg.min.toLocaleString()} — {key === 'platinum' ? '∞' : cfg.max.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.levelRowRight}>
                  <View style={[styles.levelIconWrap, { backgroundColor: cfg.color + '18' }]}>
                    <Text style={styles.levelIconText}>{cfg.icon}</Text>
                  </View>
                  <Text style={[styles.levelName, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.levelDivider} />}
              </View>
            );
          })}
        </View>

        {/* ── Transactions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>سجل النقاط</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <MaterialIcons name="history" size={40} color="rgba(255,255,255,0.12)" />
              <Text style={styles.emptyTxText}>لا توجد معاملات بعد</Text>
            </View>
          ) : (
            transactions.map(tx => <TxItem key={tx.id} tx={tx} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1218' },

  // Header
  headerShell: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,208,80,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },

  // Hero
  heroCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,208,80,0.25)' },
  heroGrad: { padding: Spacing.lg, alignItems: 'center' },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full,
    borderWidth: 1.5, marginBottom: Spacing.sm,
  },
  levelIcon: { fontSize: 18 },
  levelLabel: { fontSize: Typography.sm, fontFamily: 'Tajawal_800ExtraBold', letterSpacing: 1 },
  pointsValue: { fontSize: 54, fontFamily: 'Tajawal_800ExtraBold', color: Colors.accent, lineHeight: 62 },
  pointsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular', marginBottom: Spacing.md },

  // Progress
  progressBlock: { width: '100%', marginBottom: Spacing.md },
  progressLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  progressNext: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },
  progressSub: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },
  progressTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 5, minWidth: 6 },
  progressPct: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs, textAlign: 'right', fontFamily: 'Tajawal_400Regular' },

  // Stats
  statsRow: {
    flexDirection: 'row-reverse', width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 },
  statVal: { fontSize: Typography.xl, fontFamily: 'Tajawal_800ExtraBold' },
  statLbl: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },

  // Section
  section: {
    backgroundColor: '#1A2235', borderRadius: BorderRadius.xl,
    margin: Spacing.md, marginBottom: 0, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: { color: '#fff', fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', textAlign: 'right', marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  redeemBalanceBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,208,80,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,208,80,0.2)',
  },
  redeemBalanceText: { color: Colors.accent, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },

  // Earn
  earnGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  earnCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  earnIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  earnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.sm, fontFamily: 'Tajawal_500Medium', textAlign: 'center' },
  earnPts: { fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },

  // Redeem
  redeemGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  redeemCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 110,
  },
  redeemDisabled: { opacity: 0.5 },
  redeemIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  redeemLabel: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold', textAlign: 'center' },
  redeemLabelDis: { color: 'rgba(255,255,255,0.3)' },
  redeemBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 4 },
  redeemBadgeText: { color: Colors.bgDark, fontSize: Typography.xs, fontFamily: 'Tajawal_700Bold' },
  redeemBadgeTextDis: { color: 'rgba(255,255,255,0.3)' },
  redeemNeed: { color: Colors.error, fontSize: 10, fontFamily: 'Tajawal_500Medium' },

  // Levels
  levelRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, position: 'relative',
  },
  levelRowActive: {
    backgroundColor: 'rgba(255,208,80,0.06)', marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
  },
  levelActiveBar: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  levelRowRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  levelRowLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  levelIconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  levelIconText: { fontSize: 22 },
  levelName: { fontSize: Typography.base, fontFamily: 'Tajawal_700Bold' },
  levelRange: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs, fontFamily: 'Tajawal_400Regular' },
  levelDivider: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  currentBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { color: Colors.bgDark, fontSize: 10, fontFamily: 'Tajawal_700Bold' },

  // Tx Empty
  emptyTx: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTxText: { color: 'rgba(255,255,255,0.3)', fontSize: Typography.sm, fontFamily: 'Tajawal_400Regular' },
});
