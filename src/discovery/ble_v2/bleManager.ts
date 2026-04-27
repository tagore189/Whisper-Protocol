import { BleManager } from 'react-native-ble-plx';
import { Platform } from 'react-native';

let bleManagerInstance: BleManager | null = null;

export function getBleManager(): BleManager | null {
  if (bleManagerInstance) {
    return bleManagerInstance;
  }
  
  if (Platform.OS === 'web') {
    console.warn('BLE is not supported on web platform');
    return null;
  }
  
  try {
    bleManagerInstance = new BleManager();
    return bleManagerInstance;
  } catch (error) {
    console.error('Failed to initialize BleManager:', error);
    return null;
  }
}

export const SERVICE_ID = '0000abcd-0000-1000-8000-00805f9b34fb';
export const CHAR_ID    = '0000dcba-0000-1000-8000-00805f9b34fb';
