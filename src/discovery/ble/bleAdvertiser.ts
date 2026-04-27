import { Platform } from "react-native";

/**
 * Advertising is intentionally disabled.
 * Reason:
 * - react-native-ble-advertiser is NOT Expo-compatible
 * - BLE scanning works without advertising
 * - Keeps app stable on Android physical devices
 */

export type AdvertiserState =
  | "unsupported"
  | "idle"
  | "advertising"
  | "error";

let state: AdvertiserState = "unsupported";
let lastError: string | null =
  "BLE advertising disabled (Expo-compatible build)";

export function getAdvertiserState(): AdvertiserState {
  return state;
}

export function getAdvertiserError(): string | null {
  return lastError;
}

export async function startWhisperAdvertising(): Promise<boolean> {
  state = "unsupported";
  lastError =
    Platform.OS === "web"
      ? "Bluetooth not available on web"
      : "BLE advertising disabled to support Expo";
  return false;
}

export async function stopWhisperAdvertising(): Promise<void> {
  state = "unsupported";
}

export function isAdvertiserAvailable(): boolean {
  return false;
}
