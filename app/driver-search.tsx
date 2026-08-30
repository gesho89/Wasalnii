import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  ScrollView, Animated, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { getSupabaseClient } from '@/template';
import { useNotifications } from '@/contexts/NotificationsContext';
import { scheduleRideAcceptedNotification } from '@/services/pushNotifications';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_DRIVERS } from '@/services/mockData';
import {
  getCurrentLocation, requestLocationPermission, getDistance,
  formatDistance, DEFAULT_LOCATION, LatLng,
} from '@/services/locationService';

// Conditional map import
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Circle = RNMaps.Circle;
    PROVIDER_GOOGLE = RNMaps.PROVIDER_GOOGLE;
  } catch {}
}

type SortOption = 'rating' | 'distance' | 'price';
type ViewMode = 'map' | 'list';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.42;

const VEHICLE_TYPES = ['الكل', 'توك توك', 'سيارة', 'موتوسيكل', 'ميكروباص'];
const RATING_FILTERS = ['الكل', '4.5+', '4.0+', '3.5+'];
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'rating', label: 'التقييم' },
  { key: 'distance', label: 'المسافة' },
  { key: 'price', label: 'السعر' },
];

const VEHICLE_ICONS: Record<string, string> = {
  'توك توك': 'electric-rickshaw',
  'سيارة': 'directions-car',
  'موتوسيكل': 'two-wheeler',
  'ميكروباص': 'airport-shuttle',
};

const VEHICLE_MARKER_COLORS: Record<string, string> = {
  'توك توك': Colors.primary,
  'سيارة': '#3B82F6',
  'موتوسيكل': '#10B981',
  'ميكروباص': '#8B5CF6',
};

