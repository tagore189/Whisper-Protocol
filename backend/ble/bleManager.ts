import { BleManager } from "react-native-ble-plx";
import { Platform } from "react-native";

let bleManager: BleManager | null = null;

export function getBleManager() {
  if (Platform.OS === "web") {
    return { bleManager: null };
  }

  if (!bleManager) {
    bleManager = new BleManager();
  }

  return { bleManager };
}
