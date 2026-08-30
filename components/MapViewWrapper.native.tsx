import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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

export default function MapViewWrapper({
  origin,
  destination,
  driverPosition,
  routeCoords,
  driverName,
  showUserLocation = true,
  initialRegion,
}: Props) {
  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={false}
    >
      <Marker coordinate={origin} title="نقطة الانطلاق">
        <View style={styles.originMarker}>
          <MaterialIcons name="radio-button-checked" size={22} color={Colors.success} />
        </View>
      </Marker>

      <Marker coordinate={destination} title="الوجهة">
        <View style={styles.destMarker}>
          <MaterialIcons name="location-on" size={28} color={Colors.error} />
        </View>
      </Marker>

      <Marker coordinate={driverPosition} title={driverName ?? 'السائق'}>
        <View style={styles.driverMarker}>
          <MaterialIcons name="directions-car" size={18} color="#fff" />
        </View>
      </Marker>

      <Polyline
        coordinates={routeCoords}
        strokeColor={Colors.primary}
        strokeWidth={4}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  originMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  destMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  driverMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff', ...Shadows.md,
  },
});
