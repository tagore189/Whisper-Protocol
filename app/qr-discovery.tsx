import { MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useBleConnections } from "../src/connection/BleConnectionContext";
import { useAppSettings } from "../src/core/AppSettingsContext";
import {
  createQrDiscoveryPayload,
  encodeQrDiscoveryPayload,
  getQrDiscoverySignature,
  parseQrDiscoveryPayload,
  QR_DISCOVERY_EXPIRATION_MS,
  validateQrDiscoveryPayload,
} from "../src/core/qrDiscovery";
import { SERVICE_UUID } from "../src/connection/ble/bleTransport";

type ScreenMode = "show" | "scan";

const SCAN_DUPLICATE_COOLDOWN_MS = 2500;
const SCAN_EVENT_THROTTLE_MS = 350;

function getScreenMode(modeParam: string | string[] | undefined): ScreenMode {
  return modeParam === "scan" ? "scan" : "show";
}

export default function QrDiscoveryScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const screenMode = getScreenMode(mode);
  const { settings } = useAppSettings();
  const { connectDirectlySkipHandshake } = useBleConnections();
  const [permission, requestPermission] = useCameraPermissions();
  const [isHandlingScan, setIsHandlingScan] = useState(false);

  // QR payload uses the stable SERVICE_UUID so the scanner can find us via BLE scan
  const [qrPayload, setQrPayload] = useState(() =>
    createQrDiscoveryPayload(settings.deviceId, settings.deviceName, SERVICE_UUID)
  );
  const [refreshTick, setRefreshTick] = useState(Date.now());
  const lastScanRef = useRef<{ signature: string; scannedAt: number } | null>(null);
  const lastScanAttemptRef = useRef(0);
  const resetScanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!settings.deviceId) return;
    setQrPayload(createQrDiscoveryPayload(settings.deviceId, settings.deviceName, SERVICE_UUID));
  }, [settings.deviceId, settings.deviceName]);

  useEffect(() => {
    if (screenMode !== "show") {
      return;
    }

    const interval = setInterval(() => {
      setRefreshTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [screenMode]);

  useEffect(() => {
    if (screenMode === "show" && refreshTick - qrPayload.timestamp >= QR_DISCOVERY_EXPIRATION_MS) {
      setQrPayload(createQrDiscoveryPayload(settings.deviceId, settings.deviceName, SERVICE_UUID));
    }
  }, [qrPayload.timestamp, refreshTick, screenMode, settings.deviceId, settings.deviceName]);

  useEffect(
    () => () => {
      if (resetScanTimeoutRef.current) {
        clearTimeout(resetScanTimeoutRef.current);
        resetScanTimeoutRef.current = null;
      }
    },
    []
  );

  const regenerateQrCode = () => {
    setQrPayload(createQrDiscoveryPayload(settings.deviceId, settings.deviceName, SERVICE_UUID));
    setRefreshTick(Date.now());
  };

  const releaseScanLock = useCallback((delayMs: number) => {
    if (resetScanTimeoutRef.current) {
      clearTimeout(resetScanTimeoutRef.current);
    }
    resetScanTimeoutRef.current = setTimeout(() => {
      setIsHandlingScan(false);
      resetScanTimeoutRef.current = null;
    }, delayMs);
  }, []);

  const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (isHandlingScan) {
      return;
    }

    const now = Date.now();
    if (now - lastScanAttemptRef.current < SCAN_EVENT_THROTTLE_MS) {
      return;
    }
    lastScanAttemptRef.current = now;

    const parsed = parseQrDiscoveryPayload(data);
    const validation = validateQrDiscoveryPayload(parsed, settings.deviceId);
    if (!validation.ok) {
      Alert.alert("Scan rejected", validation.message);
      setIsHandlingScan(true);
      releaseScanLock(1200);
      return;
    }

    const signature = getQrDiscoverySignature(validation.payload);
    if (
      lastScanRef.current &&
      lastScanRef.current.signature === signature &&
      now - lastScanRef.current.scannedAt < SCAN_DUPLICATE_COOLDOWN_MS
    ) {
      return;
    }

    lastScanRef.current = { signature, scannedAt: now };
    setIsHandlingScan(true);

    try {
      await connectDirectlySkipHandshake({
        id: validation.payload.deviceId,
        name: validation.payload.deviceName,
        serviceUUID: validation.payload.serviceUUID,
        sessionToken: validation.payload.sessionToken,
        timestamp: validation.payload.timestamp,
      });

      // Navigate to chatroom after successful connection
      router.push(
        (`/chatroom?peerId=${encodeURIComponent(validation.payload.deviceId)}&peerName=${encodeURIComponent(validation.payload.deviceName)}` as Href),
      );
    } catch (error: any) {
      const msg =
        error?.message?.includes('not found') || error?.message?.includes('timeout')
          ? 'Device not found. Make sure the other phone is showing QR and Bluetooth is on.'
          : error?.message || 'Could not connect to the device. Please try again.';
      Alert.alert('Connection failed', msg);
      releaseScanLock(400);
    }
  }, [connectDirectlySkipHandshake, isHandlingScan, releaseScanLock, router, settings.deviceId]);

  const expiresInMs = Math.max(0, QR_DISCOVERY_EXPIRATION_MS - (refreshTick - qrPayload.timestamp));
  const secondsRemaining = Math.ceil(expiresInMs / 1000);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>QR Discovery</Text>
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segmentBtn, screenMode === "show" && styles.segmentBtnActive]}
          onPress={() => router.replace("/qr-discovery?mode=show" as Href)}
        >
          <Text style={[styles.segmentText, screenMode === "show" && styles.segmentTextActive]}>
            Show QR
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, screenMode === "scan" && styles.segmentBtnActive]}
          onPress={() => router.replace("/qr-discovery?mode=scan" as Href)}
        >
          <Text style={[styles.segmentText, screenMode === "scan" && styles.segmentTextActive]}>
            Scan QR
          </Text>
        </Pressable>
      </View>

      {screenMode === "show" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Share this code with the other device</Text>
          <Text style={styles.subtitle}>The QR contains your device identity and a short-lived session token.</Text>

          <View style={styles.qrCard}>
            <QRCode
              value={encodeQrDiscoveryPayload(qrPayload)}
              size={240}
              backgroundColor="#ffffff"
              color="#111827"
            />
          </View>

          <View style={styles.infoCard}>
            <InfoRow label="Device name" value={settings.deviceName} />
            <InfoRow label="Device ID" value={settings.deviceId} />
            <InfoRow label="Session token" value={qrPayload.sessionToken} />
            <InfoRow label="Expires in" value={`${secondsRemaining}s`} />
          </View>

          <Pressable style={styles.primaryBtn} onPress={regenerateQrCode}>
            <MaterialIcons name="refresh" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Refresh QR</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.scanWrap}>
          {Platform.OS === "web" ? (
            <View style={styles.centerCard}>
              <MaterialIcons name="qr-code-scanner" size={40} color="#6961ff" />
              <Text style={styles.centerTitle}>Camera scanning is device-only</Text>
              <Text style={styles.centerBody}>Open this screen on Android or iPhone to scan a FortiLink device QR code.</Text>
            </View>
          ) : !permission ? (
            <View style={styles.centerCard}>
              <ActivityIndicator color="#6961ff" />
              <Text style={styles.centerBody}>Checking camera permission...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.centerCard}>
              <MaterialIcons name="camera-alt" size={40} color="#6961ff" />
              <Text style={styles.centerTitle}>Camera access required</Text>
              <Text style={styles.centerBody}>FortiLink needs camera access to scan another device&apos;s discovery QR code.</Text>
              <Pressable style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Allow Camera</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.cameraFrame}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleBarcodeScanned}
                  active={!isHandlingScan}
                />
                <View pointerEvents="none" style={styles.scanOverlay}>
                  <View style={styles.scanWindow} />
                </View>
              </View>
              <View style={styles.scanPanel}>
                <Text style={styles.centerTitle}>Point the camera at the other device</Text>
                <Text style={styles.centerBody}>Self-scans are blocked, expired codes are rejected, and duplicate scan events are ignored.</Text>
                {isHandlingScan && (
                  <View style={styles.processingRow}>
                    <ActivityIndicator size="small" color="#6961ff" />
                    <Text style={styles.processingText}>Processing scan...</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  iconSpacer: {
    width: 40,
  },
  topTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  segmentBtnActive: {
    backgroundColor: "rgba(105,97,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.45)",
  },
  segmentText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#fff",
  },
  content: {
    padding: 20,
    alignItems: "center",
    gap: 18,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  qrCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#1a1935",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    color: "#fff",
    fontSize: 14,
  },
  primaryBtn: {
    minWidth: 180,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#6961ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  scanWrap: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  cameraFrame: {
    flex: 1,
    minHeight: 360,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0b1020",
  },
  scanOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,10,20,0.22)",
  },
  scanWindow: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "transparent",
  },
  scanPanel: {
    backgroundColor: "#1a1935",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 8,
  },
  centerCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  centerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  centerBody: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  processingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  processingText: {
    color: "#c7d2fe",
    fontSize: 13,
  },
});
