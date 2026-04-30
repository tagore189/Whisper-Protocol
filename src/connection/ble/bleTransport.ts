import { PermissionsAndroid, Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { chunkMessage, processChunk } from './bleChunker';
import { resendPendingMessages } from './bleMessaging';

const { BLEPeripheral } = NativeModules;

// BLE Constants
export const SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
export const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456';
export const DEVICE_NAME = 'FL';

// BLE Manager instance
let bleManager: BleManager | null = null;
export let connectedDevice: Device | null = null;
let monitorUnsubscribe: Subscription | null = null;
let disconnectSubscription: Subscription | null = null;
let messageListeners: ((data: string) => void)[] = [];
let isServerRunning = false;
let isStartingServer = false;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
let connectionStateListeners: ((state: ConnectionState) => void)[] = [];

export function onConnectionStateChange(cb: (state: ConnectionState) => void) {
  connectionStateListeners.push(cb);
}

function emitConnectionState(state: ConnectionState) {
  connectionStateListeners.forEach(cb => {
    try { cb(state); } catch(e) {}
  });
}

let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// Disconnect handler for auto-reconnect
function handleDisconnect(error: any, deviceId: string) {
  console.log('[bleTransport] Disconnected from', deviceId, error);
  connectedDevice = null;
  if (monitorUnsubscribe) {
    monitorUnsubscribe.remove();
    monitorUnsubscribe = null;
  }
  if (disconnectSubscription) {
    disconnectSubscription.remove();
    disconnectSubscription = null;
  }
  
  emitConnectionState('disconnected');
  
  if (reconnectAttempts < MAX_RECONNECT) {
    reconnectAttempts++;
    console.log(`[bleTransport] Reconnecting... Attempt ${reconnectAttempts}`);
    emitConnectionState('reconnecting');
    setTimeout(() => {
      connectToDeviceById(deviceId);
    }, 2000 * reconnectAttempts);
  }
}

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
    console.log(`[bleTransport] GATT Server started and advertising on UUID: ${SERVICE_UUID}`);
    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to start GATT Server:', error);
    isStartingServer = false;
    isServerRunning = false;
    return false;
  }
}

export async function ensureAdvertising() {
  if (!isServerRunning) {
    console.warn('[bleTransport] Advertising stopped! Restarting GATT server...');
    await startGattServer();
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
  return connectToDeviceById(deviceId);
}

/**
 * Connect using explicit bleId with automatic retries for QR scanning reliability
 */
export async function connectToDeviceById(bleId: string, retryCount = 0): Promise<boolean> {
  try {
    console.log(`[BLE] Direct connecting to: ${bleId} (Attempt: ${retryCount + 1})`);
    emitConnectionState('connecting');
    const manager = getBleManager();

    const device = await manager.connectToDevice(bleId, {
      autoConnect: true,
    });

    if (Platform.OS === 'android') {
      try {
        await device.requestMTU(512);
        console.log('[bleTransport] Requested MTU 512');
      } catch (e) {
        console.warn('[bleTransport] MTU request failed:', e);
      }
    }

    const connected = await device.discoverAllServicesAndCharacteristics();
    connectedDevice = connected;
    reconnectAttempts = 0; // Reset on success

    console.log("[BLE] Connected via QR");
    emitConnectionState('connected');
    
    // Auto-resend any pending messages
    resendPendingMessages();

    if (disconnectSubscription) {
      disconnectSubscription.remove();
    }
    disconnectSubscription = manager.onDeviceDisconnected(bleId, (err) => handleDisconnect(err, bleId));
    startMonitoring();

    return true;
  } catch (e) {
    if (retryCount < 2) { // 3 total attempts
      console.warn(`[BLE] Connection attempt ${retryCount + 1} failed. Retrying...`);
      return new Promise((resolve) => {
        setTimeout(() => resolve(connectToDeviceById(bleId, retryCount + 1)), 2000);
      });
    }
    console.error("[BLE] Direct connect failed after 3 attempts:", e);
    emitConnectionState('disconnected');
    startScanAndConnect();
    return false;
  }
}

/**
 * QR-based connection alias
 */
export async function connectViaQR(scannedData: { deviceId: string; serviceUUID?: string; bleId: string }) {
  return connectToDeviceById(scannedData.bleId);
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
  if (monitorUnsubscribe) {
    monitorUnsubscribe.remove();
    monitorUnsubscribe = null;
  }
  if (disconnectSubscription) {
    disconnectSubscription.remove();
    disconnectSubscription = null;
  }
  if (connectedDevice) {
    await connectedDevice.cancelConnection();
  }
  connectedDevice = null;
  emitConnectionState('disconnected');
  return true;
}

export function isConnected(): boolean {
  return connectedDevice !== null || isServerRunning;
}