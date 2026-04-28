import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getMessagesWithPeer, saveMessage } from "../src/chat/msg/chatStore";
import { useBleConnections } from "../src/connection/BleConnectionContext";
import { useAppSettings } from "../src/core/AppSettingsContext";
import { supabase } from "../src/storage/supabase";
import type { MeshPacket } from "../src/connection/mesh/packet";

function formatTime(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MessageStatus = "sent" | "delivered" | "read";

type Message = {
  id: string;
  chat_id: string;
  sender_device_id: string;
  receiver_device_id: string;
  content: string;
  created_at: string;
  status: MessageStatus;
};

function toMeshPacket(message: Message): MeshPacket<{ text: string }> {
  return {
    id: message.id,
    from: message.sender_device_id,
    to: message.receiver_device_id,
    ttl: 4,
    timestamp: new Date(message.created_at).getTime(),
    type: "TEXT",
    payload: { text: message.content },
  };
}

async function getChatId(deviceA: string, deviceB: string): Promise<string> {
  const [first, second] = [deviceA, deviceB].sort();
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${first}:${second}`
  );
}

export default function ChatRoomScreen() {
  const router = useRouter();
  const { peerId, peerName } = useLocalSearchParams<{
    peerId: string;
    peerName: string;
  }>();
  const { isConnected } = useBleConnections();
  const { settings } = useAppSettings();
  const myId = settings.deviceId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const connectedBLE = peerId ? isConnected(peerId) : false;
  const displayName = peerName || (peerId ? peerId.slice(-8) : "Unknown");

  const loadMessages = useCallback(async () => {
    if (!chatId || !myId || !peerId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load remote messages:", error);
      return;
    }

    const remoteMessages = (data || []) as Message[];
    setMessages(remoteMessages);
    await Promise.all(remoteMessages.map((message) => saveMessage(toMeshPacket(message))));
  }, [chatId, myId, peerId]);

  const ackMessageStatus = useCallback(
    async (message: Message) => {
      if (!myId || message.receiver_device_id !== myId) return;

      const nextStatus: MessageStatus =
        message.status === "sent" ? "delivered" : "read";
      if (message.status === nextStatus) return;

      const { error } = await supabase
        .from("messages")
        .update({ status: nextStatus })
        .eq("id", message.id)
        .eq("status", message.status);

      if (error) {
        console.error("Failed to ACK message:", error);
      }
    },
    [myId]
  );

  const loadLocalMessages = useCallback(async () => {
    if (!peerId || !myId || !chatId) return;

    const localMessages = await getMessagesWithPeer(myId, peerId);
    const formatted = localMessages.map(m => ({
      id: m.id,
      chat_id: chatId,
      sender_device_id: m.from,
      receiver_device_id: m.to,
      content: m.payload?.text || JSON.stringify(m.payload),
      created_at: new Date(m.timestamp).toISOString(),
      status: 'sent' as MessageStatus, // local messages are sent
    }));
    setMessages(formatted);
  }, [myId, peerId, chatId]);

  useEffect(() => {
    if (!peerId || !myId) return;
    let active = true;

    (async () => {
      const id = await getChatId(myId, peerId);
      if (active) setChatId(id);
    })();

    return () => {
      active = false;
    };
  }, [myId, peerId]);

  useEffect(() => {
    if (connectedBLE) {
      loadMessages().catch((error) => {
        console.error("Failed to refresh connected messages:", error);
      });
    }
  }, [connectedBLE, loadMessages]);

  useEffect(() => {
    if (!connectedBLE) {
      loadLocalMessages();
    }
  }, [connectedBLE, loadLocalMessages]);

  useEffect(() => {
    if (!peerId || !myId || !connectedBLE || !chatId) return;

    const channel = supabase
      .channel("messages_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async (payload) => {
          const newMsg = (payload.new || payload.old) as Message;
          if (!newMsg) return;
          if (
            newMsg.chat_id !== chatId
          ) {
            return;
          }

          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            await saveMessage(toMeshPacket(newMsg));

            if (newMsg.receiver_device_id === myId && newMsg.status === "sent") {
              await ackMessageStatus(newMsg);
            }
            return;
          }

          if (payload.eventType === "UPDATE") {
            setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? newMsg : m)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ackMessageStatus, chatId, connectedBLE, myId, peerId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !myId || !peerId || !connectedBLE || !chatId) return;

    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toISOString();
    const localMessage: Message = {
      id: messageId,
      chat_id: chatId,
      sender_device_id: myId,
      receiver_device_id: peerId,
      content: text,
      status: "sent",
      created_at: timestamp,
    };

    setMessages((prev) => [...prev, localMessage]);
    setInput("");
    await saveMessage(toMeshPacket(localMessage));

    const { error } = await supabase.from("messages").insert(localMessage);
    if (error) {
      console.error("Failed to send message", error);
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    }
  };

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

  if (!connectedBLE) {
    return (
      <View style={styles.root}>
        <View style={styles.notConnected}>
          <Text style={styles.notConnectedText}>
            Connecting...
          </Text>
          <Pressable style={styles.backBtnLarge} onPress={goBack}>
            <Text style={styles.backBtnText}>Back to chats</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                { backgroundColor: connectedBLE ? "#22c55e" : "#ef4444" },
              ]}
            />
            <Text style={styles.secureText}>
              {connectedBLE ? "Connected" : "Connecting"}
            </Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </BlurView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length > 0 && (
          <Text style={styles.meta}>{new Date(messages[0].created_at).toLocaleDateString()}</Text>
        )}
        {messages.map((m) => {
          const fromMe = m.sender_device_id === myId;
          const statusText = m.status === "sent" ? "✓" : "✓✓";

          return (
            <View key={m.id} style={[styles.row, fromMe && styles.rowRight]}>
              <View>
                <Text style={[styles.sender, fromMe && styles.alignRight]}>
                  {fromMe ? "You" : displayName}
                </Text>
                <View style={fromMe ? styles.bubbleSent : styles.bubbleReceived}>
                  <Text style={styles.message}>{m.content}</Text>
                </View>
                <View style={[styles.timeRow, fromMe && styles.timeRowRight]}>
                  <Text style={styles.time}>{formatTime(m.created_at)}</Text>
                  {fromMe && <Text style={styles.statusText}>{statusText}</Text>}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <BlurView intensity={30} tint="dark" style={styles.footer}>
        <TextInput
          placeholder="Message..."
          placeholderTextColor="#908dce"
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />

        <Pressable
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={input.trim() ? "#fff" : "#6b7280"}
          />
        </Pressable>
      </BlurView>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === "ios" ? 50 : 16,
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
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  secureText: {
    color: "#d1d5db",
    fontSize: 12,
    fontWeight: "600",
  },
  messages: {
    padding: 16,
    paddingBottom: 100,
  },
  meta: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 12,
    textAlign: "center",
  },
  row: {
    marginBottom: 16,
    flexDirection: "row",
  },
  rowRight: {
    justifyContent: "flex-end",
  },
  sender: {
    color: "#a5b4fc",
    fontSize: 12,
    marginBottom: 6,
  },
  alignRight: {
    textAlign: "right",
  },
  bubbleSent: {
    backgroundColor: "#4f46e5",
    borderRadius: 18,
    padding: 12,
    maxWidth: "80%",
  },
  bubbleReceived: {
    backgroundColor: "#27233f",
    borderRadius: 18,
    padding: 12,
    maxWidth: "80%",
  },
  message: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
  },
  timeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeRowRight: {
    justifyContent: "flex-end",
  },
  time: {
    color: "#9ca3af",
    fontSize: 12,
  },
  statusText: {
    color: "#9ca3af",
    fontSize: 12,
    marginRight: 4,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#fff",
    paddingHorizontal: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#1f2937",
  },
  notConnected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  notConnectedText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 24,
  },
  backBtnLarge: {
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  backBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
