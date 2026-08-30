
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { ADMIN_STATS, ADMIN_COMPLAINTS, MOCK_DRIVERS } from '@/services/mockData';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const { width } = Dimensions.get('window');

const CHART_DATA = [40, 65, 50, 80, 70, 90, 85, 95, 75, 88, 92, 100];
const CHART_MONTHS = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const STAT_CARDS = [
  { label: 'الركلات', value: ADMIN_STATS.totalTrips.toLocaleString(), icon: 'directions-car', color: Colors.primary, bg: Colors.primaryLight },
  { label: 'الإيرادات', value: `${(ADMIN_STATS.totalEarnings / 1000).toFixed(1)}k`, icon: 'trending-up', color: Colors.success, bg: Colors.success + '18' },
  { label: 'الإيرادات', value: `${(ADMIN_STATS.totalRevenue / 1000).toFixed(1)}k`, icon: 'attach-money', color: Colors.accent, bg: Colors.accent + '18' },
  { label: 'الشكاوى', value: ADMIN_STATS.totalComplaints.toString(), icon: 'report-problem', color: Colors.error, bg: Colors.error + '18' },
];

const NAV_ITEMS = [
  { icon: 'home', label: 'الرئيسية' },
  { icon: 'people', label: 'السائقين' },
  { icon: 'directions-car', label: 'الرحلات' },
  { icon: 'report-problem', label: 'الشكاوى' },
  { icon: 'account-balance-wallet', label: 'المدفوعات' },
  { icon: 'bar-chart', label: 'التقارير' },
  { icon: 'settings', label: 'الإعدادات' },
  { icon: 'exit-to-app', label: 'تسجيل خروج' },
];

// Extended mock drivers for admin with status fields
const ADMIN_DRIVERS = MOCK_DRIVERS.map((d, i) => ({
  ...d,
  active: i !== 3,
  joinDate: `2024-0${i + 1}-15`,
  totalTrips: d.trips,
  earnings: Math.round(d.trips * 45),
}));

// ── Cancellation Reason Pie Chart ─────────────────────────────────────────
const CANCEL_REASON_LABELS: Record<string, string> = {
  driver_late: 'السائق تأخر',
  plan_changed: 'تغيير الخطة',
  wrong_order: 'خطأ في الطلب',
  found_other: 'وجدت وسيلة أخرى',
  other: 'سبب آخر',
};

const PIE_COLORS = [Colors.primary, Colors.error, Colors.success, Colors.accent, Colors.info];

interface CancelStat { reason: string; count: number; pct: number; color: string }

