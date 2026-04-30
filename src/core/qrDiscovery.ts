import * as Crypto from "expo-crypto";

export const QR_DISCOVERY_EXPIRATION_MS = 5 * 60 * 1000;
const QR_DISCOVERY_TYPE = "fortilink.discovery";
const QR_DISCOVERY_VERSION = 1;

export type QrDiscoveryPayload = {
  type: typeof QR_DISCOVERY_TYPE;
  version: typeof QR_DISCOVERY_VERSION;
  deviceId: string;
  deviceName: string;
  /** BLE advertised peripheral name — used by scanner to match the exact device */
  advertisedName: string;
  serviceUUID: string;
  sessionToken: string;
  timestamp: number;
};

export type QrValidationResult =
  | { ok: true; payload: QrDiscoveryPayload }
  | { ok: false; reason: "invalid" | "self" | "expired"; message: string };

export function createQrDiscoveryPayload(
  deviceId: string,
  deviceName: string,
  serviceUUID: string,
  advertisedName: string
): QrDiscoveryPayload {
  return {
    type: QR_DISCOVERY_TYPE,
    version: QR_DISCOVERY_VERSION,
    deviceId,
    deviceName,
    advertisedName,
    serviceUUID,
    sessionToken: Crypto.randomUUID(),
    timestamp: Date.now(),
  };
}

export function encodeQrDiscoveryPayload(payload: QrDiscoveryPayload): string {
  return JSON.stringify(payload);
}

export function parseQrDiscoveryPayload(raw: string): QrDiscoveryPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QrDiscoveryPayload>;
    if (
      parsed?.type !== QR_DISCOVERY_TYPE ||
      parsed?.version !== QR_DISCOVERY_VERSION ||
      typeof parsed.deviceId !== "string" ||
      parsed.deviceId.trim().length === 0 ||
      typeof parsed.deviceName !== "string" ||
      parsed.deviceName.trim().length === 0 ||
      typeof parsed.advertisedName !== "string" ||
      parsed.advertisedName.trim().length === 0 ||
      typeof parsed.serviceUUID !== "string" ||
      parsed.serviceUUID.trim().length === 0 ||
      typeof parsed.sessionToken !== "string" ||
      parsed.sessionToken.trim().length === 0 ||
      typeof parsed.timestamp !== "number" ||
      !Number.isFinite(parsed.timestamp)
    ) {
      return null;
    }

    return {
      type: QR_DISCOVERY_TYPE,
      version: QR_DISCOVERY_VERSION,
      deviceId: parsed.deviceId.trim(),
      deviceName: parsed.deviceName.trim(),
      advertisedName: parsed.advertisedName.trim(),
      serviceUUID: parsed.serviceUUID.trim(),
      sessionToken: parsed.sessionToken.trim(),
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function validateQrDiscoveryPayload(
  payload: QrDiscoveryPayload | null,
  currentDeviceId: string,
  now = Date.now()
): QrValidationResult {
  if (!payload) {
    return {
      ok: false,
      reason: "invalid",
      message: "That QR code is not a valid FortiLink discovery code.",
    };
  }

  if (payload.deviceId === currentDeviceId) {
    return {
      ok: false,
      reason: "self",
      message: "You scanned your own device QR code.",
    };
  }

  if (now - payload.timestamp > QR_DISCOVERY_EXPIRATION_MS) {
    return {
      ok: false,
      reason: "expired",
      message: "That QR code has expired. Ask the other device to refresh it.",
    };
  }

  return { ok: true, payload };
}

export function getQrDiscoverySignature(payload: QrDiscoveryPayload): string {
  return `${payload.deviceId}:${payload.sessionToken}:${payload.timestamp}`;
}
