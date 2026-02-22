<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getOrCreateIdentity } from '../../src/backend/identity/identity';
import { initializeMessageStore, messageStore } from '../../src/backend/mesh/messageStore';

interface ConversationItem {
  peerId: string;
  lastMessage: string;
  lastUpdated: number;
}

function summarizeMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  return '[Encrypted/Structured message]';
=======
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getOrCreateIdentity } from "../../backend/identity/identity";
import {
  getConversations,
  type Conversation,
} from "../../backend/msg/chatStore";
import { useBleConnections } from "../../contexts/BleConnectionContext";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = now.toDateString();
  const msgDay = d.toDateString();
  if (msgDay === today)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - ts < 7 * 24 * 60 * 60 * 1000)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1
}

export default function MeshChatScreen() {
  const router = useRouter();
<<<<<<< HEAD
  const [myId, setMyId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const load = async () => {
      try {
        const identity = await getOrCreateIdentity();
        await initializeMessageStore();
        if (!mounted) {
          return;
        }
        setMyId(identity.nodeId);

        const refresh = () => {
          const items: ConversationItem[] = messageStore.getConversations().map((thread) => {
            const last = thread.messages[thread.messages.length - 1];
            return {
              peerId: thread.peerId,
              lastMessage: last ? summarizeMessage(last.payload) : 'No messages yet',
              lastUpdated: thread.lastUpdated,
            };
          });
          items.sort((a, b) => b.lastUpdated - a.lastUpdated);
          setConversations(items);
        };

        refresh();
        unsubscribe = messageStore.subscribe(() => refresh());
      } catch (loadError) {
        console.error('Failed to load mesh chat:', loadError);
        setError('Could not initialize chat store.');
      }
    };

    load().catch((loadError) => {
      console.error('Mesh chat initialization error:', loadError);
      setError('Failed to initialize mesh chat.');
    });

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const openChatById = useCallback(() => {
    const normalized = targetId.trim();
    if (!normalized) {
      setError('Enter the recipient identity first.');
      return;
    }
    if (normalized === myId) {
      setError('Enter a different identity (cannot chat with yourself).');
      return;
    }

    setError('');
    router.push({ pathname: '/chatroom', params: { peerId: normalized } });
  }, [myId, router, targetId]);

  const shortMyId = useMemo(() => {
    if (!myId) {
      return 'Loading...';
    }
    return `${myId.slice(0, 12)}...${myId.slice(-8)}`;
  }, [myId]);
=======
  const { connectedDevices } = useBleConnections();
  const allowedPeerIds = new Set(connectedDevices.map((d) => d.id));
  const connectedByName = new Map(connectedDevices.map((d) => [d.id, d.name]));

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const identity = await getOrCreateIdentity();
    setMyId(identity.id);
    const allowed = new Set(connectedDevices.map((d) => d.id));
    const list = await getConversations(identity.id, allowed);
    setConversations(list);
  }, [connectedDevices]);

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
      router.push({
        pathname: "/chatroom",
        params: { peerId, peerName },
      });
    },
    [router],
  );

  const peerNameFor = (peerId: string) =>
    connectedByName.get(peerId) || peerId.slice(-8);
>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Chat</Text>
        <View style={styles.status}>
<<<<<<< HEAD
          <MaterialIcons name="lock" size={14} color="#6961ff" />
          <Text style={styles.statusText}>Secure Routes</Text>
        </View>
      </View>

      <View style={styles.identityCard}>
        <Text style={styles.identityLabel}>Your Identity</Text>
        <Text selectable style={styles.identityValue}>
          {shortMyId}
        </Text>
      </View>

      <View style={styles.composeCard}>
        <Text style={styles.composeTitle}>Start Chat by Identity</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste recipient identity"
          placeholderTextColor="#7c7d99"
          value={targetId}
          onChangeText={(text) => {
            setTargetId(text);
            if (error) {
              setError('');
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.startBtn} onPress={openChatById}>
          <Text style={styles.startBtnText}>Open Chat</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <Text style={styles.sectionTitle}>Existing Conversations</Text>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {conversations.map((item) => (
          <Pressable
            key={item.peerId}
            style={styles.chatItem}
            onPress={() => router.push({ pathname: '/chatroom', params: { peerId: item.peerId } })}
          >
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={20} color="#6961ff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.peerId}</Text>
              <Text style={styles.message} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            <Text style={styles.time}>{new Date(item.lastUpdated).toLocaleTimeString()}</Text>
          </Pressable>
        ))}
        {!conversations.length ? (
          <Text style={styles.emptyText}>No conversations yet. Start by entering an identity.</Text>
        ) : null}
      </ScrollView>
=======
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
                Connect to Whisper devices from Device Discovery (radar) to chat
                with them here.
              </Text>
              <Pressable
                style={styles.discoverBtn}
                onPress={() => router.push("/radar")}
              >
                <MaterialIcons name="radar" size={20} color="#fff" />
                <Text style={styles.discoverBtnText}>Discover devices</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {conversations.map((c) => (
                <ChatItem
                  key={c.peerId}
                  name={peerNameFor(c.peerId)}
                  message={c.lastMessage}
                  time={formatTime(c.lastTime)}
                  onPress={() => openChat(c.peerId, peerNameFor(c.peerId))}
                />
              ))}
              {connectedDevices
                .filter((d) => !conversations.some((c) => c.peerId === d.id))
                .map((d) => (
                  <ChatItem
                    key={d.id}
                    name={d.name}
                    message="No messages yet"
                    time="—"
                    onPress={() => openChat(d.id, d.name)}
                  />
                ))}
            </>
          )}
        </ScrollView>
      )}
>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1
    </View>
  );
}

<<<<<<< HEAD
=======
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

>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#100f23',
    paddingTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(105,97,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#6961ff',
    fontSize: 11,
    fontWeight: '700',
  },
  identityCard: {
    margin: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
  },
  identityLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  identityValue: {
    color: '#fff',
    fontSize: 13,
  },
  composeCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
  },
  composeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.15)',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
  },
  startBtn: {
    marginTop: 10,
    backgroundColor: '#6961ff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
<<<<<<< HEAD
=======
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
>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(105,97,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
<<<<<<< HEAD
  time: {
    color: '#7c7d99',
    fontSize: 10,
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
=======
>>>>>>> 3e4de0d81a2f8e59c8e6098113d5edf1e75e77c1
});
