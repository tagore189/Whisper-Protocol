import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// BLE Constants
export const SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
export const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456';
export const DEVICE_NAME = 'FortiLink';

// BLE Manager instance
let bleManager: BleManager | null = null;
let connectedDevice: Device | null = null;
let monitorUnsubscribe: (() => void) | null = null;
let messageListeners: ((data: string) => void)[] = [];

/**
 * Initialize and get BLE Manager
 */
function getBleManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

/**
 * Request BLE permissions on Android
 */
async function requestBlePermissions(): Promise<boolean> {
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
    const allGranted = Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );

    if (allGranted) {
      console.log('[bleTransport] All BLE permissions granted');
    } else {
      console.warn('[bleTransport] Some BLE permissions denied');
    }

    return allGranted;
  } catch (error) {
    console.error('[bleTransport] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Scan for nearby FortiLink devices and connect
 */
export async function startScanAndConnect(): Promise<boolean> {
  try {
    const hasPermissions = await requestBlePermissions();
    if (!hasPermissions) {
      console.warn('[bleTransport] Missing BLE permissions');
      return false;
    }

    const manager = getBleManager();
    console.log('[bleTransport] Starting scan for FortiLink devices...');

    manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
      if (error) {
        console.error('[bleTransport] Scan error:', error);
        return;
      }

      if (!device) return;

      // Filter for FortiLink devices
      if (device.name === DEVICE_NAME && !connectedDevice) {
        console.log('[bleTransport] Found FortiLink device:', device.id, device.name);

        try {
          manager.stopDeviceScan();
          await connectToDevice(device);
        } catch (connectError) {
          console.error('[bleTransport] Connection failed:', connectError);
          // Resume scanning
          manager.startDeviceScan(null, { allowDuplicates: false }, (e, d) => {
            if (e) return;
            if (d && d.name === DEVICE_NAME && !connectedDevice) {
              manager.stopDeviceScan();
              connectToDevice(d).catch(console.error);
            }
          });
        }
      }
    });

    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to start scan:', error);
    return false;
  }
}

/**
 * Connect to a BLE device
 */
async function connectToDevice(device: Device): Promise<boolean> {
  try {
    console.log('[bleTransport] Connecting to device:', device.id);

    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    connectedDevice = connected;
    console.log('[bleTransport] Connected and discovered services');

    // Start monitoring characteristic for incoming messages
    startMonitoring();

    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to connect to device:', error);
    return false;
  }
}

/**
 * Start monitoring characteristic for incoming messages
 */
function startMonitoring(): void {
  if (!connectedDevice || !bleManager) {
    console.warn('[bleTransport] Cannot start monitoring - no connected device');
    return;
  }

  try {
    console.log('[bleTransport] Starting characteristic monitoring');

    monitorUnsubscribe = bleManager.monitorCharacteristicForDevice(
      connectedDevice.id,
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('[bleTransport] Monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            // Decode base64 message
            const decodedData = Buffer.from(characteristic.value, 'base64');
            const jsonString = decodedData.toString('utf8');
            console.log('[bleTransport] Received message:', jsonString.substring(0, 50) + '...');

            // Emit to listeners
            messageListeners.forEach((listener) => {
              try {
                listener(jsonString);
              } catch (error) {
                console.error('[bleTransport] Listener error:', error);
              }
            });
          } catch (decodeError) {
            console.error('[bleTransport] Failed to decode message:', decodeError);
          }
        }
      }
    );
  } catch (error) {
    console.error('[bleTransport] Failed to start monitoring:', error);
  }
}

/**
 * Send data via BLE
 */
export async function sendBLE(data: string): Promise<boolean> {
  if (!connectedDevice || !bleManager) {
    console.warn('[bleTransport] Cannot send - no connected device');
    return false;
  }

  try {
    // Encode to base64
    const encoded = Buffer.from(data, 'utf8').toString('base64');

    console.log('[bleTransport] Sending via BLE, length:', data.length);

    await bleManager.writeCharacteristicWithResponseForDevice(
      connectedDevice.id,
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      encoded
    );

    console.log('[bleTransport] Message sent successfully');
    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to send via BLE:', error);
    return false;
  }
}

/**
 * Register a listener for incoming BLE messages
 */
export function onBLEMessage(callback: (data: string) => void): void {
  messageListeners.push(callback);
  console.log('[bleTransport] Registered BLE message listener, total:', messageListeners.length);
}

/**
 * Disconnect from BLE device
 */
export async function disconnectBLE(): Promise<boolean> {
  try {
    if (monitorUnsubscribe) {
      monitorUnsubscribe();
      monitorUnsubscribe = null;
    }

    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      connectedDevice = null;
      console.log('[bleTransport] Disconnected from device');
    }

    if (bleManager) {
      bleManager.stopDeviceScan();
    }

    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to disconnect:', error);
    return false;
  }
}

/**
 * Check if connected to a BLE device
 */
export function isConnected(): boolean {
  return connectedDevice !== null;
}

/**
 * Get connected device info
 */
export function getConnectedDeviceId(): string | null {
  return connectedDevice?.id || null;
}