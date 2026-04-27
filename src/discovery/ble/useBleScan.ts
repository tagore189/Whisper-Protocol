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
const SCAN_DURATION_MS = 5_000; // scan for 5 seconds
const PAUSE_DURATION_MS = 9_000; // pause for 9 seconds between scans

export function useBleScan() {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<Map<string, ScannedDevice>>(new Map());
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const performScanCycle = useCallback(async () => {
    const { bleManager } = getBleManager();
    if (!bleManager) return;

    try {
      // Start scanning
      bleManager.startDeviceScan(null, { allowDuplicates: true }, (err, device) => {
        if (err) {
          setError(err.message);
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

      // Stop scanning after SCAN_DURATION_MS
      scanTimerRef.current = setTimeout(() => {
        try {
          bleManager.stopDeviceScan();
        } catch {
          // Ignore
        }

        // Schedule next scan cycle after PAUSE_DURATION_MS
        pauseTimerRef.current = setTimeout(() => {
          performScanCycle();
        }, PAUSE_DURATION_MS);
      }, SCAN_DURATION_MS);
    } catch (e: any) {
      setError(e?.message || "Failed to start BLE scan");
    }
  }, []);

  const startPeriodicScan = useCallback(async () => {
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

    // Start the first scan cycle
    performScanCycle();
  }, [startCleanupTimer, performScanCycle]);

  const stopScan = useCallback(() => {
    try {
      const { bleManager } = getBleManager();
      bleManager?.stopDeviceScan();
    } catch {
      // Ignore — native module may not be available
    }
    
    // Clear timers
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
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
      
      // Clear timers
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
      
      stopCleanupTimer();
    };
  }, [stopCleanupTimer]);

  return { devices, isScanning, error, startScan: startPeriodicScan, stopScan };
}
