import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { BLE_CONSTANTS } from './bleConstants';

interface CentralState {
  isScanning: boolean;
  connectedDevice: Device | null;
  bleManager: BleManager | null;
}

let centralState: CentralState = {
  isScanning: false,
  connectedDevice: null,
  bleManager: null,
};

/**
 * Request necessary permissions for BLE scanning and connecting on Android
 */
async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error('[BLE Central] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Initialize BLE central (scanning + connecting)
 */
export async function initCentral(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.warn('[BLE Central] BLE not supported on web');
    return false;
  }

  if (centralState.bleManager) {
    return true; // Already initialized
  }

  try {
    centralState.bleManager = new BleManager();
    console.log('[BLE Central] Initialized BLE manager');
    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to initialize BLE manager:', error);
    return false;
  }
}

/**
 * Start scanning for FortiLink devices
 */
export async function startScanning(onDeviceFound: (device: Device) => void): Promise<boolean> {
  if (centralState.isScanning) {
    console.warn('[BLE Central] Already scanning');
    return true;
  }

  const hasPermissions = await requestBLEPermissions();
  if (!hasPermissions) {
    console.error('[BLE Central] Missing required permissions');
    return false;
  }

  if (!centralState.bleManager) {
    console.error('[BLE Central] BLE manager not initialized');
    return false;
  }

  try {
    centralState.isScanning = true;
    console.log('[BLE Central] Starting scan for devices...');

    centralState.bleManager.startDeviceScan(
      null, // Scan for all services
      { allowDuplicates: true },
      (error, device) => {
        if (error) {
          console.error('[BLE Central] Scan error:', error);
          return;
        }

        if (!device) return;

        // Filter for FortiLink devices
        if (device.name === BLE_CONSTANTS.DEVICE_NAME) {
          console.log('[BLE Central] Found FortiLink device:', device.id, device.name);
          onDeviceFound(device);
        }
      }
    );

    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to start scanning:', error);
    centralState.isScanning = false;
    return false;
  }
}

/**
 * Stop scanning
 */
export function stopScanning(): boolean {
  try {
    if (!centralState.isScanning) {
      console.warn('[BLE Central] Not currently scanning');
      return false;
    }

    if (centralState.bleManager) {
      centralState.bleManager.stopDeviceScan();
    }

    centralState.isScanning = false;
    console.log('[BLE Central] Stopped scanning');
    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to stop scanning:', error);
    return false;
  }
}

/**
 * Connect to a discovered device
 */
export async function connectToDevice(device: Device): Promise<boolean> {
  if (!centralState.bleManager) {
    console.error('[BLE Central] BLE manager not initialized');
    return false;
  }

  try {
    console.log('[BLE Central] Connecting to device:', device.id);

    const connectedDevice = await device.connect();
    await connectedDevice.discoverAllServicesAndCharacteristics();

    centralState.connectedDevice = connectedDevice;
    console.log('[BLE Central] Successfully connected to device:', device.id);

    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to connect to device:', error);
    return false;
  }
}

/**
 * Disconnect from the connected device
 */
export async function disconnectDevice(): Promise<boolean> {
  if (!centralState.connectedDevice) {
    console.warn('[BLE Central] No device connected');
    return false;
  }

  try {
    await centralState.connectedDevice.cancelConnection();
    centralState.connectedDevice = null;
    console.log('[BLE Central] Disconnected from device');
    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to disconnect:', error);
    return false;
  }
}

/**
 * Monitor characteristic for incoming data
 */
export function monitorCharacteristic(
  onDataReceived: (data: string) => void
): (() => void) | null {
  if (!centralState.connectedDevice || !centralState.bleManager) {
    console.error('[BLE Central] No connected device to monitor');
    return null;
  }

  try {
    console.log('[BLE Central] Starting characteristic monitoring');

    const subscription = centralState.bleManager.monitorCharacteristicForDevice(
      centralState.connectedDevice.id,
      BLE_CONSTANTS.SERVICE_UUID,
      BLE_CONSTANTS.CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('[BLE Central] Monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            // Decode base64 data
            const data = Buffer.from(characteristic.value, 'base64').toString('utf8');
            console.log('[BLE Central] Received data length:', data.length);
            onDataReceived(data);
          } catch (decodeError) {
            console.error('[BLE Central] Failed to decode received data:', decodeError);
          }
        }
      }
    );

    // Return unsubscribe function
    return () => {
      subscription.remove();
      console.log('[BLE Central] Stopped characteristic monitoring');
    };
  } catch (error) {
    console.error('[BLE Central] Failed to start monitoring:', error);
    return null;
  }
}

/**
 * Send data to connected peripheral
 */
export async function writeCharacteristic(data: string): Promise<boolean> {
  if (!centralState.connectedDevice || !centralState.bleManager) {
    console.error('[BLE Central] No connected device to write to');
    return false;
  }

  try {
    // Encode data as base64
    const encodedData = Buffer.from(data).toString('base64');

    await centralState.bleManager.writeCharacteristicWithResponseForDevice(
      centralState.connectedDevice.id,
      BLE_CONSTANTS.SERVICE_UUID,
      BLE_CONSTANTS.CHARACTERISTIC_UUID,
      encodedData
    );

    console.log('[BLE Central] Sent data length:', data.length);
    return true;
  } catch (error) {
    console.error('[BLE Central] Failed to write characteristic:', error);
    return false;
  }
}

/**
 * Check if currently scanning
 */
export function isScanning(): boolean {
  return centralState.isScanning;
}

/**
 * Check if connected to a device
 */
export function isConnected(): boolean {
  return centralState.connectedDevice !== null;
}

/**
 * Get connected device info
 */
export function getConnectedDevice(): Device | null {
  return centralState.connectedDevice;
}