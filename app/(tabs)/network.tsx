import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useBleConnections, type ConnectedDevice } from "../../src/connection/BleConnectionContext";
import { useAppSettings } from "../../src/core/AppSettingsContext";

export default function NetworkScreen() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { handshakeDevices, acceptHandshake, canOpenChat, getConnectionState } =
    useBleConnections();

  const renderDevice = ({ item }: { item: ConnectedDevice }) => {
    const peerId = item.id;
    const peerName = item.name;
    const connectionState = item.handshakeState;
    const showChat = canOpenChat(peerId);
    const isIncoming = connectionState === 'HELLO';

    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <MaterialIcons
            name={connectionState === 'CONNECTED' ? "bluetooth-connected" : "bluetooth-searching"}
            size={24}
            color="#6961ff"
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{peerName}</Text>
          <Text style={styles.cardSubtitle}>
            Status: {connectionState}
          </Text>
          <Text style={styles.cardHint}>ID: {peerId.substring(0, 8)}...</Text>
        </View>

        {isIncoming && (
            <Pressable
                style={[styles.actionBtn, { backgroundColor: "rgba(34,197,94,0.15)", marginRight: 8 }]}
                onPress={() => acceptHandshake('local', { id: peerId, name: peerName })}
            >
                <MaterialIcons name="check" size={18} color="#22c55e" />
            </Pressable>
        )}

        {showChat && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: "rgba(105,97,255,0.15)" }]}
            onPress={() =>
              router.push(
                `/chatroom?peerId=${encodeURIComponent(peerId)}&peerName=${encodeURIComponent(peerName)}` as Href
              )
            }
          >
            <MaterialIcons name="chat" size={18} color="#6961ff" />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Local Network</Text>
      </View>

      <View style={styles.discoveryActions}>
        <Pressable
          style={styles.discoveryActionBtn}
          onPress={() => router.push("/qr-discovery?mode=show" as Href)}
        >
          <MaterialIcons name="qr-code-2" size={18} color="#fff" />
          <Text style={styles.discoveryActionText}>Show My QR</Text>
        </Pressable>
        <Pressable
          style={[styles.discoveryActionBtn, styles.discoveryActionBtnAlt]}
          onPress={() => router.push("/qr-discovery?mode=scan" as Href)}
        >
          <MaterialIcons name="qr-code-scanner" size={18} color="#6961ff" />
          <Text style={[styles.discoveryActionText, styles.discoveryActionTextAlt]}>
            Scan QR
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoBox}>
        <MaterialIcons name="info-outline" size={16} color="#9ca3af" />
        <Text style={styles.infoText}>
          Use QR Scan or Radar to connect to nearby devices without internet.
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Connections & Requests</Text>
        <FlatList
          data={handshakeDevices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderDevice}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="bluetooth-disabled" size={48} color="#4b5563" />
              <Text style={styles.emptyText}>No active connections or requests.</Text>
              <Pressable 
                style={styles.radarBtn}
                onPress={() => router.push('/radar' as Href)}
              >
                <Text style={styles.radarBtnText}>Open Radar</Text>
              </Pressable>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#100f23" },
  topBar: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#1a1a2e",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  topTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  discoveryActions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 0,
  },
  discoveryActionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#6961ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  discoveryActionBtnAlt: {
    backgroundColor: "rgba(105,97,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.28)",
  },
  discoveryActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  discoveryActionTextAlt: {
    color: "#6961ff",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(105,97,255,0.05)",
    margin: 16,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  infoText: {
    color: "#9ca3af",
    fontSize: 12,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 16,
    marginTop: 8,
    opacity: 0.6,
  },
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
  cardInfo: {
    flex: 1,
  },
  cardTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cardSubtitle: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  cardHint: { color: "#6961ff", fontSize: 11, marginTop: 4 },
  actionBtn: {
    backgroundColor: "#6961ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    marginTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "center",
  },
  radarBtn: {
    marginTop: 20,
    backgroundColor: "#6961ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  radarBtnText: {
    color: "#fff",
    fontWeight: "700",
  }
});
