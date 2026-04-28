import { getBleManager } from './bleManager';
import { Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

export interface Node {
  id: string;
  rssi: number | null;
  lastSeen: number;
}

const nodes = new Map<string, Node>();
let scanning = false;
let pruneTimer: ReturnType<typeof setInterval> | null = null;
let emitTimer: ReturnType<typeof setTimeout> | null = null;
const NODE_STALE_MS = 12000;
const EMIT_THROTTLE_MS = 750;
const PRUNE_INTERVAL_MS = 4000;

function stopEmitTimer(): void {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
}

function scheduleEmit(onNodeFound: (nodes: Node[]) => void): void {
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    onNodeFound(Array.from(nodes.values()));
  }, EMIT_THROTTLE_MS);
}

async function requestScanPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];
    const granted = await PermissionsAndroid.requestMultiple(permissions);
    return Object.values(granted).every(
      (perm) => perm === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (error) {
    console.error('Failed to request BLE scan permissions:', error);
    return false;
  }
}

export async function startScanning(onNodeFound: (nodes: Node[]) => void): Promise<boolean> {
  if (scanning) {
    return true;
  }

  const hasPermissions = await requestScanPermissions();
  if (!hasPermissions) {
    console.warn('BLE scan permissions denied');
    return false;
  }

  const bleManager = getBleManager();
  if (!bleManager) {
    console.warn('BLE Manager not available, skipping scan');
    return false;
  }

  scanning = true;
  nodes.clear();
  bleManager.startDeviceScan(null, { allowDuplicates: true }, (err: Error | null, device: Device | null) => {
    if (err) {
      console.error('BLE scan error:', err);
      return;
    }
    if (!device) return;

    const existing = nodes.get(device.id);
    nodes.set(device.id, {
      id: device.id,
      rssi: device.rssi ?? existing?.rssi ?? null,
      lastSeen: Date.now(),
    });
    scheduleEmit(onNodeFound);
  });

  pruneTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, node] of nodes) {
      if (now - node.lastSeen > NODE_STALE_MS) {
        nodes.delete(id);
        changed = true;
      }
    }
    if (changed) {
      scheduleEmit(onNodeFound);
    }
  }, PRUNE_INTERVAL_MS);

  return true;
}

export function stopScanning() {
  if (!scanning) {
    return;
  }

  const bleManager = getBleManager();
  if (!bleManager) {
    scanning = false;
    return;
  }

  bleManager.stopDeviceScan();
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = null;
  }
  stopEmitTimer();
  nodes.clear();
  scanning = false;
}
