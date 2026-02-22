import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Device } from "react-native-ble-plx";
import { bleService } from "../../backend/ble/bleService";

const { width } = Dimensions.get("window");

/* ---------- Helpers ---------- */

function rssiToSignal(rssi: number | null): "Strong" | "Medium" | "Weak" {
  if (rssi == null) return "Medium";
  if (rssi >= -60) return "Strong";
  if (rssi >= -75) return "Medium";
  return "Weak";
}

function rssiToDistance(rssi: number | null): string {
  if (rssi == null) return "—";
  const d = Math.max(
    0.1,
    Math.round(10 * Math.pow(10, (rssi + 50) / -50)) / 10,
  );
  return d < 1 ? `${d}m` : d <= 99 ? `${Math.round(d)}m` : "99m+";
}

/* ---------- Screen ---------- */

export default function DeviceDiscoveryScreen() {
  const router = useRouter();

  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeb = Platform.OS === "web";

  useEffect(() => {
    if (isWeb) return;

    let mounted = true;

    (async () => {
      try {
        await bleService.init();
      } catch (e: any) {
        setError(e.message ?? "Bluetooth permission error");
      }
    })();

    return () => {
      mounted = false;
      bleService.stopScan();
    };
  }, [isWeb]);

  const startScan = useCallback(() => {
    if (isWeb) return;

    setDevices([]);
    setIsScanning(true);
    setError(null);

    bleService.startScan((device) => {
      setDevices((prev) => {
        if (prev.find((d) => d.id === device.id)) return prev;
        return [...prev, device];
      });
    });
  }, [isWeb]);

  const stopScan = useCallback(() => {
    bleService.stopScan();
    setIsScanning(false);
  }, []);

  const handleScanPress = useCallback(() => {
    isScanning ? stopScan() : startScan();
  }, [isScanning, startScan, stopScan]);

  const handleConnect = useCallback(
    async (device: Device) => {
      try {
        await device.connect();
        router.replace("/(tabs)/mesh");
      } catch (e) {
        console.error("Connect failed", e);
      }
    },
    [router],
  );

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <MaterialIcons name="arrow-back-ios" size={20} color="#fff" />
        </Pressable>

        <Text style={styles.topTitle}>Device Discovery</Text>

        <Pressable
          style={[styles.syncBtn, isScanning && styles.syncBtnActive]}
          onPress={handleScanPress}
          disabled={isWeb}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#6961ff" />
          ) : (
            <MaterialIcons name="sync" size={22} color="#6961ff" />
          )}
        </Pressable>
      </View>

      {/* Radar */}
      <View style={styles.radarArea}>
        <View style={styles.radar}>
          <View style={[styles.ring1, isScanning && styles.ringActive]} />
          <View style={[styles.ring2, isScanning && styles.ringActive]} />
          <View style={[styles.ring3, isScanning && styles.ringActive]} />
          <View style={[styles.ring4, isScanning && styles.ringActive]} />

          <View style={styles.core}>
            <MaterialCommunityIcons
              name="access-point"
              size={28}
              color="#fff"
            />
          </View>

          {devices.length > 0 && <View style={styles.ping1} />}
          {devices.length > 1 && <View style={styles.ping2} />}
        </View>

        <View style={styles.radarText}>
          <Text style={styles.radarTitle}>
            {isWeb
              ? "Bluetooth not available on web"
              : isScanning
                ? "Scanning for nearby devices..."
                : "Tap sync to scan"}
          </Text>
          <Text style={styles.radarSub}>
            {devices.length} device{devices.length !== 1 ? "s" : ""} found
          </Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBadge}>
          <MaterialIcons name="error-outline" size={14} color="#f87171" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Bottom Sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Discovered Devices</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{devices.length} FOUND</Text>
          </View>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {devices.length === 0 && !isScanning && !isWeb && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No devices found. Make sure Bluetooth & Location are enabled.
              </Text>
            </View>
          )}

          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              name={device.name || `Device ${device.id.slice(-8)}`}
              distance={rssiToDistance(device.rssi)}
              signal={rssiToSignal(device.rssi)}
              onConnect={() => handleConnect(device)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/* ---------- Device Card ---------- */

function DeviceCard({
  name,
  distance,
  signal,
  onConnect,
}: {
  name: string;
  distance: string;
  signal: string;
  onConnect: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <MaterialIcons name="bluetooth" size={24} color="#6961ff" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>📏 {distance}</Text>
          <Text style={styles.meta}>📶 {signal}</Text>
        </View>
      </View>

      <Pressable style={styles.connectBtn} onPress={onConnect}>
        <Text style={styles.connectText}>Connect</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Styles (UNCHANGED) ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#100f23" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    justifyContent: "space-between",
  },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(105,97,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnActive: { backgroundColor: "rgba(105,97,255,0.3)" },
  ringActive: { borderColor: "rgba(0,245,255,0.25)" },
  radarArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  radar: {
    width: width * 0.7,
    height: width * 0.7,
    alignItems: "center",
    justifyContent: "center",
  },
  ring1: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(0,245,255,0.1)",
  },
  ring2: {
    position: "absolute",
    width: "80%",
    height: "80%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.1)",
  },
  ring3: {
    position: "absolute",
    width: "60%",
    height: "60%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.1)",
  },
  ring4: {
    position: "absolute",
    width: "40%",
    height: "40%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.1)",
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
  },
  ping1: {
    position: "absolute",
    top: 30,
    right: 50,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00f5ff",
  },
  ping2: {
    position: "absolute",
    bottom: 40,
    left: 40,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00f5ff",
  },
  radarText: { marginTop: 32, alignItems: "center" },
  radarTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  radarSub: { fontSize: 14, color: "#9ca3af", marginTop: 4 },
  errorBadge: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.15)",
  },
  errorText: { fontSize: 12, color: "#f87171" },
  sheet: {
    maxHeight: "50%",
    backgroundColor: "#1a1a2e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4b5563",
    marginVertical: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  countBadge: {
    backgroundColor: "rgba(105,97,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: { color: "#6961ff", fontSize: 10, fontWeight: "700" },
  list: { paddingHorizontal: 12 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: "#9ca3af", fontSize: 14 },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(105,97,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: "#fff", fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  meta: { fontSize: 12, color: "#9ca3af" },
  connectBtn: {
    backgroundColor: "#6961ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  connectText: { color: "#fff", fontSize: 12, fontWeight: "700" },
}); 