export default function DriverSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingTripId: routePendingTripId } = useLocalSearchParams<{ pendingTripId?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [query, setQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('الكل');
  const [ratingFilter, setRatingFilter] = useState('الكل');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<typeof MOCK_DRIVERS[0] | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<any>(null);
  const { addNotification } = useNotifications();

  // ── Pending trip polling ──────────────────────────────────────────
  // When a booking is placed (tripId set), poll Supabase every 5s
  // to detect when driver changes status to 'active'
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const tripPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedAcceptRef = useRef(false);

  const pollPendingTrip = useCallback(async (id: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('trips')
        .select('status, driver_id')
        .eq('id', id)
        .single();

      if (!data) return;

      if (data.status === 'active' && !notifiedAcceptRef.current) {
        notifiedAcceptRef.current = true;
        // Stop polling
        if (tripPollRef.current) clearInterval(tripPollRef.current);

        // Fetch driver name for notification
        let driverDisplayName = 'السائق';
        if (data.driver_id) {
          const { data: drv } = await supabase
            .from('drivers')
            .select('name')
            .eq('id', data.driver_id)
            .single();
          if (drv?.name) driverDisplayName = drv.name;
        }

        scheduleRideAcceptedNotification(driverDisplayName);
        addNotification({
          type: 'ride_accepted',
          title: 'قبل السائق رحلتك!',
          body: `${driverDisplayName} قبل طلبك وهو في الطريق إليك`,
          time: 'الآن',
          icon: 'check-circle',
          iconColor: Colors.success,
        });
      }
    } catch { /* silent */ }
  }, [addNotification]);

  // Start polling when pendingTripId is set
  useEffect(() => {
    if (!pendingTripId) return;
    notifiedAcceptRef.current = false;
    if (tripPollRef.current) clearInterval(tripPollRef.current);
    // Poll immediately + every 5s
    pollPendingTrip(pendingTripId);
    tripPollRef.current = setInterval(() => pollPendingTrip(pendingTripId), 5000);
    return () => { if (tripPollRef.current) clearInterval(tripPollRef.current); };
  }, [pendingTripId, pollPendingTrip]);

  // Real user location state
  const [userLocation, setUserLocation] = useState<LatLng>(DEFAULT_LOCATION);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);

  // Drivers with real distances
  const [driversWithDist, setDriversWithDist] = useState(MOCK_DRIVERS);

  // Sync pendingTripId from route params (when user navigates back from driver booking)
  useEffect(() => {
    if (routePendingTripId) setPendingTripId(routePendingTripId);
  }, [routePendingTripId]);

  // Request real location on mount
  useEffect(() => {
    (async () => {
      setLocationLoading(true);
      const permission = await requestLocationPermission();
      if (permission === 'granted') {
        setLocationGranted(true);
        const loc = await getCurrentLocation();
        setUserLocation(loc);
        // Recalculate distances from real location
        const updated = MOCK_DRIVERS.map(d => {
          const km = getDistance(loc, { latitude: d.lat, longitude: d.lng });
          return { ...d, distance: formatDistance(km) };
        });
        setDriversWithDist(updated);
        // Animate map to real location
        mapRef.current?.animateToRegion({
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }, 800);
      }
      setLocationLoading(false);
    })();
  }, []);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
  }, []);

  const filtered = useMemo(() => {
    let result = [...driversWithDist];
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(d => d.name.includes(q) || d.vehicle.toLowerCase().includes(q) || d.vehicleType.includes(q));
    }
    if (vehicleFilter !== 'الكل') result = result.filter(d => d.vehicleType === vehicleFilter);
    if (ratingFilter !== 'الكل') {
      const min = parseFloat(ratingFilter.replace('+', ''));
      result = result.filter(d => d.rating >= min);
    }
    if (showOnlineOnly) result = result.filter(d => d.isOnline);
    result.sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price') return a.cityPrice.from - b.cityPrice.from;
      if (sortBy === 'distance') {
        const parseD = (s: string) => { const n = parseFloat(s); return s.includes('كم') ? n * 1000 : n; };
        return parseD(a.distance) - parseD(b.distance);
      }
      return 0;
    });
    return result;
  }, [query, vehicleFilter, ratingFilter, sortBy, showOnlineOnly, driversWithDist]);

  const handleMarkerPress = (driver: typeof MOCK_DRIVERS[0]) => {
    setSelectedDriver(driver);
    setViewMode('map');
    // Zoom to selected driver
    mapRef.current?.animateToRegion({
      latitude: driver.lat,
      longitude: driver.lng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 500);
  };

  const handleRecenter = useCallback(() => {
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }, 600);
  }, [userLocation]);

  // ── Map View ───────────────────────────────────────────────────────
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <LinearGradient colors={[Colors.bgDark, Colors.bgNavy, '#0D1B2A']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.gridOverlay}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.gridLine} />
            ))}
          </View>
          {MOCK_DRIVERS.map((driver, i) => {
            const positions = [
              { top: '25%', right: '30%' }, { top: '40%', right: '60%' },
              { top: '55%', right: '20%' }, { top: '30%', right: '70%' },
            ];
            const pos = positions[i] ?? { top: '50%', right: '50%' };
            const vColor = VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary;
            return (
              <TouchableOpacity
                key={driver.id}
                style={[styles.mapDot, pos as any, { borderColor: vColor }, selectedDriver?.id === driver.id && styles.mapDotSelected]}
                onPress={() => handleMarkerPress(driver)}
              >
                <View style={[styles.mapDotInner, { backgroundColor: driver.isOnline ? vColor : Colors.offline }]}>
                  <MaterialIcons name={VEHICLE_ICONS[driver.vehicleType] as any ?? 'directions-car'} size={12} color="#fff" />
                </View>
                {driver.isOnline && <View style={[styles.mapDotPulse, { borderColor: vColor }]} />}
              </TouchableOpacity>
            );
          })}
          <View style={styles.userDot}>
            <View style={styles.userDotInner} />
            <View style={styles.userDotRing} />
          </View>
          <View style={styles.mapLabels}>
            <View style={styles.mapLabel}><Text style={styles.mapLabelText}>القاهرة</Text></View>
          </View>
          <Text style={styles.mapFallbackNote}>خريطة المنطقة المحيطة</Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        customMapStyle={DARK_MAP_STYLE}
      >
        {/* User accuracy circle */}
        {locationGranted && Circle && (
          <Circle
            center={userLocation}
            radius={200}
            fillColor="rgba(232,160,32,0.12)"
            strokeColor="rgba(232,160,32,0.55)"
            strokeWidth={1.5}
          />
        )}
        {/* Driver markers */}
        {filtered.map(driver =>
          Marker ? (
            <Marker
              key={driver.id}
              coordinate={{ latitude: driver.lat, longitude: driver.lng }}
              onPress={() => handleMarkerPress(driver)}
              tracksViewChanges={false}
            >
              <View style={[
                styles.markerContainer,
                { borderColor: VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary },
                selectedDriver?.id === driver.id && styles.markerSelected,
              ]}>
                <View style={[styles.markerInner, { backgroundColor: driver.isOnline ? (VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary) : Colors.offline }]}>
                  <MaterialIcons name={VEHICLE_ICONS[driver.vehicleType] as any ?? 'directions-car'} size={14} color="#fff" />
                </View>
                {driver.isOnline && <View style={[styles.markerPulse, { borderColor: VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary }]} />}
              </View>
            </Marker>
          ) : null
        )}
      </MapView>
    );
  };

  // ── Selected Driver Card ──────────────────────────────────────────
  const renderSelectedCard = () => {
    if (!selectedDriver) return null;
    return (
      <Animated.View style={[styles.selectedCard, {
        transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }],
      }]}>
        <View style={styles.selectedCardHandle} />
        <TouchableOpacity style={styles.selectedCardClose} onPress={() => setSelectedDriver(null)}>
          <MaterialIcons name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.selectedDriverRow}>
          <View style={styles.selectedActions}>
            <TouchableOpacity
              style={styles.bookNowBtnLarge}
              onPress={() => router.push(`/driver/${selectedDriver.id}`)}
            >
              <LinearGradient colors={['#FFD050', '#E8A020', '#C47D0A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookNowGrad}>
                <MaterialIcons name="directions-car" size={16} color={Colors.bgDark} />
                <Text style={styles.bookNowLargeText}>احجز الآن</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.etaBadge}>
              <MaterialIcons name="access-time" size={14} color={Colors.primary} />
              <Text style={styles.etaText}>{selectedDriver.eta}</Text>
            </View>
          </View>
          <View style={styles.selectedInfo}>
            <View style={styles.selectedNameRow}>
              <View style={[styles.onlineDot, { backgroundColor: selectedDriver.isOnline ? Colors.success : Colors.offline }]} />
              <Text style={styles.selectedName}>{selectedDriver.name}</Text>
            </View>
            <Text style={styles.selectedVehicle}>{selectedDriver.vehicle}</Text>
            <View style={styles.selectedMeta}>
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={12} color={Colors.accent} />
                <Text style={styles.ratingText}>{selectedDriver.rating}</Text>
              </View>
              <Text style={styles.distanceText}>{selectedDriver.distance}</Text>
              <Text style={styles.priceRange}>من {selectedDriver.cityPrice.from} ج.م</Text>
            </View>
          </View>
          <Image source={{ uri: selectedDriver.avatar }} style={styles.selectedAvatar} contentFit="cover" transition={200} />
        </View>
      </Animated.View>
    );
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
          <Text style={styles.title}>البحث عن سائق</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <MaterialIcons name="map" size={16} color={viewMode === 'map' ? Colors.bgDark : 'rgba(255,255,255,0.6)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <MaterialIcons name="view-list" size={16} color={viewMode === 'list' ? Colors.bgDark : 'rgba(255,255,255,0.6)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending trip acceptance banner */}
        {pendingTripId && !notifiedAcceptRef.current && (
          <View style={styles.acceptanceBanner}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.acceptanceText}>في انتظار قبول السائق رحلتك...</Text>
          </View>
        )}

        {/* Location status */}
        {locationLoading ? (
          <View style={styles.locationBar}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <Text style={styles.locationText}>جارٍ تحديد موقعك...</Text>
          </View>
        ) : (
          <View style={styles.locationBar}>
            <MaterialIcons
              name={locationGranted ? 'my-location' : 'location-off'}
              size={14}
              color={locationGranted ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.locationText, { color: locationGranted ? Colors.success : Colors.textSecondary }]}>
              {locationGranted ? 'تم تحديد موقعك بدقة' : 'لم يتم منح إذن الموقع'}
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث باسم السائق أو نوع المركبة..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={query}
            onChangeText={setQuery}
            textAlign="right"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Vehicle Type Chips */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {VEHICLE_TYPES.map(v => {
            const icon = VEHICLE_ICONS[v];
            return (
              <TouchableOpacity
                key={v}
                style={[styles.chip, vehicleFilter === v && styles.chipActive]}
                onPress={() => setVehicleFilter(v)}
              >
                {icon && <MaterialIcons name={icon as any} size={13} color={vehicleFilter === v ? Colors.bgDark : Colors.textSecondary} />}
                <Text style={[styles.chipText, vehicleFilter === v && styles.chipTextActive]}>{v}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── MAP MODE ── */}
      {viewMode === 'map' && (
        <View style={styles.mapWrapper}>
          <View style={styles.mapContainer}>
            {renderMap()}
            {/* Drivers count overlay */}
            <View style={styles.mapCountBadge}>
              <View style={styles.onlineDot2} />
              <Text style={styles.mapCountText}>{filtered.filter(d => d.isOnline).length} سائق متاح</Text>
            </View>
            {/* Recenter to real location */}
            <TouchableOpacity style={styles.recenterBtn} onPress={handleRecenter}>
              <MaterialIcons name="my-location" size={20} color={locationGranted ? Colors.primary : Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Driver mini list */}
          {!selectedDriver && (
            <ScrollView style={styles.miniList} showsVerticalScrollIndicator={false}>
              <View style={styles.miniListHeader}>
                <Text style={styles.miniListCount}>{filtered.length} سائق قريب منك</Text>
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot2} />
                  <Text style={styles.onlineText}>{filtered.filter(d => d.isOnline).length} متاح الآن</Text>
                </View>
              </View>
              {filtered.map(driver => (
                <TouchableOpacity
                  key={driver.id}
                  style={styles.miniCard}
                  onPress={() => handleMarkerPress(driver)}
                  activeOpacity={0.85}
                >
                  <View style={styles.miniCardActions}>
                    <View style={[styles.miniVehicleBadge, { backgroundColor: (VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary) + '18' }]}>
                      <MaterialIcons name={VEHICLE_ICONS[driver.vehicleType] as any ?? 'directions-car'} size={14} color={VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary} />
                      <Text style={[styles.miniVehicleText, { color: VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary }]}>{driver.vehicleType}</Text>
                    </View>
                    <Text style={styles.miniEta}>{driver.eta}</Text>
                  </View>
                  <View style={styles.miniCardBody}>
                    <View style={styles.miniDriverInfo}>
                      <View style={styles.miniNameRow}>
                        <View style={[styles.onlineDot, { backgroundColor: driver.isOnline ? Colors.success : Colors.offline }]} />
                        <Text style={styles.miniName}>{driver.name}</Text>
                      </View>
                      <View style={styles.miniMeta}>
                        <MaterialIcons name="star" size={11} color={Colors.accent} />
                        <Text style={styles.miniRating}>{driver.rating}</Text>
                        <Text style={styles.miniDist}>{driver.distance}</Text>
                        <Text style={styles.miniPrice}>من {driver.cityPrice.from} ج.م</Text>
                      </View>
                    </View>
                    <Image source={{ uri: driver.avatar }} style={styles.miniAvatar} contentFit="cover" transition={200} />
                  </View>
                </TouchableOpacity>
              ))}
              <View style={{ height: insets.bottom + 16 }} />
            </ScrollView>
          )}

          {renderSelectedCard()}
        </View>
      )}

      {/* ── LIST MODE ── */}
      {viewMode === 'list' && (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.filterBlock}>
            <Text style={styles.filterLabel}>التقييم</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {RATING_FILTERS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterChip, ratingFilter === r && styles.filterChipActive]}
                  onPress={() => setRatingFilter(r)}
                >
                  {r !== 'الكل' && <MaterialIcons name="star" size={11} color={ratingFilter === r ? Colors.bgDark : Colors.accent} />}
                  <Text style={[styles.filterChipText, ratingFilter === r && styles.filterChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterBlock}>
            <Text style={styles.filterLabel}>ترتيب حسب</Text>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortBtn, sortBy === opt.key && styles.sortBtnActive]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text style={[styles.sortText, sortBy === opt.key && styles.sortTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterBlock}>
            <TouchableOpacity style={styles.toggleOnlineRow} onPress={() => setShowOnlineOnly(!showOnlineOnly)}>
              <View style={[styles.switchTrack, showOnlineOnly && styles.switchTrackActive]}>
                <View style={[styles.switchThumb, showOnlineOnly && styles.switchThumbActive]} />
              </View>
              <View style={styles.onlineIndicator}>
                <View style={[styles.onlineDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.toggleLabel}>المتاحون فقط</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>{filtered.length} سائق</Text>
            <Text style={styles.resultsTitle}>نتائج البحث</Text>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="search-off" size={60} color={Colors.borderLight} />
              <Text style={styles.emptyText}>لا توجد نتائج</Text>
            </View>
          ) : (
            filtered.map(driver => (
              <TouchableOpacity
                key={driver.id}
                style={styles.driverCard}
                onPress={() => router.push(`/driver/${driver.id}`)}
                activeOpacity={0.9}
              >
                <View style={styles.driverMeta}>
                  <Text style={styles.driverDistance}>{driver.distance}</Text>
                  <Text style={styles.driverEta}>{driver.eta}</Text>
                </View>
                <View style={styles.driverRow}>
                  <View style={styles.driverInfo}>
                    <View style={styles.nameRow}>
                      <View style={[styles.onlineDot, { backgroundColor: driver.isOnline ? Colors.success : Colors.offline }]} />
                      <Text style={styles.driverName}>{driver.name}</Text>
                    </View>
                    <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                    <View style={styles.statsRow}>
                      <View style={styles.ratingBadge}>
                        <MaterialIcons name="star" size={12} color={Colors.accent} />
                        <Text style={styles.ratingText}>{driver.rating}</Text>
                      </View>
                      <Text style={styles.tripsText}>{driver.trips.toLocaleString()} رحلة</Text>
                    </View>
                  </View>
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri: driver.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
                    <View style={[styles.vehicleTypeBadge, { backgroundColor: VEHICLE_MARKER_COLORS[driver.vehicleType] ?? Colors.primary }]}>
                      <Text style={styles.vehicleTypeText}>{driver.vehicleType}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.priceRowCard}>
                  <TouchableOpacity style={styles.bookNowBtn} onPress={() => router.push(`/driver/${driver.id}`)}>
                    <LinearGradient colors={['#FFD050', '#E8A020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bookBtnGrad}>
                      <Text style={styles.bookNowText}>احجز الآن</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <Text style={styles.priceText}>من {driver.cityPrice.from} إلى {driver.cityPrice.to} ج.م</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d0d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a09070' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1400' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2a2000' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D1B2A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1200' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  header: { paddingBottom: Spacing.sm },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: Typography.lg, fontWeight: '700', flex: 1, textAlign: 'center' },
  viewToggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.sm, padding: 2,
  },
  toggleBtn: { width: 32, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.accent },
  locationBar: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingBottom: 6,
  },
  locationText: { fontSize: Typography.xs, color: Colors.success, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: Typography.base, paddingVertical: 11 },
  acceptanceBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    marginHorizontal: Spacing.md, marginBottom: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  acceptanceText: {
    color: Colors.accent, fontSize: Typography.sm, fontWeight: '700', flex: 1, textAlign: 'right',
  },
  chipsContainer: {
    backgroundColor: Colors.bgDark,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  chipTextActive: { color: Colors.bgDark, fontWeight: '800' },
  mapWrapper: { flex: 1 },
  mapContainer: { height: MAP_HEIGHT, position: 'relative' },
  map: { flex: 1 },
  mapFallback: {
    flex: 1, backgroundColor: '#0D1B2A',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', justifyContent: 'space-around',
  },
  gridLine: { width: 1, backgroundColor: 'rgba(232,160,32,0.06)', height: '100%' },
  mapDot: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  mapDotSelected: { transform: [{ scale: 1.3 }] },
  mapDotInner: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mapDotPulse: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, opacity: 0.4,
  },
  userDot: {
    position: 'absolute', bottom: '40%', left: '45%',
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  userDotInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accent },
  userDotRing: {
    position: 'absolute', width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Colors.accent, opacity: 0.5,
  },
  mapLabels: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' },
  mapLabel: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  mapLabelText: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs },
  mapFallbackNote: { position: 'absolute', bottom: 12, color: 'rgba(255,255,255,0.25)', fontSize: 10 },
  mapCountBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(13,13,13,0.85)', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  onlineDot2: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  mapCountText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  recenterBtn: {
    position: 'absolute', bottom: 12, left: 12,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgWhite, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  markerContainer: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgDark,
  },
  markerSelected: { transform: [{ scale: 1.3 }] },
  markerInner: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markerPulse: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, opacity: 0.4,
  },
  miniList: {
    flex: 1, backgroundColor: Colors.bgLight,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  miniListHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  miniListCount: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  onlineIndicator: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  onlineText: { fontSize: Typography.xs, color: Colors.success, fontWeight: '600' },
  miniCard: {
    backgroundColor: Colors.bgWhite, marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  miniCardActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  miniVehicleBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  miniVehicleText: { fontSize: Typography.xs, fontWeight: '700' },
  miniEta: { fontSize: Typography.xs, color: Colors.textSecondary },
  miniCardBody: { flexDirection: 'row-reverse', alignItems: 'center' },
  miniDriverInfo: { flex: 1 },
  miniNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  miniName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  miniMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  miniRating: { fontSize: Typography.xs, fontWeight: '700', color: Colors.accent },
  miniDist: { fontSize: Typography.xs, color: Colors.textSecondary },
  miniPrice: { fontSize: Typography.xs, fontWeight: '600', color: Colors.primary },
  miniAvatar: { width: 52, height: 52, borderRadius: 26, marginLeft: Spacing.md },
  selectedCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingTop: Spacing.md, ...Shadows.lg,
  },
  selectedCardHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm,
  },
  selectedCardClose: {
    position: 'absolute', top: Spacing.md, left: Spacing.md,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  selectedDriverRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  selectedAvatar: { width: 60, height: 60, borderRadius: 30, marginLeft: Spacing.md },
  selectedInfo: { flex: 1 },
  selectedNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  selectedName: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary },
  selectedVehicle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  selectedMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  distanceText: { fontSize: Typography.xs, color: Colors.textSecondary },
  priceRange: { fontSize: Typography.xs, fontWeight: '700', color: Colors.primary },
  selectedActions: { alignItems: 'flex-start', gap: Spacing.sm },
  bookNowBtnLarge: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  bookNowGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  bookNowLargeText: { color: Colors.bgDark, fontSize: Typography.sm, fontWeight: '800' },
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  etaText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.primary },
  listScroll: { flex: 1, backgroundColor: Colors.bgLight },
  filterBlock: {
    backgroundColor: Colors.bgWhite, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm, marginBottom: 2,
  },
  filterLabel: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 6 },
  filterRow: { gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgWhite,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  sortRow: { flexDirection: 'row-reverse', gap: Spacing.xs },
  sortBtn: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  sortBtnActive: { backgroundColor: Colors.primary + '12', borderColor: Colors.primary },
  sortText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
  sortTextActive: { color: Colors.primary, fontWeight: '700' },
  toggleOnlineRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  switchTrack: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: Colors.border, justifyContent: 'center', padding: 2,
  },
  switchTrackActive: { backgroundColor: Colors.primary },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' },
  switchThumbActive: { alignSelf: 'flex-start' },
  toggleLabel: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: '500' },
  resultsHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  resultsTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  resultsCount: { fontSize: Typography.sm, color: Colors.textSecondary },
  driverCard: {
    backgroundColor: Colors.bgWhite, marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  driverMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing.xs },
  driverDistance: { fontSize: Typography.xs, color: Colors.primary, fontWeight: '600' },
  driverEta: { fontSize: Typography.xs, color: Colors.textSecondary },
  driverRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: Spacing.sm },
  avatarWrap: { position: 'relative', marginLeft: Spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  vehicleTypeBadge: {
    position: 'absolute', bottom: -4, left: 0, right: 0,
    borderRadius: 6, alignItems: 'center', paddingVertical: 2,
  },
  vehicleTypeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  driverInfo: { flex: 1 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  driverName: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  driverVehicle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  statsRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  ratingBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 3,
    backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  ratingText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.accent },
  tripsText: { fontSize: Typography.xs, color: Colors.textSecondary },
  priceRowCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  priceText: { flex: 1, fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  bookNowBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  bookBtnGrad: { paddingHorizontal: 16, paddingVertical: 8 },
  bookNowText: { color: Colors.bgDark, fontSize: Typography.sm, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: Typography.lg, color: Colors.textSecondary, fontWeight: '600' },
});
