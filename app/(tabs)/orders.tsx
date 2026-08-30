import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_TRIPS } from '@/services/mockData';

const FILTERS = ['الكل', 'جارية', 'مكتملة'];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState('الكل');

  const data = filter === 'الكل' ? MOCK_TRIPS : MOCK_TRIPS.filter(t => {
    if (filter === 'جارية') return t.status === 'active';
    return t.status === 'completed';
  });

  const renderItem = ({ item }: { item: typeof MOCK_TRIPS[0] }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: item.status === 'completed' ? Colors.success + '18' : Colors.error + '18' }]}>
          <Text style={[styles.badgeText, { color: item.status === 'completed' ? Colors.success : Colors.error }]}>
            {item.status === 'completed' ? 'مكتملة' : 'ملغاة'}
          </Text>
        </View>
        <Text style={styles.cardDate}>{item.date}</Text>
      </View>

      <View style={styles.driverRow}>
        <Image source={{ uri: item.driver.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{item.driver.name}</Text>
          <Text style={styles.vehicleName}>{item.driver.vehicle}</Text>
        </View>
        <Text style={styles.price}>{item.price} ج.م</Text>
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.routeText} numberOfLines={1}>{item.from}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeItem}>
          <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.routeText} numberOfLines={1}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => router.push({ pathname: '/trip-details', params: { id: item.id } } as any)}>
          <Text style={styles.footerBtnText}>تفاصيل الطلب</Text>
        </TouchableOpacity>
        {item.status === 'completed' && (
          <TouchableOpacity style={[styles.footerBtn, styles.footerBtnOutline]} onPress={() => router.push('/complaints' as any)}>
            <Text style={[styles.footerBtnText, { color: Colors.primary }]}>تقييم</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>الطلبات</Text>
      </View>

      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="inbox" size={60} color={Colors.borderLight} />
            <Text style={styles.emptyText}>لا توجد طلبات</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  filterBar: {
    flexDirection: 'row-reverse', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  filterBtn: {
    paddingHorizontal: 22, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  badgeText: { fontSize: Typography.xs, fontWeight: '700' },
  cardDate: { fontSize: Typography.xs, color: Colors.textLight },
  driverRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.sm },
  avatar: { width: 46, height: 46, borderRadius: 23, marginLeft: Spacing.sm },
  driverInfo: { flex: 1 },
  driverName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  vehicleName: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  price: { fontSize: Typography.lg, fontWeight: '800', color: Colors.primary },
  routeBlock: { marginBottom: Spacing.sm },
  routeItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeConnector: { width: 2, height: 12, backgroundColor: Colors.border, marginRight: 3, marginLeft: 'auto' },
  routeText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  cardFooter: { flexDirection: 'row-reverse', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  footerBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  footerBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  footerBtnText: { fontSize: Typography.sm, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: Typography.lg, color: Colors.textLight, marginTop: Spacing.md },
});
