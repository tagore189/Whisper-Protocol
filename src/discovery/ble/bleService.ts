import { Device } from "react-native-ble-plx";
import { getOrCreateIdentity } from '../../core/identity/identity';

import { getBleManager } from "./bleManager";

class BleService {
  async init() {
    // No-op: manager is lazy-loaded via getBleManager()
  }

  startScan(onDevice: (device: Device) => void) {
    const { bleManager } = getBleManager();
    if (!bleManager) return;

    bleManager.startDeviceScan(
      null,
      { allowDuplicates: true },
      (error, device) => {
        if (error || !device) return;
        onDevice(device);
      });
  }

  stopScan() {
    const { bleManager } = getBleManager();
    bleManager?.stopDeviceScan();
  }

  /**
   * 🔗 CONNECT ONLY (Expo-safe)
   * Handshake is deferred until native BLE characteristics are available
   */
  async connect(device: Device): Promise<{
    deviceId: string;
    displayName: string;
  }> {
    const { bleManager } = getBleManager();
    if (!bleManager) {
      throw new Error("BLE manager not initialized");
    }

    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    const myIdentity = await getOrCreateIdentity();

    return {
      deviceId: connected.id,
      displayName:
        device.name ||
        device.localName ||
        `FortiLink-${connected.id.slice(-6)}`,
    };
  }
}

export const bleService = new BleService();
