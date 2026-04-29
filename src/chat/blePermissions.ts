import { Alert, PermissionsAndroid, Platform } from 'react-native';

/**
 * BLE Permissions required for Android
 */
export const BLE_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
] as const;

/**
 * Request all necessary BLE permissions for Android
 */
export async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    console.log('[BLE Permissions] iOS - permissions handled automatically');
    return true;
  }

  try {
    console.log('[BLE Permissions] Requesting BLE permissions...');

    const granted = await PermissionsAndroid.requestMultiple(BLE_PERMISSIONS);

    const allGranted = Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );

    if (allGranted) {
      console.log('[BLE Permissions] All permissions granted');
      return true;
    } else {
      const deniedPerms = Object.entries(granted)
        .filter(([, result]) => result !== PermissionsAndroid.RESULTS.GRANTED)
        .map(([perm]) => perm);

      console.warn('[BLE Permissions] Some permissions denied:', deniedPerms);

      Alert.alert(
        'BLE Permissions Required',
        'FortiLink needs Bluetooth and location permissions to work. Please grant all permissions in settings.',
        [{ text: 'OK' }]
      );

      return false;
    }
  } catch (error) {
    console.error('[BLE Permissions] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check if BLE permissions are granted
 */
export async function checkBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const results = await Promise.all(
      BLE_PERMISSIONS.map(perm => PermissionsAndroid.check(perm))
    );

    const allGranted = results.every(granted => granted);
    console.log('[BLE Permissions] Check result:', allGranted ? 'all granted' : 'some missing');

    return allGranted;
  } catch (error) {
    console.error('[BLE Permissions] Failed to check permissions:', error);
    return false;
  }
}

/**
 * Show permission settings alert
 */
export function showPermissionSettingsAlert(): void {
  Alert.alert(
    'Permissions Required',
    'BLE permissions are needed for device-to-device communication. Please enable them in app settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Note: React Native doesn't have a direct way to open settings
          // You might need to use a library like react-native-permissions
          console.log('[BLE Permissions] User should open app settings manually');
        }
      }
    ]
  );
}