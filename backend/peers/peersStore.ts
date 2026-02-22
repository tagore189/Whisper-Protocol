import { BleManager, Device } from "react-native-ble-plx";
import { Platform } from "react-native";
import { getOrCreateIdentity } from "../../backend/identity/identity";

class BleService {
  private manager: BleManager | null = null;

  async init() {
    if (Platform.OS === "web") {
      throw new Error("Bluetooth not supported on web");
    }

    if (!this.manager) {
      this.manager = new BleManager();
    }
  }

  startScan(onDevice: (device: Device) => void) {
    if (!this.manager) return;

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error || !device) return;
      onDevice(device);
    });
  }

  stopScan() {
    this.manager?.stopDeviceScan();
  }

  /**
   * 🔗 CONNECT (Expo-safe)
   * Identity exchange is deferred until native BLE is added
   */
  async connect(device: Device): Promise<{
    deviceId: string;
    whisperName: string;
  }> {
    if (!this.manager) {
      throw new Error("BLE manager not initialized");
    }

    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    const myIdentity = await getOrCreateIdentity();

    return {
      deviceId: connected.id,
      whisperName:
        device.name ||
        device.localName ||
        `Whisper-${connected.id.slice(-6)}`,
    };
  }
}

export const bleService = new BleService();
