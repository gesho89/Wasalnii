import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Shadows } from '@/constants/theme';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  origin: LatLng;
  destination: LatLng;
  driverPosition: LatLng;
  routeCoords: LatLng[];
  driverName?: string;
  showUserLocation?: boolean;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// Web fallback — react-native-maps is native-only
export default function MapViewWrapper(_props: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop' }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />
      {/* Simulated route overlay */}
      <View style={styles.routeOverlay}>
        <View style={[styles.dot, { backgroundColor: Colors.success }]} />
        <View style={styles.line} />
        <View style={[styles.dot, { backgroundColor: Colors.error }]} />
      </View>
      {/* Driver marker */}
      <View style={styles.driverPin}>
        <MaterialIcons name="directions-car" size={18} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
  routeOverlay: {
    position: 'absolute', top: '25%', left: '42%',
    alignItems: 'center',
  },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  line: { width: 3, height: 70, backgroundColor: Colors.primary, opacity: 0.7 },
  driverPin: {
    position: 'absolute', top: '48%', left: '44%',
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff', ...Shadows.md,
  },
});
