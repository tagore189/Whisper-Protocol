import { getBleManager, SERVICE_ID } from './bleManager';
import { Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

export interface Node {
  id: string;
  rssi: number | null;
  lastSeen: number;
}

const nodes = new Map<string, Node>();
let scanning = false;

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
  bleManager.startDeviceScan([SERVICE_ID], null, (err: Error | null, device: Device | null) => {
    if (err) {
      console.error('BLE scan error:', err);
      return;
    }
    if (!device) return;

    nodes.set(device.id, {
      id: device.id,
      rssi: device.rssi,
      lastSeen: Date.now(),
    });

    onNodeFound([...nodes.values()]);
  });

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
  scanning = false;
}
