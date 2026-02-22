import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getBleManager } from "./bleManager";
import { requestBlePermissions } from "./permissions";
import { SERVICE_UUID } from "./types";
import { State } from "react-native-ble-plx";

export type ScannedDevice = {
  id: string;
  name: string;
  rssi: number | null;
};

export function useBleScan() {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<Map<string, ScannedDevice>>(new Map());

  const startScan = useCallback(async () => {
    if (Platform.OS === "web") return;

    const granted = await requestBlePermissions();
    if (!granted) {
      setError("Bluetooth permission denied");
      return;
    }

    const { bleManager } = getBleManager();
    if (!bleManager) return;

    const state = await bleManager.state();
    if (state !== State.PoweredOn) {
      setError("Bluetooth is off");
      return;
    }

    mapRef.current.clear();
    setDevices([]);
    setIsScanning(true);

    bleManager.startDeviceScan([SERVICE_UUID], null, (err, device) => {
      if (err) {
        setError(err.message);
        setIsScanning(false);
        return;
      }

      if (!device) return;

      const entry: ScannedDevice = {
        id: device.id,
        name: device.name || device.localName || `Whisper-${device.id.slice(-4)}`,
        rssi: device.rssi ?? null,
      };

      mapRef.current.set(device.id, entry);
      setDevices([...mapRef.current.values()]);
    });
  }, []);

  const stopScan = useCallback(() => {
    const { bleManager } = getBleManager();
    bleManager?.stopDeviceScan();
    setIsScanning(false);
  }, []);

  useEffect(() => stopScan, [stopScan]);

  return { devices, isScanning, error, startScan, stopScan };
}
