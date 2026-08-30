import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { useEffect } from 'react';
import { I18nManager, Text, TextInput } from 'react-native';
import { requestNotificationPermissions } from '@/services/pushNotifications';
import {
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';
import * as SplashScreen from 'expo-splash-screen';

// Keep splash visible until fonts load
SplashScreen.preventAutoHideAsync();

// Apply Tajawal globally to all Text & TextInput
const defaultTextStyle = { fontFamily: 'Tajawal_400Regular' } as any;
(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = defaultTextStyle;
(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.style = defaultTextStyle;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    requestNotificationPermissions();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <NotificationsProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="index" />
            <Stack.Screen name="register" />
            <Stack.Screen name="driver-register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="driver/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="trip-waiting" />
            <Stack.Screen name="trip-tracking" />
            <Stack.Screen name="trip-chat" />
            <Stack.Screen name="trip-details" />
            <Stack.Screen name="complaints" />
            <Stack.Screen name="admin" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="driver-search" />
            <Stack.Screen name="coupons" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="driver-registration-docs" />
            <Stack.Screen name="rewards" />
            <Stack.Screen name="devices" />
            <Stack.Screen name="payment" />
            <Stack.Screen name="driver-dashboard" />
          </Stack>
          </NotificationsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
