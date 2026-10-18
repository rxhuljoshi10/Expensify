import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestRecordingPermissionsAsync } from 'expo-audio';

/**
 * Request runtime Camera permission with fallback to system settings if denied.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (hasPermission) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'Expensify needs camera permission to scan bills and receipts.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      Alert.alert(
        'Camera Permission Required',
        'Expensify needs camera permission to scan bills and receipts. Please enable camera access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      console.warn('[Permissions] Camera request error:', err);
    }
  }

  // iOS / Android fallback
  try {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Camera Permission Required',
        'Expensify needs camera permission to scan bills and receipts. Please enable camera access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Permissions] Expo camera permission error:', err);
    return false;
  }
}

/**
 * Request runtime Microphone / Audio permission with fallback to system settings if denied.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (hasPermission) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission Required',
          message: 'Expensify needs microphone permission to record voice expenses.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      Alert.alert(
        'Microphone Permission Required',
        'Expensify needs microphone permission to record voice expenses. Please enable microphone access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      console.warn('[Permissions] Audio request error:', err);
    }
  }

  // iOS / Expo audio fallback
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Microphone Permission Required',
        'Expensify needs microphone permission to record voice expenses. Please enable microphone access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Permissions] Expo audio permission error:', err);
    return false;
  }
}

/**
 * Request runtime Media Library / Photos permission.
 * On Android 13+ (API >= 33), the system photo picker is used which needs no storage permission.
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(Platform.Version as string, 10);
    // Android 13+ uses photo picker without needing READ_EXTERNAL_STORAGE
    if (androidVersion >= 33) {
      return true;
    }

    try {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      if (hasPermission) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Photo Library Permission Required',
          message: 'Expensify needs photo library permission to select receipts.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }

      Alert.alert(
        'Photo Library Permission Required',
        'Expensify needs photo library permission to select receipts. Please enable photo access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    } catch (err) {
      console.warn('[Permissions] Media library request error:', err);
    }
  }

  // iOS / Expo media library fallback
  try {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Photo Library Permission Required',
        'Expensify needs photo library permission to select receipts. Please enable photo access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Permissions] Expo media library error:', err);
    return false;
  }
}
