import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useBleConnections } from "../../src/connection/BleConnectionContext";
import { useAppSettings } from "../../src/core/AppSettingsContext";
import { supabase } from "../../src/storage/supabase";

type DbUser = {
  id: string;
  device_id: string;
  device_name: string;
};

type ConnectionRequest = {
  id: string;
  sender_device_id: string;
  receiver_device_id: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "hello"
    | "ack"
    | "ready"
    | "connected"
    | "failed";
  created_at: string;
  sender?: DbUser;
  receiver?: DbUser;
};

function formatStatus(status: ConnectionRequest["status"]): string {
  switch (status) {
    case "hello":
      return "HELLO";
    case "ack":
      return "ACK";
    case "ready":
      return "READY";
    case "connected":
      return "CONNECTED";
    case "failed":
      return "FAILED";
    case "accepted":
      return "ACCEPTED";
    case "pending":
      return "PENDING";
    default:
      return "REJECTED";
  }
}

export default function NetworkScreen() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { beginHandshake, acceptHandshake, canOpenChat, getConnectionState } =
    useBleConnections();

  const [activeTab, setActiveTab] = useState<"discover" | "requests">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (activeTab === "discover") {
      fetchUsers();
    } else {
      fetchRequests();
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (!settings.deviceId) return;
    const channel = supabase
      .channel("network_requests_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings.deviceId]);

  const fetchUsers = async () => {
    if (!settings.deviceId) return;
    setLoadingUsers(true);
    let query = supabase
      .from("users")
      .select("*")
      .neq("device_id", settings.deviceId)
      .limit(50);

    if (searchQuery.trim().length > 0) {
      query = query.ilike("device_name", `%${searchQuery}%`);
    }

    const { data } = await query;
    if (data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  const fetchRequests = async () => {
    if (!settings.deviceId) return;
    setLoadingRequests(true);

    const { data, error } = await supabase
      .from("connection_requests")
      .select(
        "*, sender:users!connection_requests_sender_device_id_fkey(*), receiver:users!connection_requests_receiver_device_id_fkey(*)"
      )
      .or(
        `sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${settings.deviceId}`
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    } else if (error) {
      const fallbackQuery = await supabase
        .from("connection_requests")
        .select("*")
        .or(
          `sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${settings.deviceId}`
        )
        .order("created_at", { ascending: false });

      if (fallbackQuery.data) {
        const userIds = [
          ...fallbackQuery.data.map((r) => r.sender_device_id),
          ...fallbackQuery.data.map((r) => r.receiver_device_id),
        ];
        const uniqueIds = Array.from(new Set(userIds));
        const usersResp = await supabase.from("users").select("*").in("device_id", uniqueIds);

        const mappedData = fallbackQuery.data.map((req) => ({
          ...req,
          sender: usersResp.data?.find((u) => u.device_id === req.sender_device_id),
          receiver: usersResp.data?.find((u) => u.device_id === req.receiver_device_id),
        }));
        setRequests(mappedData);
      }
    }
    setLoadingRequests(false);
  };

  const sendRequest = async (receiver: DbUser) => {
    try {
      await beginHandshake({
        id: receiver.device_id,
        name: receiver.device_name || receiver.device_id.slice(-8),
      });
      Alert.alert("HELLO sent", "Waiting for ACK from the other device.");
      fetchRequests();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not send HELLO");
    }
  };

  const rejectRequest = async (id: string) => {
    const { error } = await supabase
      .from("connection_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (error) {
      Alert.alert("Error", "Could not update request");
    } else {
      fetchRequests();
    }
  };

  const renderUser = ({ item }: { item: DbUser }) => {
    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={24} color="#6961ff" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.device_name || "Unknown"}</Text>
          <Text style={styles.cardSubtitle}>ID: {item.device_id.substring(0, 8)}...</Text>
        </View>
        <Pressable style={styles.actionBtn} onPress={() => sendRequest(item)}>
          <Text style={styles.actionBtnText}>HELLO</Text>
        </Pressable>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: ConnectionRequest }) => {
    const isIncoming = item.receiver_device_id === settings.deviceId;
    const peer = isIncoming ? item.sender : item.receiver;
    const peerId = isIncoming ? item.sender_device_id : item.receiver_device_id;
    const peerName = peer?.device_name || `${peerId.substring(0, 8)}...`;
    const connectionState = getConnectionState(peerId);
    const showAccept = isIncoming && (item.status === "hello" || item.status === "pending");
    const showChat = canOpenChat(peerId) || item.status === "connected";

    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <MaterialIcons
            name={isIncoming ? "call-received" : "call-made"}
            size={20}
            color="#6961ff"
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{peerName}</Text>
          <Text style={styles.cardSubtitle}>
            {isIncoming ? "Incoming Request" : "Sent Request"} • {formatStatus(item.status)}
          </Text>
          <Text style={styles.cardHint}>Local handshake: {connectionState}</Text>
        </View>

        {showAccept && (
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "rgba(248,113,113,0.15)" }]}
              onPress={() => rejectRequest(item.id)}
            >
              <MaterialIcons name="close" size={18} color="#f87171" />
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: "rgba(34,197,94,0.15)", marginLeft: 6 },
              ]}
              onPress={() =>
                acceptHandshake(item.id, {
                  id: peerId,
                  name: peerName,
                }).then(fetchRequests).catch((error: any) => {
                  Alert.alert("Error", error?.message || "Could not send ACK");
                })
              }
            >
              <MaterialIcons name="check" size={18} color="#22c55e" />
            </Pressable>
          </View>
        )}

        {!showAccept && showChat && (
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
        <Text style={styles.topTitle}>Global Network</Text>
      </View>

      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tabBtn, activeTab === "discover" && styles.tabBtnActive]}
          onPress={() => setActiveTab("discover")}
        >
          <Text style={[styles.tabText, activeTab === "discover" && styles.tabTextActive]}>
            Discover
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "requests" && styles.tabBtnActive]}
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>
            Requests
          </Text>
        </Pressable>
      </View>

      {activeTab === "discover" && (
        <View style={styles.content}>
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

          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by device name..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingUsers ? (
            <ActivityIndicator size="large" color="#6961ff" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderUser}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialIcons name="people-outline" size={48} color="#4b5563" />
                  <Text style={styles.emptyText}>No users found. Try another search.</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {activeTab === "requests" && (
        <View style={styles.content}>
          {loadingRequests ? (
            <ActivityIndicator size="large" color="#6961ff" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderRequest}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <MaterialIcons name="inbox" size={48} color="#4b5563" />
                  <Text style={styles.emptyText}>No connection requests.</Text>
                </View>
              }
            />
          )}
        </View>
      )}
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
  tabContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabBtnActive: {
    backgroundColor: "rgba(105,97,255,0.15)",
  },
  tabText: {
    color: "#9ca3af",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#6961ff",
  },
  content: {
    flex: 1,
  },
  discoveryActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: "#fff",
    fontSize: 16,
  },
  empty: {
    marginTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9ca3af",
    marginTop: 12,
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
  cardHint: { color: "#6961ff", fontSize: 12, marginTop: 4 },
  btnRow: {
    flexDirection: "row",
  },
  actionBtn: {
    backgroundColor: "#6961ff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
