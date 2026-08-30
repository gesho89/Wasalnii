import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/theme';

interface Driver {
  id: string;
  lat: number;
  lng: number;
  vehicleType: string;
  name: string;
  isOnline: boolean;
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  drivers: Driver[];
  onDriverPress?: (driverId: string) => void;
  initialRegion?: Region;
}

const VEHICLE_ICONS: Record<string, { icon: string; color: string }> = {
  'سيارة': { icon: 'directions-car', color: Colors.primary },
  'توك توك': { icon: 'electric-rickshaw', color: Colors.accent },
  'موتوسيكل': { icon: 'two-wheeler', color: Colors.success },
  'ميكروباص': { icon: 'airport-shuttle', color: '#8B5CF6' },
};

export default function HomeMapView({ userLocation, drivers, onDriverPress, initialRegion }: Props) {
  const mapRef = useRef<MapView>(null);

  const defaultRegion: Region = initialRegion ?? {
    latitude: 30.0444,
    longitude: 31.2357,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [userLocation]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      initialRegion={defaultRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      showsTraffic={false}
    >
      {drivers.filter(d => d.isOnline).map(driver => {
        const vi = VEHICLE_ICONS[driver.vehicleType] ?? VEHICLE_ICONS['سيارة'];
        return (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            title={driver.name}
            description={driver.vehicleType}
            onPress={() => onDriverPress?.(driver.id)}
          >
            <View style={[styles.driverMarker, { borderColor: vi.color }]}>
              <MaterialIcons name={vi.icon as any} size={16} color={vi.color} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  driverMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, ...Shadows.sm,
  },
});
