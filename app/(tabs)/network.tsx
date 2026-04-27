import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { supabase } from "../../src/supabase";

type DbUser = {
  id: string;
  device_id: string;
  device_name: string;
};

type ConnectionRequest = {
  id: string;
  sender_device_id: string;
  receiver_device_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  // related user info
  sender?: DbUser;
  receiver?: DbUser;
};

export default function NetworkScreen() {
  const router = useRouter();
  const { settings } = useAppSettings();

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

  // Realtime subscription for requests
  useEffect(() => {
    if (!settings.deviceId) return;
    const channel = supabase
      .channel("network_requests_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        (payload) => {
          // Re-fetch to get nested user objects
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
    let query = supabase.from("users").select("*").neq("device_id", settings.deviceId).limit(50);
    
    if (searchQuery.trim().length > 0) {
      query = query.ilike("device_name", `%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setUsers(data);
    }
    setLoadingUsers(false);
  };

  const fetchRequests = async () => {
    if (!settings.deviceId) return;
    setLoadingRequests(true);
    
    // Fetch requests involving us
    const { data, error } = await supabase
      .from("connection_requests")
      .select("*, sender:users!connection_requests_sender_device_id_fkey(*), receiver:users!connection_requests_receiver_device_id_fkey(*)")
      .or(`sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${settings.deviceId}`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    } else if (error) {
      // Fallback if foreign keys don't have matching alias
      const fallbackQuery = await supabase
        .from("connection_requests")
        .select("*")
        .or(`sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${settings.deviceId}`)
        .order("created_at", { ascending: false });
      
      if (fallbackQuery.data) {
        // manually bind users since fkey alias wasn't explicitly modeled in migration
        const userIds = [
            ...fallbackQuery.data.map(r => r.sender_device_id),
            ...fallbackQuery.data.map(r => r.receiver_device_id)
        ];
        const uniqueIds = Array.from(new Set(userIds));
        const usersResp = await supabase.from("users").select("*").in("device_id", uniqueIds);
        
        const mappedData = fallbackQuery.data.map(req => {
            return {
                ...req,
                sender: usersResp.data?.find(u => u.device_id === req.sender_device_id),
                receiver: usersResp.data?.find(u => u.device_id === req.receiver_device_id)
            };
        });
        setRequests(mappedData);
      }
    }
    setLoadingRequests(false);
  };

  const sendRequest = async (receiverId: string) => {
    const { error } = await supabase.from("connection_requests").insert({
      sender_device_id: settings.deviceId,
      receiver_device_id: receiverId,
      status: "pending",
    });

    if (error) {
      Alert.alert("Error", "Could not send connection request");
    } else {
      Alert.alert("Sent", "Connection request sent!");
      fetchRequests();
    }
  };

  const updateRequestStatus = async (id: string, status: "accepted" | "rejected") => {
    const { error } = await supabase
      .from("connection_requests")
      .update({ status })
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
        <Pressable style={styles.actionBtn} onPress={() => sendRequest(item.device_id)}>
          <Text style={styles.actionBtnText}>Connect</Text>
        </Pressable>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: ConnectionRequest }) => {
    const isIncoming = item.receiver_device_id === settings.deviceId;
    const peer = isIncoming ? item.sender : item.receiver;
    const peerName = peer?.device_name || (isIncoming ? item.sender_device_id : item.receiver_device_id).substring(0, 8) + "...";

    return (
      <View style={styles.card}>
        <View style={styles.avatar}>
          <MaterialIcons name={isIncoming ? "call-received" : "call-made"} size={20} color="#6961ff" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{peerName}</Text>
          <Text style={styles.cardSubtitle}>
            {isIncoming ? "Incoming Request" : "Sent Request"} • {item.status.toUpperCase()}
          </Text>
        </View>

        {isIncoming && item.status === "pending" && (
          <View style={styles.btnRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: "rgba(248,113,113,0.15)" }]} onPress={() => updateRequestStatus(item.id, "rejected")}>
              <MaterialIcons name="close" size={18} color="#f87171" />
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: "rgba(34,197,94,0.15)", marginLeft: 6 }]} onPress={() => updateRequestStatus(item.id, "accepted")}>
              <MaterialIcons name="check" size={18} color="#22c55e" />
            </Pressable>
          </View>
        )}
        
        {item.status === "accepted" && (
           <Pressable style={[styles.actionBtn, { backgroundColor: "rgba(105,97,255,0.15)" }]} onPress={() => router.push(`/chatroom?peerId=${encodeURIComponent(isIncoming ? item.sender_device_id : item.receiver_device_id)}`)}>
             <MaterialIcons name="chat" size={18} color="#6961ff" />
           </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Global Network</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tabBtn, activeTab === "discover" && styles.tabBtnActive]} 
          onPress={() => setActiveTab("discover")}
        >
          <Text style={[styles.tabText, activeTab === "discover" && styles.tabTextActive]}>Discover</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabBtn, activeTab === "requests" && styles.tabBtnActive]} 
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>Requests</Text>
        </Pressable>
      </View>

      {/* Discover Content */}
      {activeTab === "discover" && (
        <View style={styles.content}>
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

      {/* Requests Content */}
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
