import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BleTransport } from "../backend/ble/bleTransport";
import { getOrCreateIdentity } from "../backend/identity/identity";
import type { MeshPacket } from "../backend/mesh/packet";
import { MeshRouter } from "../backend/mesh/router";
import { getMessagesWithPeer, saveMessage } from "../backend/msg/chatStore";
import { useBleConnections } from "../contexts/BleConnectionContext";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const { peerId, peerName } = useLocalSearchParams<{
    peerId: string;
    peerName: string;
  }>();
  const { isConnected } = useBleConnections();

  const [messages, setMessages] = useState<MeshPacket[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const connected = peerId ? isConnected(peerId) : false;
  const displayName = peerName || (peerId ? peerId.slice(-8) : "Unknown");

  const load = useCallback(async () => {
    if (!peerId) return;
    const identity = await getOrCreateIdentity();
    setMyId(identity.id);
    const list = await getMessagesWithPeer(identity.id, peerId);
    setMessages(list);
  }, [peerId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !myId || !peerId || sending) return;
    if (!connected) return;

    setInput("");
    setSending(true);

    const transport = new BleTransport();
    const meshRouter = new MeshRouter(myId, transport);
    const packet = meshRouter.createPacket(peerId, "TEXT", { text });

    await saveMessage(packet);
    setMessages((prev) => [...prev, packet]);

    try {
      await transport.sendPacket(packet);
    } catch {
      // Message saved locally; BLE send is best-effort
    }
    setSending(false);
  }, [input, myId, peerId, connected, sending]);

  const goBack = useCallback(() => router.back(), [router]);

  if (!peerId) {
    return (
      <View style={styles.root}>
        <View style={styles.notConnected}>
          <Text style={styles.notConnectedText}>No peer selected</Text>
          <Pressable style={styles.backBtnLarge} onPress={goBack}>
            <Text style={styles.backBtnText}>Back to chats</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <BlurView intensity={30} tint="dark" style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={goBack}>
          <MaterialIcons name="arrow-back-ios" size={18} color="#fff" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>{displayName}</Text>
          <View style={styles.secureRow}>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: connected ? "#22c55e" : "#ef4444" },
              ]}
            />
            <Text style={styles.secureText}>
              {connected ? "CONNECTED" : "NOT CONNECTED"}
            </Text>
          </View>
        </View>

        <MaterialIcons name="more-horiz" size={22} color="#908dce" />
      </BlurView>

      {!connected && (
        <View style={styles.banner}>
          <MaterialIcons name="bluetooth-disabled" size={16} color="#f59e0b" />
          <Text style={styles.bannerText}>
            Device not connected. Reconnect via Device Discovery to send
            messages.
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length > 0 && (
          <Text style={styles.meta}>
            {new Date(messages[0].timestamp).toLocaleDateString()}
          </Text>
        )}
        {messages.map((m) => {
          const fromMe = m.from === myId;
          const payload = m.payload as { text?: string };
          const body = payload?.text ?? "";
          return (
            <View key={m.id} style={[styles.row, fromMe && styles.rowRight]}>
              <View>
                <Text style={[styles.sender, fromMe && styles.alignRight]}>
                  {fromMe ? "You" : displayName}
                </Text>
                <View
                  style={fromMe ? styles.bubbleSent : styles.bubbleReceived}
                >
                  <Text style={styles.message}>{body}</Text>
                </View>
                <View style={[styles.timeRow, fromMe && styles.timeRowRight]}>
                  <Text style={styles.time}>{formatTime(m.timestamp)}</Text>
                  {fromMe && (
                    <MaterialIcons
                      name="done-all"
                      size={14}
                      color="rgba(255,255,255,0.7)"
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <BlurView intensity={30} tint="dark" style={styles.footer}>
        <TextInput
          placeholder="Message via mesh..."
          placeholderTextColor="#908dce"
          style={styles.input}
          value={input}
          onChangeText={setInput}
          editable={connected}
          onSubmitEditing={sendMessage}
        />

        <Pressable
          style={[
            styles.sendBtn,
            (!connected || !input.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!connected || !input.trim() || sending}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={connected && input.trim() && !sending ? "#fff" : "#6b7280"}
          />
        </Pressable>
      </BlurView>

      <View style={styles.proximity}>
        <MaterialCommunityIcons name="bluetooth" size={14} color="#aaa" />
        <Text style={styles.proximityText}>
          {connected ? "BLE connected" : "BLE disconnected"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secureText: {
    fontSize: 10,
    color: "#908dce",
    letterSpacing: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,158,11,0.3)",
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: "#f59e0b",
  },
  notConnected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  notConnectedText: {
    color: "#9ca3af",
    fontSize: 16,
    marginBottom: 16,
  },
  backBtnLarge: {
    backgroundColor: "#6961ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  messages: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  meta: {
    textAlign: "center",
    color: "#908dce",
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  sender: {
    fontSize: 11,
    color: "#908dce",
    marginBottom: 4,
  },
  alignRight: {
    textAlign: "right",
  },
  bubbleReceived: {
    backgroundColor: "#22204b",
    padding: 12,
    borderRadius: 16,
    maxWidth: 260,
  },
  bubbleSent: {
    backgroundColor: "#6961ff",
    padding: 12,
    borderRadius: 16,
    maxWidth: 260,
  },
  message: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  timeRowRight: {
    justifyContent: "flex-end",
  },
  time: {
    fontSize: 10,
    color: "#aaa",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#22204b",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  proximity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    paddingBottom: 8,
    opacity: 0.4,
  },
  proximityText: {
    fontSize: 10,
    color: "#aaa",
  },
});
