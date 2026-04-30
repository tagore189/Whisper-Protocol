import { useCallback, useEffect, useState } from "react";
import { startGattServer } from "../../connection/ble/bleTransport";
import { useAppSettings } from "../../core/AppSettingsContext";

export type AdvertiserState =
  | "unsupported"
  | "idle"
  | "advertising"
  | "error";

export function useWhisperAdvertising(options?: { autoStart?: boolean }) {
  const autoStart = options?.autoStart ?? true;
  const { settings } = useAppSettings();
  const [state, setState] = useState<AdvertiserState>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    setState("advertising");
    if (!settings?.deviceId) {
        return false;
    }
    const advertisedName = `FortiLink-${settings.deviceName || settings.deviceId.slice(-4)}`;
    const ok = await startGattServer(advertisedName);
    if (!ok) {
        setState("error");
        setError("Failed to start GATT server");
    }
    return ok;
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    // Stop logic if implemented in bleTransport
    setState("idle");
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    start();
  }, [autoStart, start]);

  return {
    state,
    error,
    available: true,
    start,
    stop,
  };
}
