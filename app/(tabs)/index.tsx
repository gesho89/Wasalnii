import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  FlatList, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_DRIVERS, SERVICE_TYPES } from '@/services/mockData';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import HomeMapView from '@/components/HomeMapView';
import { Platform } from 'react-native';

const SERVICE_ICONS: Record<string, string> = {
  'طلب رحلة': 'directions-car',
  'توك توك': 'electric-rickshaw',
  'موتوسيكل': 'two-wheeler',
  'ميكروباص': 'airport-shuttle',
  'شحن': 'local-shipping',
  'رحلات طويلة': 'map',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [selectedService, setSelectedService] = useState('طلب رحلة');
  const [from, setFrom] = useState('القاهرة، مصر الجديدة');
  const [to, setTo] = useState('');
  const { unreadCount } = useNotifications();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // Fallback to Cairo coordinates
        setUserLocation({ latitude: 30.0444, longitude: 31.2357 });
      }
    })();
  }, []);

  const filteredDrivers = MOCK_DRIVERS.filter(d => d.isOnline);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerIconWrap} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.greeting}>مرحباً، {user?.name?.split(' ')[0] ?? 'راكب'} 👋</Text>
          <Text style={styles.locationText}>القاهرة، مصر الجديدة</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialIcons name="menu" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Real Map */}
        <View style={styles.mapContainer}>
          <HomeMapView
            userLocation={userLocation}
            drivers={MOCK_DRIVERS}
            onDriverPress={(id) => router.push(`/driver/${id}`)}
            initialRegion={{
              latitude: userLocation?.latitude ?? 30.0444,
              longitude: userLocation?.longitude ?? 31.2357,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          />

          {/* Filter button */}
          <TouchableOpacity style={styles.mapFilterBtn} onPress={() => router.push('/driver-search')}>
            <MaterialIcons name="tune" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* GPS recenter button */}
          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={async () => {
              if (Platform.OS === 'web') return;
              try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
              } catch {}
            }}
          >
            <MaterialIcons name="my-location" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchCard}>
            <View style={styles.searchRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.success} />
              <TextInput
                style={styles.searchInput}
                value={from}
                onChangeText={setFrom}
                placeholder="من أين؟"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
              <MaterialIcons name="my-location" size={18} color={Colors.primary} />
            </View>
            <View style={styles.searchDivider} />
            <View style={styles.searchRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.error} />
              <TextInput
                style={styles.searchInput}
                value={to}
                onChangeText={setTo}
                placeholder="إلى أين؟"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خدمات متنوعة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
            {SERVICE_TYPES.map(service => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceItem, selectedService === service.name && styles.serviceItemActive]}
                onPress={() => setSelectedService(service.name)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.serviceIcon,
                  { backgroundColor: service.color + '18' },
                  selectedService === service.name && { backgroundColor: service.color },
                ]}>
                  <MaterialIcons
                    name={SERVICE_ICONS[service.name] as any ?? 'directions-car'}
                    size={22}
                    color={selectedService === service.name ? '#fff' : service.color}
                  />
                </View>
                <Text style={[styles.serviceName, selectedService === service.name && { color: service.color, fontWeight: '600' }]}>
                  {service.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Nearby Drivers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => router.push('/driver-search')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>سائقين بالقرب منك</Text>
          </View>

          {filteredDrivers.map(driver => (
            <TouchableOpacity
              key={driver.id}
              style={styles.driverCard}
              onPress={() => router.push(`/driver/${driver.id}`)}
              activeOpacity={0.92}
            >
              <View style={styles.driverInfo}>
                <View style={styles.driverMeta}>
                  <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                  <Text style={styles.driverDistance}>{driver.distance}</Text>
                </View>
                <View style={styles.driverNameRow}>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>{driver.rating}</Text>
                    <MaterialIcons name="star" size={12} color={Colors.accent} />
                  </View>
                  <Text style={styles.driverName}>{driver.name}</Text>
                </View>
              </View>
              <View style={styles.driverAvatarContainer}>
                <Image
                  source={{ uri: driver.avatar }}
                  style={styles.driverAvatar}
                  contentFit="cover"
                  transition={200}
                />
                <View style={[styles.onlineDot, { backgroundColor: driver.isOnline ? Colors.success : Colors.offline }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.error, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.bgWhite,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  headerCenter: { flex: 1, alignItems: 'flex-end', paddingHorizontal: Spacing.sm },
  greeting: { fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', color: Colors.textPrimary },
  locationText: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  mapContainer: {
    height: 220, margin: Spacing.md, borderRadius: BorderRadius.lg,
    overflow: 'hidden', position: 'relative', ...Shadows.md,
  },
  mapFilterBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.bgWhite,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  gpsBtn: {
    position: 'absolute', bottom: 12, left: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgWhite,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  searchSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  searchCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  searchInput: {
    flex: 1, fontSize: Typography.base, color: Colors.textPrimary,
    paddingVertical: 8, textAlign: 'right',
  },
  searchDivider: {
    height: 1, backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs, marginHorizontal: 24,
  },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.lg, fontFamily: 'Tajawal_700Bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  seeAll: { color: Colors.primary, fontSize: Typography.sm, fontFamily: 'Tajawal_700Bold' },
  servicesRow: { paddingBottom: Spacing.sm, gap: 12 },
  serviceItem: { alignItems: 'center', width: 72 },
  serviceItemActive: {},
  serviceIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  serviceName: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  driverCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row-reverse', alignItems: 'center',
    ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  driverAvatarContainer: { position: 'relative', marginLeft: Spacing.md },
  driverAvatar: { width: 60, height: 60, borderRadius: 30 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  driverInfo: { flex: 1 },
  driverNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  driverName: { fontSize: Typography.md, fontFamily: 'Tajawal_700Bold', color: Colors.textPrimary },
  ratingBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 2,
    backgroundColor: Colors.bgLight, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ratingText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  driverMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 },
  driverVehicle: { fontSize: Typography.sm, color: Colors.textSecondary },
  driverDistance: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '500' },
});
