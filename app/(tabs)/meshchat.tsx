import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getConversations,
  type Conversation
} from '../../src/chat/msg/chatStore';
import { useBleConnections } from '../../src/connection/BleConnectionContext';
import { getOrCreateIdentity } from '../../src/core/identity/identity';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = now.toDateString();
  const msgDay = d.toDateString();
  if (msgDay === today) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (now.getTime() - ts < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MeshChatScreen() {
  const router = useRouter();
  const { connectedDevices, canOpenChat, setActivePeer } = useBleConnections();
  const connectedByName = useMemo(
    () => new Map(connectedDevices.map((d) => [d.id, d.name])),
    [connectedDevices],
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const allPeers = useMemo(() => {
    const conversationPeers = new Set(conversations.map(c => c.peerId));
    return [
      ...conversations,
      ...connectedDevices
        .filter(d => !conversationPeers.has(d.id))
        .map(d => ({
          peerId: d.id,
          peerName: d.name,
          lastMessage: "No messages yet",
          lastTime: 0,
          lastFromMe: false,
          chatId: "",
        }))
    ];
  }, [conversations, connectedDevices]);

  const load = useCallback(async () => {
    const identity = await getOrCreateIdentity();
    const list = await getConversations(identity.id);
    setConversations(list);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openChat = useCallback(
    (peerId: string, peerName: string) => {
      if (!canOpenChat(peerId)) {
        return;
      }
      setActivePeer({ peerId, peerName });
      router.push('/chatroom');
    },
    [canOpenChat, router, setActivePeer],
  );

  const peerNameFor = useCallback(
    (peerId: string) => connectedByName.get(peerId) || peerId.slice(-8),
    [connectedByName],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Chat</Text>
        <View style={styles.status}>
          <MaterialIcons name="sensors" size={16} color="#6961ff" />
          <Text style={styles.statusText}>
            {connectedDevices.length} connected
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6961ff" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6961ff"
            />
          }
        >
          {connectedDevices.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons
                name="bluetooth-disabled"
                size={48}
                color="#6961ff"
              />
              <Text style={styles.emptyTitle}>No devices connected</Text>
              <Text style={styles.emptySub}>
                Connect to FortiLink devices from Device Discovery (radar) to chat
                with them here.
              </Text>
              <Pressable
                style={styles.discoverBtn}
                onPress={() => router.push("/(tabs)/radar" as Href)}
              >
                <MaterialIcons name="radar" size={20} color="#fff" />
                <Text style={styles.discoverBtnText}>Discover devices</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {allPeers.map((c) => (
                <ChatItem
                  key={c.peerId}
                  name={peerNameFor(c.peerId)}
                  message={c.lastMessage}
                  time={c.lastTime ? formatTime(c.lastTime) : "-"}
                  onPress={() => openChat(c.peerId, peerNameFor(c.peerId))}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ChatItem({
  name,
  message,
  time,
  onPress,
}: {
  name: string;
  message: string;
  time: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.chatItem} onPress={onPress}>
      <View style={styles.avatar} />

      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>

        <View style={styles.row}>
          <MaterialIcons name="lock" size={14} color="#6961ff" />
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
    paddingTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(105,97,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: "#6961ff",
    fontSize: 11,
    fontWeight: "700",
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },
  discoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#6961ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 24,
  },
  discoverBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(105,97,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  name: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  message: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
    flex: 1,
  },
  time: {
    color: "#7c7d99",
    fontSize: 10,
  },
});
