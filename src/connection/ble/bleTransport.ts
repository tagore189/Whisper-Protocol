import { PermissionsAndroid, Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { chunkMessage, processChunk } from './bleChunker';

const { BLEPeripheral } = NativeModules;

// BLE Constants
export const SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
export const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456';
export const DEVICE_NAME = 'FL';

// BLE Manager instance
let bleManager: BleManager | null = null;
export let connectedDevice: Device | null = null;
let monitorUnsubscribe: Subscription | null = null;
let messageListeners: ((data: string) => void)[] = [];
let isServerRunning = false;
let isStartingServer = false;

// Map custom deviceId to BLE device.id
export const bleDeviceMap: Record<string, string> = {};

/**
 * Initialize and get BLE Manager
 */
function getBleManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

// Global handler for incoming peripheral data (when other devices write to us)
const handlePeripheralWrite = (params: any) => {
  if (params.data) {
    try {
      const bytes = Uint8Array.from(params.data);
      const chunkString = Buffer.from(bytes).toString('utf8');
      
      // Process chunk
      const fullMessage = processChunk(chunkString);
      if (fullMessage) {
        console.log('[bleTransport] Full message reassembled from chunks');
        messageListeners.forEach(l => {
          try { l(fullMessage); } catch (e) { console.error(e); }
        });
      }
    } catch (err) {
      console.error('[bleTransport] Failed to process incoming peripheral data:', err);
    }
  }
};

// Register listener using DeviceEventEmitter
DeviceEventEmitter.addListener('onCharacteristicWrite', handlePeripheralWrite);

/**
 * Request BLE permissions on Android
 */
async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ];
    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(granted).every((perm) => perm === PermissionsAndroid.RESULTS.GRANTED);
  } catch (error) {
    return false;
  }
}

/**
 * Start GATT Server (Peripheral Mode)
 */
export async function startGattServer(): Promise<boolean> {
  if (isServerRunning || isStartingServer || Platform.OS !== 'android') {
    console.log('[bleTransport] Skipping GATT server start:', { isServerRunning, isStartingServer, platform: Platform.OS });
    return isServerRunning;
  }
  if (!BLEPeripheral) {
    console.log('[bleTransport] BLEPeripheral not available');
    return false;
  }

  isStartingServer = true;
  try {
    console.log('[bleTransport] Requesting BLE permissions...');
    const hasPermissions = await requestBlePermissions();
    console.log('[bleTransport] BLE permissions granted:', hasPermissions);
    if (!hasPermissions) {
      isStartingServer = false;
      return false;
    }

    console.log('[bleTransport] Starting GATT Server setup...');
    await BLEPeripheral.clean();
    await BLEPeripheral.setName(DEVICE_NAME);
    await BLEPeripheral.addService(SERVICE_UUID, true);
    await BLEPeripheral.addCharacteristicToService(SERVICE_UUID, CHARACTERISTIC_UUID, 17, 26);
    await BLEPeripheral.start();
    
    isServerRunning = true;
    isStartingServer = false;
    console.log('[bleTransport] GATT Server started and advertising');
    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to start GATT Server:', error);
    isStartingServer = false;
    return false;
  }
}

/**
 * Automatically scan and connect to nearby Whisper devices
 */
export async function startScanAndConnect(): Promise<void> {
  const manager = getBleManager();
  const subscription = manager.onStateChange((state) => {
    if (state === 'PoweredOn') {
      scanAndConnect();
      subscription.remove();
    }
  }, true);
}

function scanAndConnect() {
  const manager = getBleManager();
  console.log('[bleTransport] Scanning for Whisper devices...');
  manager.startDeviceScan([SERVICE_UUID], null, async (error, device) => {
    if (device) {
      console.log('[bleTransport] Found potential peer:', device.name, device.id);
      if (device.name) {
         // store bleId whenever a device is discovered via scan
         bleDeviceMap[device.name] = device.id; 
      }
    }
  });
}

/**
 * Connect directly to a device by ID
 */
export async function connectDirectly(deviceId: string): Promise<boolean> {
  try {
    const manager = getBleManager();
    console.log('[bleTransport] Connecting directly to:', deviceId);
    
    const device = await manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    connectedDevice = device;
    
    startMonitoring();
    return true;
  } catch (error) {
    console.error('[bleTransport] Direct connection failed:', error);
    return false;
  }
}

/**
 * Connect using explicit bleId
 */
export async function connectToDeviceById(bleId: string) {
  try {
    console.log("[BLE] Direct connecting to:", bleId);

    const manager = getBleManager();

    const device = await manager.connectToDevice(bleId, {
      autoConnect: true,
    });

    const connected = await device.discoverAllServicesAndCharacteristics();

    connectedDevice = connected;

    console.log("[BLE] Connected via QR");

    startMonitoring();

    return true;
  } catch (e) {
    console.error("[BLE] Direct connect failed:", e);
    startScanAndConnect();
    return false;
  }
}

/**
 * Start monitoring characteristic for incoming messages (Central Mode)
 */
function startMonitoring(): void {
  if (!connectedDevice || !bleManager) return;

  monitorUnsubscribe = bleManager.monitorCharacteristicForDevice(
    connectedDevice.id,
    SERVICE_UUID,
    CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) return;
      if (characteristic?.value) {
        try {
          const decodedData = Buffer.from(characteristic.value, 'base64');
          const chunkString = decodedData.toString('utf8');
          
          const fullMessage = processChunk(chunkString);
          if (fullMessage) {
            messageListeners.forEach(l => l(fullMessage));
          }
        } catch (e) {}
      }
    }
  );
}

/**
 * Send data via BLE with chunking
 */
export async function sendBLE(data: string): Promise<boolean> {
  const msgId = Math.random().toString(36).substring(7);
  const chunks = chunkMessage(msgId, data);
  console.log(`[bleTransport] Sending message ${msgId} in ${chunks.length} chunks`);

  let finalSuccess = true;

  for (const chunk of chunks) {
    let chunkSuccess = false;
    
    // Try Central Mode
    if (connectedDevice && bleManager) {
      try {
        const encoded = Buffer.from(chunk, 'utf8').toString('base64');
        await bleManager.writeCharacteristicWithResponseForDevice(
          connectedDevice.id,
          SERVICE_UUID,
          CHARACTERISTIC_UUID,
          encoded
        );
        chunkSuccess = true;
      } catch (e) {
        console.warn('[bleTransport] Chunk send failed (Central):', e);
      }
    }

    // Try Peripheral Mode if Central failed or isn't connected
    if (!chunkSuccess && isServerRunning) {
      try {
         const bytes = Array.from(Buffer.from(chunk, 'utf8'));
         await BLEPeripheral.sendNotificationToDevices(SERVICE_UUID, CHARACTERISTIC_UUID, bytes);
         chunkSuccess = true;
      } catch (e) {
         console.warn('[bleTransport] Chunk send failed (Peripheral):', e);
      }
    }

    if (!chunkSuccess) {
      finalSuccess = false;
      break;
    }
    
    // Small delay between chunks to prevent flooding
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return finalSuccess;
}

export function onBLEMessage(callback: (data: string) => void): void {
  messageListeners.push(callback);
}

export async function disconnectBLE(): Promise<boolean> {
  if (monitorUnsubscribe) monitorUnsubscribe.remove();
  if (connectedDevice) await connectedDevice.cancelConnection();
  connectedDevice = null;
  return true;
}

export function isConnected(): boolean {
  return connectedDevice !== null || isServerRunning;
}