// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//     shouldShowBanner: true,
//     shouldShowList: true,
//   }),
// });

export const registerForPushNotifications = async (
  userId: string
): Promise<string | null> => {
  // Push notifications don't work on simulators
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Get the Expo push token
  let token: string;
  try {
    const pushTokenResult = await Notifications.getExpoPushTokenAsync();
    token = pushTokenResult.data;
  } catch (error) {
    console.log('Error getting push token. If you are using Expo Go on Android in SDK 53+, this is expected:', error);
    return null;
  }

  if (!token) return null;

  // Save token to Supabase
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform },
    { onConflict: 'token', ignoreDuplicates: true }
  );

  console.log('Push token registered:', token);
  return token;
};

// Schedule a local notification (for testing without a server)
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  seconds = 5
) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds 
    },
  });
};