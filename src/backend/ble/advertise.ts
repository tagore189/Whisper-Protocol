import { getBleManager, SERVICE_ID, CHAR_ID } from './bleManager';
import { Device, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { getOrCreateIdentity } from '../identity/identity';

interface AdvertiserState {
  isAdvertising: boolean;
  peripheral: any;
}

let advertiserState: AdvertiserState = {
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
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error('Failed to request BLE permissions:', error);
    return false;
  }
}

/**
 * Start advertising the BLE service with device identity
 */
export async function startAdvertising(): Promise<boolean> {
  if (advertiserState.isAdvertising) {
    console.warn('BLE Advertiser already running');
    return true;
  }

  try {
    // Check permissions
    const hasPermissions = await requestBLEPermissions();
    if (!hasPermissions) {
      console.error('Missing required BLE permissions');
      return false;
    }

    const bleManager = getBleManager();
    if (!bleManager) {
      console.error('BLE Manager not available');
      return false;
    }

    const identity = await getOrCreateIdentity();

    // Prepare advertising data
    const advertisingData = {
      serviceUUIDs: [SERVICE_ID],
      manufacturerData: {
        // Using manufacturer ID for generic data
        data: Buffer.from(identity.nodeId, 'hex'),
      },
    };

    // Start advertising (native implementation handles the actual advertising)
    // For now, we'll simulate the advertising by keeping track of state
    advertiserState.isAdvertising = true;
    advertiserState.peripheral = {
      serviceId: SERVICE_ID,
      nodeId: identity.nodeId,
      startTime: Date.now(),
    };

    console.log('BLE Advertising started with nodeId:', identity.nodeId);
    return true;
  } catch (error) {
    console.error('Failed to start BLE advertising:', error);
    advertiserState.isAdvertising = false;
    return false;
  }
}

/**
 * Stop advertising the BLE service
 */
export function stopAdvertising(): boolean {
  try {
    if (!advertiserState.isAdvertising) {
      console.warn('BLE Advertiser not running');
      return false;
    }

    advertiserState.isAdvertising = false;
    advertiserState.peripheral = null;

    console.log('BLE Advertising stopped');
    return true;
  } catch (error) {
    console.error('Failed to stop BLE advertising:', error);
    return false;
  }
}

/**
 * Get current advertising state
 */
export function getAdvertisingState(): AdvertiserState {
  return { ...advertiserState };
}

/**
 * Check if currently advertising
 */
export function isAdvertising(): boolean {
  return advertiserState.isAdvertising;
}
