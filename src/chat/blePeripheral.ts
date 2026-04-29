import { PermissionsAndroid, Platform } from 'react-native';
import { BLE_CONSTANTS } from './bleConstants';

interface PeripheralState {
  isAdvertising: boolean;
  peripheral: any;
}

let peripheralState: PeripheralState = {
  isAdvertising: false,
  peripheral: null,
};

/**
 * Request necessary permissions for BLE advertising on Android
 */
async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error('[BLE Peripheral] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Initialize BLE peripheral (advertising)
 */
export async function initPeripheral(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.warn('[BLE Peripheral] BLE not supported on web');
    return false;
  }

  try {
    // For React Native, we'll use react-native-ble-peripheral
    // This is a placeholder - actual implementation would use the library
    console.log('[BLE Peripheral] Initializing peripheral mode');
    return true;
  } catch (error) {
    console.error('[BLE Peripheral] Failed to initialize:', error);
    return false;
  }
}

/**
 * Start advertising as a peripheral
 */
export async function startAdvertising(): Promise<boolean> {
  if (peripheralState.isAdvertising) {
    console.warn('[BLE Peripheral] Already advertising');
    return true;
  }

  const hasPermissions = await requestBLEPermissions();
  if (!hasPermissions) {
    console.error('[BLE Peripheral] Missing required permissions');
    return false;
  }

  try {
    // In a real implementation, this would use react-native-ble-peripheral
    // to start advertising with the service UUID and device name
    console.log('[BLE Peripheral] Starting advertisement with name:', BLE_CONSTANTS.DEVICE_NAME);

    peripheralState.isAdvertising = true;
    peripheralState.peripheral = {
      serviceUuid: BLE_CONSTANTS.SERVICE_UUID,
      characteristicUuid: BLE_CONSTANTS.CHARACTERISTIC_UUID,
      deviceName: BLE_CONSTANTS.DEVICE_NAME,
    };

    return true;
  } catch (error) {
    console.error('[BLE Peripheral] Failed to start advertising:', error);
    peripheralState.isAdvertising = false;
    return false;
  }
}

/**
 * Stop advertising
 */
export function stopAdvertising(): boolean {
  try {
    if (!peripheralState.isAdvertising) {
      console.warn('[BLE Peripheral] Not currently advertising');
      return false;
    }

    console.log('[BLE Peripheral] Stopping advertisement');
    peripheralState.isAdvertising = false;
    peripheralState.peripheral = null;

    return true;
  } catch (error) {
    console.error('[BLE Peripheral] Failed to stop advertising:', error);
    return false;
  }
}

/**
 * Send data to connected centrals
 */
export async function notifyCharacteristic(data: string): Promise<boolean> {
  if (!peripheralState.isAdvertising) {
    console.warn('[BLE Peripheral] Not advertising, cannot notify');
    return false;
  }

  try {
    // In a real implementation, this would use react-native-ble-peripheral
    // to notify connected centrals with the data
    console.log('[BLE Peripheral] Notifying characteristic with data length:', data.length);
    return true;
  } catch (error) {
    console.error('[BLE Peripheral] Failed to notify characteristic:', error);
    return false;
  }
}

/**
 * Check if currently advertising
 */
export function isAdvertising(): boolean {
  return peripheralState.isAdvertising;
}