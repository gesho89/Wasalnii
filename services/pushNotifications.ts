import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleRideAcceptedNotification(driverName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'تم قبول طلبك ✅',
      body: `${driverName} قبل رحلتك وهو في الطريق إليك`,
      sound: true,
      data: { type: 'ride_accepted' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

export async function scheduleDriverArrivedNotification(driverName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'السائق وصل 📍',
      body: `${driverName} وصل إلى موقعك. استعد للركوب`,
      sound: true,
      data: { type: 'driver_arrived' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

export async function scheduleTripCompletedNotification(price: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'اكتملت رحلتك 🏁',
      body: `وصلت إلى وجهتك بأمان. تكلفة الرحلة ${price} ج.م`,
      sound: true,
      data: { type: 'trip_completed' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleLocalNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'chat_message' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
  });
}
