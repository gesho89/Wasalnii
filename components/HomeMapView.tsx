import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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
  initialRegion?: any;
}

const VEHICLE_ICONS: Record<string, { icon: string; color: string }> = {
  'سيارة': { icon: 'directions-car', color: Colors.primary },
  'توك توك': { icon: 'electric-rickshaw', color: Colors.accent },
  'موتوسيكل': { icon: 'two-wheeler', color: Colors.success },
  'ميكروباص': { icon: 'airport-shuttle', color: '#8B5CF6' },
};

// Web fallback
export default function HomeMapView({ drivers, onDriverPress }: Props) {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=400&fit=crop' }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(26,86,219,0.06)' }]} />

      {/* Simulated driver pins */}
      {drivers.filter(d => d.isOnline).map((driver, i) => {
        const vi = VEHICLE_ICONS[driver.vehicleType] ?? VEHICLE_ICONS['سيارة'];
        const positions = [
          { top: '28%', left: '32%' },
          { top: '50%', right: '28%' },
          { bottom: '32%', left: '48%' },
          { top: '38%', right: '40%' },
        ];
        const pos = positions[i % positions.length];
        return (
          <View
            key={driver.id}
            style={[styles.driverPin, { borderColor: vi.color }, pos as any]}
            onTouchEnd={() => onDriverPress?.(driver.id)}
          >
            <MaterialIcons name={vi.icon as any} size={16} color={vi.color} />
          </View>
        );
      })}

      {/* User pin */}
      <View style={styles.userPin}>
        <MaterialIcons name="my-location" size={20} color={Colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  driverPin: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, ...Shadows.sm,
  },
  userPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -22, marginLeft: -22,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Shadows.md, borderWidth: 2, borderColor: Colors.primary,
  },
});
