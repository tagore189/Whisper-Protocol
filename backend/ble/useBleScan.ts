import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getBleManager } from "./bleManager";
import { requestBlePermissions } from "./permissions";

export type ScannedDevice = {
  id: string;
  name: string;
  rssi: number | null;
  lastSeen: number; // timestamp ms
};

const STALE_TIMEOUT_MS = 10_000; // remove devices not seen for 10s
const CLEANUP_INTERVAL_MS = 3_000; // check for stale devices every 3s

export function useBleScan() {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<Map<string, ScannedDevice>>(new Map());
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodic cleanup of stale devices
  const startCleanupTimer = useCallback(() => {
    if (cleanupTimerRef.current) return;
    cleanupTimerRef.current = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, device] of mapRef.current) {
        if (now - device.lastSeen > STALE_TIMEOUT_MS) {
          mapRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        setDevices([...mapRef.current.values()]);
      }
    }, CLEANUP_INTERVAL_MS);
  }, []);

  const stopCleanupTimer = useCallback(() => {
    if (cleanupTimerRef.current) {
      clearInterval(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
  }, []);

  const startScan = useCallback(async () => {
    if (Platform.OS === "web") {
      setError("Bluetooth not available on web");
      return;
    }

    const granted = await requestBlePermissions();
    if (!granted) {
      setError("Bluetooth permission denied");
      return;
    }

    const { bleManager } = getBleManager();
    if (!bleManager) {
      setError("BLE not available (requires a development build, not Expo Go)");
      return;
    }

    try {
      const bleState = await bleManager.state();
      if (bleState !== "PoweredOn") {
        setError("Bluetooth is off — please enable it");
        return;
      }
    } catch (e) {
      setError("Could not check Bluetooth state");
      return;
    }

    // Clear previous results
    mapRef.current.clear();
    setDevices([]);
    setError(null);
    setIsScanning(true);

    // Start stale-device cleanup
    startCleanupTimer();

    // Scan for ALL devices (null = no UUID filter), allow duplicates for live RSSI
    try {
      bleManager.startDeviceScan(null, { allowDuplicates: true }, (err, device) => {
        if (err) {
          setError(err.message);
          setIsScanning(false);
          stopCleanupTimer();
          return;
        }

        if (!device) return;

        const entry: ScannedDevice = {
          id: device.id,
          name: device.name || device.localName || `Device-${device.id.slice(-4)}`,
          rssi: device.rssi ?? null,
          lastSeen: Date.now(),
        };

        mapRef.current.set(device.id, entry);
        setDevices([...mapRef.current.values()]);
      });
    } catch (e: any) {
      setError(e?.message || "Failed to start BLE scan");
      setIsScanning(false);
      stopCleanupTimer();
    }
  }, [startCleanupTimer, stopCleanupTimer]);

  const stopScan = useCallback(() => {
    try {
      const { bleManager } = getBleManager();
      bleManager?.stopDeviceScan();
    } catch {
      // Ignore — native module may not be available
    }
    setIsScanning(false);
    stopCleanupTimer();
  }, [stopCleanupTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        const { bleManager } = getBleManager();
        bleManager?.stopDeviceScan();
      } catch {
        // Ignore
      }
      stopCleanupTimer();
    };
  }, [stopCleanupTimer]);

  return { devices, isScanning, error, startScan, stopScan };
}
