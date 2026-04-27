import { BleManager } from "react-native-ble-plx";
import { Platform } from "react-native";

let bleManager: BleManager | null = null;
let initFailed = false;

export function getBleManager() {
  if (Platform.OS === "web") {
    return { bleManager: null };
  }

  if (initFailed) {
    return { bleManager: null };
  }

  if (!bleManager) {
    try {
      bleManager = new BleManager();
    } catch (e) {
      console.warn("BleManager init failed (native module not available):", e);
      initFailed = true;
      return { bleManager: null };
    }
  }

  return { bleManager };
}