function CancellationPieChart({ data }: { data: CancelStat[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return (
    <View style={pieStyles.empty}>
      <MaterialIcons name="pie-chart" size={44} color={Colors.borderLight} />
      <Text style={pieStyles.emptyText}>لا توجد بيانات إلغاء</Text>
    </View>
  );

  // Build simple horizontal bar chart (no SVG required)
  return (
    <View style={pieStyles.container}>
      {/* Visual: horizontal bars acting as a bar representation */}
      <View style={pieStyles.barsArea}>
        {data.map((d, i) => (
          <View key={d.reason} style={pieStyles.barRow}>
            <Text style={pieStyles.barCount}>{d.count}</Text>
            <View style={pieStyles.barTrack}>
              <View style={[pieStyles.barFill, { width: `${d.pct}%`, backgroundColor: d.color }]} />
            </View>
            <View style={pieStyles.barLabelWrap}>
              <View style={[pieStyles.colorDot, { backgroundColor: d.color }]} />
              <Text style={pieStyles.barLabel} numberOfLines={1}>{CANCEL_REASON_LABELS[d.reason] ?? d.reason}</Text>
            </View>
          </View>
        ))}
      </View>
      {/* Donut-style legend summary */}
      <View style={pieStyles.legendRow}>
        {data.map(d => (
          <View key={d.reason} style={pieStyles.legendItem}>
            <Text style={[pieStyles.legendPct, { color: d.color }]}>{d.pct.toFixed(0)}%</Text>
            <Text style={pieStyles.legendLabel} numberOfLines={1}>{(CANCEL_REASON_LABELS[d.reason] ?? d.reason).split(' ')[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthContext();
  const { showAlert } = useAlert();
  const [activeNav, setActiveNav] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Cancellation stats ────────────────────────────────────────
  const [cancelStats, setCancelStats] = useState<CancelStat[]>([]);
  const [cancelLoading, setCancelLoading] = useState(true);

  // ── Detailed reports ──────────────────────────────────────────────
  type ReportPeriod = 'daily' | 'weekly' | 'monthly';
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [reportData, setReportData] = useState<{ label: string; trips: number; revenue: number }[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTripCount, setTotalTripCount] = useState(0);

  // ── Load detailed reports ────────────────────────────────────
  useEffect(() => {
    (async () => {
      setReportLoading(true);
      try {
        const supabase = getSupabaseClient();
        const now = new Date();
        const buckets: { label: string; from: Date; to: Date }[] = [];
        if (reportPeriod === 'daily') {
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            const from = new Date(d); from.setHours(0, 0, 0, 0);
            const to = new Date(d); to.setHours(23, 59, 59, 999);
            buckets.push({ label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }), from, to });
          }
        } else if (reportPeriod === 'weekly') {
          for (let i = 5; i >= 0; i--) {
            const from = new Date(now); from.setDate(from.getDate() - (i + 1) * 7); from.setHours(0, 0, 0, 0);
            const to = new Date(now); to.setDate(to.getDate() - i * 7); to.setHours(23, 59, 59, 999);
            buckets.push({ label: `أسبوع ${6 - i}`, from, to });
          }
        } else {
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now); d.setMonth(d.getMonth() - i);
            const from = new Date(d.getFullYear(), d.getMonth(), 1);
            const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
            buckets.push({ label: d.toLocaleDateString('ar-EG', { month: 'short' }), from, to });
          }
        }
        const results = await Promise.all(
          buckets.map(async b => {
            const { data } = await supabase.from('trips').select('price')
              .eq('status', 'completed')
              .gte('created_at', b.from.toISOString())
              .lte('created_at', b.to.toISOString());
            return { label: b.label, trips: data?.length ?? 0, revenue: data?.reduce((s, t) => s + Number(t.price), 0) ?? 0 };
          })
        );
        setReportData(results);
        setTotalRevenue(results.reduce((s, r) => s + r.revenue, 0));
        setTotalTripCount(results.reduce((s, r) => s + r.trips, 0));
      } catch { /* silent */ }
      finally { setReportLoading(false); }
    })();
  }, [reportPeriod]);

  useEffect(() => {
    (async () => { // Add this async IIFE wrapper
      setCancelLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('trips')
          .select('cancellation_reason')
          .eq('status', 'cancelled')
          .not('cancellation_reason', 'is', null);

        if (!data || data.length === 0) { setCancelLoading(false); return; }

        const counts: Record<string, number> = {};
        for (const row of data) {
          const r = row.cancellation_reason as string;
          counts[r] = (counts[r] ?? 0) + 1;
        }
        const total = data.length;
        const stats: CancelStat[] = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([reason, count], i) => ({
            reason,
            count,
            pct: (count / total) * 100,
            color: PIE_COLORS[i % PIE_COLORS.length],
          }));
        setCancelStats(stats);
      } catch { /* silent */ }
      finally { setCancelLoading(false); }
    })(); // Close the async IIFE
  }, []);
  const [driverStatuses, setDriverStatuses] = useState<Record<string, boolean>>(
    Object.fromEntries(ADMIN_DRIVERS.map(d => [d.id, d.active]))
  );

  const toggleDriverStatus = (id: string, name: string, currentStatus: boolean) => {
    showAlert(
      currentStatus ? 'تعطيل الحساب' : 'تفعيل الحساب',
      `هل تريد ${currentStatus ? 'تعطيل' : 'تفعيل'} حساب السائق ${name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: currentStatus ? 'تعطيل' : 'تفعيل',
          style: currentStatus ? 'destructive' : 'default',
          onPress: () => setDriverStatuses(prev => ({ ...prev, [id]: !currentStatus })),
        },
      ]
    );
  };

  const handleNavPress = (idx: number, label: string) => {
    setActiveNav(idx);
    if (label === 'تسجيل خروج') {
      showAlert('تسجيل الخروج', 'هل تريد الخروج من لوحة التحكم؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', onPress: () => { logout(); router.replace('/'); } },
      ]);
    }
    setSidebarOpen(false);
  };

  const maxChart = Math.max(...CHART_DATA);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <TouchableOpacity style={styles.sidebarOverlay} onPress={() => setSidebarOpen(false)} activeOpacity={1}>
          <View style={styles.sidebar}>
            <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.sidebarGradient}>
              <View style={styles.sidebarHeader}>
                <Image source={require('@/assets/images/logo.png')} style={styles.sidebarLogo} contentFit="contain" transition={200} />
                <Text style={styles.sidebarTitle}>تك توكي</Text>
                <Text style={styles.sidebarSubtitle}>لوحة الإدارة</Text>
              </View>
              {NAV_ITEMS.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.navItem, activeNav === i && styles.navItemActive]}
                  onPress={() => handleNavPress(i, item.label)}
                >
                  <Text style={[styles.navLabel, activeNav === i && styles.navLabelActive]}>{item.label}</Text>
                  <MaterialIcons name={item.icon as any} size={22} color={activeNav === i ? Colors.accent : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </View>
        </TouchableOpacity>
      )}

      {/* Main Content */}
      <View style={styles.main}>
        {/* Top Bar */}
        <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.topBar}>
          <View style={styles.topBarContent}>
            <TouchableOpacity onPress={() => setSidebarOpen(true)}>
              <MaterialIcons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>لوحة التحكم الإدارية</Text>
            <TouchableOpacity style={styles.topBarIcon}>
              <MaterialIcons name="settings" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((card, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: card.bg }]}>
                <View style={[styles.statIconBg, { backgroundColor: card.color + '25' }]}>
                  <MaterialIcons name={card.icon as any} size={22} color={card.color} />
                </View>
                <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>الرحلات</Text>
              </View>
              <Text style={styles.chartTitle}>إحصائيات الرحلات</Text>
            </View>
            <View style={styles.chartArea}>
              {CHART_DATA.slice(-7).map((val, i) => (
                <View key={i} style={styles.chartBar}>
                  <View style={[styles.chartBarFill, {
                    height: (val / maxChart) * 100,
                    backgroundColor: i === 6 ? Colors.primary : Colors.primary + '60',
                  }]} />
                  <Text style={styles.chartBarLabel}>{CHART_MONTHS[i + 5].slice(0, 3)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Complaints */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <TouchableOpacity>
                <Text style={styles.seeAll}>عرض الكل</Text>
              </TouchableOpacity>
              <Text style={styles.sectionTitle}>الشكاوى الأخيرة</Text>
            </View>
            {ADMIN_COMPLAINTS.map(complaint => (
              <View key={complaint.id} style={styles.complaintRow}>
                <TouchableOpacity style={styles.complaintAction}>
                  <Text style={styles.complaintActionText}>معالجة</Text>
                </TouchableOpacity>
                <View style={styles.complaintInfo}>
                  <Text style={styles.complaintTitle}>شكوى من {complaint.from} ضد {complaint.against}</Text>
                  <Text style={styles.complaintReason}>{complaint.reason}</Text>
                </View>
                <Image source={{ uri: complaint.avatar }} style={styles.complaintAvatar} contentFit="cover" transition={200} />
              </View>
            ))}
          </View>

          {/* Drivers Management */}
          {(activeNav === 0 || activeNav === 1) && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <TouchableOpacity onPress={() => setActiveNav(1)}>
                  <Text style={styles.seeAll}>عرض الكل</Text>
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>إدارة السائقين</Text>
              </View>
              {ADMIN_DRIVERS.map(driver => {
                const isActive = driverStatuses[driver.id] ?? driver.active;
                return (
                  <View key={driver.id} style={styles.driverRow}>
                    <TouchableOpacity
                      style={[
                        styles.driverToggleBtn,
                        { backgroundColor: isActive ? Colors.error + '12' : Colors.success + '12' },
                      ]}
                      onPress={() => toggleDriverStatus(driver.id, driver.name, isActive)}
                    >
                      <MaterialIcons
                        name={isActive ? 'block' : 'check-circle'}
                        size={16}
                        color={isActive ? Colors.error : Colors.success}
                      />
                      <Text style={[
                        styles.driverToggleText,
                        { color: isActive ? Colors.error : Colors.success },
                      ]}>
                        {isActive ? 'تعطيل' : 'تفعيل'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.driverAdminInfo}>
                      <Text style={styles.driverAdminName}>{driver.name}</Text>
                      <View style={styles.driverAdminMeta}>
                        <View style={[styles.statusIndicator, { backgroundColor: isActive ? Colors.success : Colors.offline }]} />
                        <Text style={styles.driverAdminMetaText}>
                          {isActive ? 'نشط' : 'معطل'}
                        </Text>
                        <Text style={styles.driverAdminMetaDivider}>·</Text>
                        <MaterialIcons name="star" size={11} color={Colors.accent} />
                        <Text style={styles.driverAdminMetaText}>{driver.rating}</Text>
                        <Text style={styles.driverAdminMetaDivider}>·</Text>
                        <Text style={styles.driverAdminMetaText}>{driver.totalTrips.toLocaleString()} رحلة</Text>
                      </View>
                      <Text style={styles.driverAdminVehicle}>{driver.vehicle}</Text>
                    </View>
                    <Image source={{ uri: driver.avatar }} style={styles.driverAdminAvatar} contentFit="cover" transition={200} />
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Detailed Reports ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={pieStyles.headerBadge}>
                <Text style={pieStyles.headerBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>تقارير مفصلة</Text>
            </View>
            {/* Period Tabs */}
            <View style={reportStyles.periodRow}>
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[reportStyles.periodBtn, reportPeriod === p && reportStyles.periodBtnActive]}
                  onPress={() => setReportPeriod(p)}
                >
                  <Text style={[reportStyles.periodText, reportPeriod === p && reportStyles.periodTextActive]}>
                    {p === 'daily' ? 'يومي' : p === 'weekly' ? 'أسبوعي' : 'شهري'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Summary */}
            <View style={reportStyles.summaryRow}>
              <View style={[reportStyles.summaryCard, { backgroundColor: Colors.primary + '12' }]}>
                <MaterialIcons name="directions-car" size={16} color={Colors.primary} />
                <Text style={[reportStyles.summaryVal, { color: Colors.primary }]}>{totalTripCount}</Text>
                <Text style={reportStyles.summaryLbl}>رحلات مكتملة</Text>
              </View>
              <View style={[reportStyles.summaryCard, { backgroundColor: Colors.success + '12' }]}>
                <MaterialIcons name="attach-money" size={16} color={Colors.success} />
                <Text style={[reportStyles.summaryVal, { color: Colors.success }]}>{totalRevenue.toFixed(0)} ج.م</Text>
                <Text style={reportStyles.summaryLbl}>إجمالي الإيرادات</Text>
              </View>
            </View>
            {reportLoading ? (
              <View style={pieStyles.loadingWrap}><ActivityIndicator color={Colors.accent} /></View>
            ) : reportData.every(d => d.trips === 0) ? (
              <View style={pieStyles.empty}>
                <MaterialIcons name="bar-chart" size={44} color={Colors.borderLight} />
                <Text style={pieStyles.emptyText}>لا توجد بيانات بعد</Text>
              </View>
            ) : (
              <View style={reportStyles.chartArea}>
                {reportData.map((item, i) => {
                  const maxT = Math.max(...reportData.map(d => d.trips), 1);
                  const pct = (item.trips / maxT) * 100;
                  return (
                    <View key={i} style={reportStyles.barColV}>
                      <Text style={reportStyles.barValLabel}>{item.trips > 0 ? item.trips : ''}</Text>
                      <View style={reportStyles.barTrackV}>
                        <View style={[
                          reportStyles.barFillV,
                          {
                            height: `${Math.max(pct, 4)}%`,
                            backgroundColor: i === reportData.length - 1 ? Colors.primary : Colors.primary + '65',
                          },
                        ]} />
                      </View>
                      <Text style={reportStyles.barXLbl} numberOfLines={1}>{item.label}</Text>
                      {item.revenue > 0 && (
                        <Text style={reportStyles.barRevLbl}>{(item.revenue / 1000).toFixed(1)}k</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Cancellation Reasons Chart ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={pieStyles.headerBadge}>
                <Text style={pieStyles.headerBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>أسباب إلغاء الرحلات</Text>
            </View>
            {cancelLoading ? (
              <View style={pieStyles.loadingWrap}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : (
              <CancellationPieChart data={cancelStats} />
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
            <View style={styles.actionsGrid}>
              {[
                { icon: 'person-add', label: 'إضافة سائق', color: Colors.primary },
                { icon: 'block', label: 'حظر سائق', color: Colors.error },
                { icon: 'local-offer', label: 'عروض خاصة', color: Colors.accent },
                { icon: 'notifications', label: 'إشعار جماعي', color: Colors.success },
              ].map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.actionItem}
                  onPress={() => showAlert(action.label, 'هذه الميزة ستكون متاحة قريباً')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                    <MaterialIcons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
    flexDirection: 'row-reverse',
  },
  sidebar: { width: 260, height: '100%' },
  sidebarGradient: { flex: 1, paddingTop: 60 },
  sidebarHeader: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl, alignItems: 'flex-end' },
  sidebarLogo: { width: 60, height: 60, borderRadius: 12 },
  sidebarTitle: { color: '#fff', fontSize: Typography.xxl, fontWeight: '800', marginTop: Spacing.sm },
  sidebarSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm },
  navItem: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)', borderRightWidth: 3, borderRightColor: Colors.accent },
  navLabel: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: Typography.base, textAlign: 'right' },
  navLabelActive: { color: '#fff', fontWeight: '600' },
  main: { flex: 1 },
  topBar: { paddingBottom: Spacing.md },
  topBarContent: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  topBarTitle: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  topBarIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm },
  statCard: {
    width: (width - Spacing.md * 2 - Spacing.sm) / 2 - 1,
    borderRadius: BorderRadius.xl, padding: Spacing.md, alignItems: 'flex-end',
  },
  statIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xxl, fontWeight: '800' },
  statLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  chartCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.md, ...Shadows.sm,
  },
  chartHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  chartTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  chartLegend: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: Typography.xs, color: Colors.textSecondary },
  chartArea: { flexDirection: 'row-reverse', alignItems: 'flex-end', height: 120, gap: 6 },
  chartBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 120 },
  chartBarFill: { width: '80%', borderRadius: 4, minHeight: 4 },
  chartBarLabel: { fontSize: 9, color: Colors.textLight, marginTop: 4 },
  sectionCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.md, ...Shadows.sm,
  },
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  seeAll: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  complaintRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  complaintAvatar: { width: 44, height: 44, borderRadius: 22 },
  complaintInfo: { flex: 1 },
  complaintTitle: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  complaintReason: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  complaintAction: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primary + '18', borderRadius: 8,
    marginLeft: 'auto',
  },
  complaintActionText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '600' },
  driverRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  driverAdminAvatar: { width: 46, height: 46, borderRadius: 23 },
  driverAdminInfo: { flex: 1 },
  driverAdminName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 3 },
  driverAdminVehicle: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', marginTop: 2 },
  driverAdminMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  driverAdminMetaText: { fontSize: Typography.xs, color: Colors.textSecondary },
  driverAdminMetaDivider: { color: Colors.border, fontSize: Typography.xs },
  statusIndicator: { width: 7, height: 7, borderRadius: 4 },
  driverToggleBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  driverToggleText: { fontSize: Typography.xs, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  actionItem: { width: '48%', alignItems: 'center', gap: Spacing.xs },
  actionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
});

const pieStyles = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  barsArea: { gap: Spacing.sm },
  barRow: { gap: 6 },
  barLabelWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  barTrack: {
    height: 12, backgroundColor: Colors.bgLight, borderRadius: 6,
    overflow: 'hidden', marginVertical: 2,
  },
  barFill: { height: '100%', borderRadius: 6, minWidth: 8 },
  barCount: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', fontWeight: '600' },
  legendRow: {
    flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  legendItem: { alignItems: 'center', minWidth: 60 },
  legendPct: { fontSize: Typography.md, fontWeight: '800' },
  legendLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textLight, fontSize: Typography.sm },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  headerBadge: {
    backgroundColor: Colors.success + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  headerBadgeText: { fontSize: Typography.xs, color: Colors.success, fontWeight: '700' },
});

const reportStyles = StyleSheet.create({
  periodRow: { flexDirection: 'row-reverse', gap: 6, marginVertical: Spacing.sm },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    backgroundColor: Colors.bgLight,
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  periodTextActive: { color: '#fff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row-reverse', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: {
    flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm,
    alignItems: 'center', gap: 3,
  },
  summaryVal: { fontSize: Typography.md, fontWeight: '800' },
  summaryLbl: { fontSize: Typography.xs, color: Colors.textSecondary },
  chartArea: {
    flexDirection: 'row-reverse', alignItems: 'flex-end',
    height: 120, gap: 4, marginBottom: Spacing.sm,
  },
  barColV: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValLabel: { fontSize: 9, color: Colors.textLight, marginBottom: 2 },
  barTrackV: {
    width: '80%', height: '100%', justifyContent: 'flex-end',
    backgroundColor: Colors.bgLight, borderRadius: 4,
  },
  barFillV: { width: '100%', borderRadius: 4, minHeight: 4 },
  barXLbl: { fontSize: 8, color: Colors.textLight, marginTop: 3, textAlign: 'center' },
  barRevLbl: { fontSize: 8, color: Colors.primary, fontWeight: '700' },
  loader: { paddingVertical: 24, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { color: Colors.textLight, fontSize: Typography.sm },
});
