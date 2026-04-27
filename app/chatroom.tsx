import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
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
import { useBleConnections } from '../src/connection/BleConnectionContext';
import { useAppSettings } from '../src/core/AppSettingsContext';
import { supabase } from '../src/storage/supabase';

function formatTime(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Message = {
  id: string;
  sender_device_id: string;
  receiver_device_id: string;
  content: string;
  created_at: string;
  read_at: string | null; 
};

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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const connectedBLE = peerId ? isConnected(peerId) : false;
  const displayName = peerName || (peerId ? peerId.slice(-8) : "Unknown");

  const markAsRead = async (msgs: Message[]) => {
    const unreadIds = msgs.filter(m => m.receiver_device_id === myId && !m.read_at).map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    }
  };

  const loadMessages = useCallback(async () => {
    if (!peerId || !myId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_device_id.eq.${myId},receiver_device_id.eq.${peerId}),and(sender_device_id.eq.${peerId},receiver_device_id.eq.${myId})`)
      .order("created_at", { ascending: true });
    
    if (data) {
      setMessages(data);
      markAsRead(data);
    }
  }, [peerId, myId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!peerId || !myId) return;

    const channel = supabase
      .channel("messages_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            if ((newMsg.sender_device_id === myId && newMsg.receiver_device_id === peerId) ||
                (newMsg.sender_device_id === peerId && newMsg.receiver_device_id === myId)) {
              
              setMessages((prev) => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.receiver_device_id === myId) {
                // mark as read over network
                supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", newMsg.id).then();
              }
            }
          } else if (payload.eventType === "UPDATE") {
             const updated = payload.new as Message;
             setMessages((prev) => prev.map(m => m.id === updated.id ? updated : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [peerId, myId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !myId || !peerId || sending) return;

    setInput("");
    setSending(true);

    const newMsg = {
      sender_device_id: myId,
      receiver_device_id: peerId,
      content: text,
    };

    const { error } = await supabase.from("messages").insert(newMsg);
    if (error) {
       console.error("Failed to send message", error);
    }
    setSending(false);
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
              {connectedBLE ? "BLE CONNECTED" : "BLE NOT CONNECTED"}
            </Text>
          </View>
        </View>
        <View style={{ width: 44 }} />
      </BlurView>

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
            {new Date(messages[0].created_at).toLocaleDateString()}
          </Text>
        )}
        {messages.map((m) => {
          const fromMe = m.sender_device_id === myId;
          const statusText = m.read_at ? "Read" : "Delivered";

          return (
            <View key={m.id} style={[styles.row, fromMe && styles.rowRight]}>
              <View>
                <Text style={[styles.sender, fromMe && styles.alignRight]}>
                  {fromMe ? "You" : displayName}
                </Text>
                <View
                  style={fromMe ? styles.bubbleSent : styles.bubbleReceived}
                >
                  <Text style={styles.message}>{m.content}</Text>
                </View>
                <View style={[styles.timeRow, fromMe && styles.timeRowRight]}>
                  <Text style={styles.time}>{formatTime(m.created_at)}</Text>
                  {fromMe && (
                    <Text style={styles.statusText}>{statusText}</Text>
                  )}
                  {fromMe && (
                    <MaterialIcons
                      name={m.read_at ? "done-all" : "check"}
                      size={14}
                      color={m.read_at ? "#6961ff" : "rgba(255,255,255,0.7)"}
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
          placeholder="Message..."
          placeholderTextColor="#908dce"
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />

        <Pressable
          style={[
            styles.sendBtn,
            (!input.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={input.trim() && !sending ? "#fff" : "#6b7280"}
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
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
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
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopRightRadius: 4,
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
  statusText: {
    fontSize: 10,
    color: "#aaa",
    marginRight: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
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
});
