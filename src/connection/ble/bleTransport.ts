import { PermissionsAndroid, Platform, NativeModules, DeviceEventEmitter, Alert } from 'react-native';
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

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
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
  } else {
    console.error(`[bleTransport] Final reconnect failure after ${MAX_RECONNECT} attempts.`);
    emitConnectionState('failed');
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

/**
 * Race a promise against a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
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
 * Start GATT Server (Peripheral Mode).
 * @param advertisedName - BLE peripheral name to advertise. Defaults to DEVICE_NAME.
 * On non-Android platforms this is a no-op that returns true immediately.
 */
export async function startGattServer(advertisedName?: string): Promise<boolean> {
  // iOS / web — peripheral role not managed here; treat as ready
  if (Platform.OS !== 'android') {
    return true;
  }

  // Already running — no need to restart
  if (isServerRunning) {
    return true;
  }

  // Guard against concurrent start
  if (isStartingServer) {
    return false;
  }

  if (!BLEPeripheral) {
    console.log('[bleTransport] BLEPeripheral not available');
    return false;
  }

  const nameToUse = advertisedName ?? DEVICE_NAME;
  isStartingServer = true;
  try {
    console.log('[bleTransport] Requesting BLE permissions...');
    const hasPermissions = await requestBlePermissions();
    if (!hasPermissions) {
      console.warn('[bleTransport] BLE permissions denied');
      isStartingServer = false;
      return false;
    }

    console.log('[bleTransport] Starting GATT Server as:', nameToUse);
    await BLEPeripheral.clean();
    await BLEPeripheral.setName(nameToUse);
    await BLEPeripheral.addService(SERVICE_UUID, true);
    await BLEPeripheral.addCharacteristicToService(SERVICE_UUID, CHARACTERISTIC_UUID, 17, 26);
    await BLEPeripheral.start();

    isServerRunning = true;
    isStartingServer = false;
    console.log(`[bleTransport] GATT Server advertising as "${nameToUse}" on UUID: ${SERVICE_UUID}`);
    return true;
  } catch (error) {
    console.error('[bleTransport] Failed to start GATT Server:', error);
    isStartingServer = false;
    isServerRunning = false;
    return false;
  }
}

export async function ensureAdvertising(advertisedName?: string) {
  if (!isServerRunning) {
    console.warn('[bleTransport] Advertising stopped! Restarting GATT server...');
    await startGattServer(advertisedName);
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
 * Connect to a device by its BLE hardware ID with automatic retries.
 */
export async function connectToDeviceById(bleId: string, retryCount = 0): Promise<boolean> {
  try {
    const manager = getBleManager();

    console.log(`[BLE] Connecting to: ${bleId} (attempt ${retryCount + 1})`);
    emitConnectionState('connecting');

    const device = await withTimeout(
      manager.connectToDevice(bleId, { autoConnect: false }),
      10000,
      'Connection timed out'
    );

    if (Platform.OS === 'android') {
      try {
        await device.requestMTU(512);
        console.log('[bleTransport] Requested MTU 512');
      } catch (e) {
        console.warn('[bleTransport] MTU request failed:', e);
      }
    }

    const connected = await withTimeout(
      device.discoverAllServicesAndCharacteristics(),
      8000,
      'Service discovery timed out'
    );
    connectedDevice = connected;
    reconnectAttempts = 0;

    console.log('[BLE] Connected to:', bleId);
    emitConnectionState('connected');
    resendPendingMessages();

    if (disconnectSubscription) {
      disconnectSubscription.remove();
    }
    disconnectSubscription = manager.onDeviceDisconnected(bleId, (err) => handleDisconnect(err, bleId));
    startMonitoring();

    return true;
  } catch (e) {
    if (retryCount < 2) {
      console.warn(`[BLE] Connection attempt ${retryCount + 1} failed, retrying...`, e);
      return new Promise((resolve) => {
        setTimeout(() => resolve(connectToDeviceById(bleId, retryCount + 1)), 2000);
      });
    }
    console.error('[BLE] All connection attempts failed for', bleId, e);
    emitConnectionState('failed');
    return false;
  }
}

/**
 * Connect via a QR payload.
 *
 * Scans by payload.serviceUUID first (5 s), matching device by advertisedName.
 * Falls back to an unfiltered scan (5 s) with manual UUID/name check.
 * All timeouts are tight to keep total connection time under 5-8 s.
 */
export async function connectViaQRPayload(payload: {
  deviceId: string;
  deviceName: string;
  advertisedName: string;
  serviceUUID: string;
  sessionToken: string;
  timestamp: number;
}): Promise<boolean> {
  const manager = getBleManager();

  // 1. Permissions
  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) {
    throw new Error('Bluetooth permissions are required. Please grant them in Settings.');
  }

  // 2. Wait for BLE powered on — 3 s max
  await withTimeout(
    new Promise<void>((resolve) => {
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
      }, true);
    }),
    3000,
    'Bluetooth is not powered on. Please enable Bluetooth and try again.'
  );

  // 3. Stop any lingering scan
  try { manager.stopDeviceScan(); } catch (_) {}

  emitConnectionState('connecting');

  /** Returns true if the scanned device matches the QR target by name */
  const isNameMatch = (device: Device): boolean =>
    device.name === payload.advertisedName ||
    (device as any).localName === payload.advertisedName;

  // 4a. Primary scan: filtered by serviceUUID, match by name — 5 s
  let targetBleId: string | null = null;
  console.log('[BLE] QR primary scan started (serviceUUID filter, name match):', payload.advertisedName);

  try {
    targetBleId = await withTimeout(
      new Promise<string>((resolve, reject) => {
        manager.startDeviceScan([payload.serviceUUID], { allowDuplicates: false }, (error, device) => {
          if (error) { manager.stopDeviceScan(); reject(error); return; }
          if (device) {
            console.log('[BLE] Device found (primary):', device.name, device.id);
            if (isNameMatch(device)) {
              console.log('[BLE] Matched device (primary):', device.name, device.id);
              manager.stopDeviceScan();
              resolve(device.id);
            }
          }
        });
      }),
      5000,
      '__primary_timeout__'
    );
  } catch (e: any) {
    if (e?.message !== '__primary_timeout__') throw e;
    console.log('[BLE] Primary scan timed out, trying fallback...');
    try { manager.stopDeviceScan(); } catch (_) {}
  }

  // 4b. Fallback scan: no UUID filter, manual name+UUID check — 5 s
  if (!targetBleId) {
    console.log('[BLE] QR fallback scan started (no filter)');
    try {
      targetBleId = await withTimeout(
        new Promise<string>((resolve, reject) => {
          manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
            if (error) { manager.stopDeviceScan(); reject(error); return; }
            if (device) {
              console.log('[BLE] Device found (fallback):', device.name, device.id);
              const uuidMatch = (device.serviceUUIDs ?? []).some(
                (u) => u.toLowerCase() === payload.serviceUUID.toLowerCase()
              );
              if (isNameMatch(device) || uuidMatch) {
                console.log('[BLE] Matched device (fallback):', device.name, device.id);
                manager.stopDeviceScan();
                resolve(device.id);
              }
            }
          });
        }),
        5000,
        'Device not found. Make sure the other phone is showing QR and Bluetooth is on.'
      );
    } catch (e) {
      try { manager.stopDeviceScan(); } catch (_) {}
      throw e;
    }
  }

  // 5. Connect — 7 s
  console.log('[BLE] Connecting to matched device:', targetBleId);
  const device = await withTimeout(
    manager.connectToDevice(targetBleId, { autoConnect: false }),
    7000,
    'Connection timed out'
  );

  // 6. MTU 512 on Android
  if (Platform.OS === 'android') {
    try { await device.requestMTU(512); console.log('[bleTransport] MTU 512 requested'); }
    catch (e) { console.warn('[bleTransport] MTU request failed:', e); }
  }

  // 7. Discover services — 5 s
  console.log('[BLE] Discovering services for:', targetBleId);
  const connected = await withTimeout(
    device.discoverAllServicesAndCharacteristics(),
    5000,
    'Service discovery timed out'
  );
  console.log('[BLE] Discovery complete for:', targetBleId);

  connectedDevice = connected;
  reconnectAttempts = 0;

  // 8. Disconnect handler
  if (disconnectSubscription) disconnectSubscription.remove();
  disconnectSubscription = manager.onDeviceDisconnected(targetBleId, (err) => handleDisconnect(err, targetBleId!));

  // 9. Monitor + emit
  startMonitoring();
  emitConnectionState('connected');
  resendPendingMessages();

  console.log('[BLE] connectViaQRPayload: connected to', targetBleId);
  return true;
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

let isSendingBle = false;
const bleSendQueue: { data: string, resolve: (val: boolean) => void }[] = [];

async function processBleSendQueue() {
  if (isSendingBle || bleSendQueue.length === 0) return;
  isSendingBle = true;

  while (bleSendQueue.length > 0) {
    const { data, resolve } = bleSendQueue.shift()!;
    const success = await doSendBLE(data);
    resolve(success);
  }

  isSendingBle = false;
}

/**
 * Queue data via BLE with chunking sequentially to prevent overflow
 */
export async function sendBLE(data: string): Promise<boolean> {
  return new Promise(resolve => {
    bleSendQueue.push({ data, resolve });
    processBleSendQueue();
  });
}

async function doSendBLE(data: string): Promise<boolean> {
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
    
    // Strict delay between chunks to prevent overflow and parallel write errors
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