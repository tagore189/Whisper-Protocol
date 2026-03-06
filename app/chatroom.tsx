import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
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
import { ultrasonicManager } from "../backend/ultrasonic/ultrasonicManager";
import { UltrasonicTransport } from "../backend/ultrasonic/ultrasonicTransport";
import { useBleConnections } from "../contexts/BleConnectionContext";
import { useTransportSettings } from "../contexts/TransportSettingsContext";

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
  const { settings } = useTransportSettings();

  const [messages, setMessages] = useState<MeshPacket[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceCallActive, setVoiceCallActive] = useState(false);
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

  // when ultrasonic transport is enabled we need to listen for incoming
  // packets so that the UI can update with messages from the other side.
  useEffect(() => {
    if (!myId || !peerId) return;
    if (!settings.useUltrasonic) return;

    const transport = new UltrasonicTransport();
    transport.setOnReceive(async (packet) => {
      if (packet.type === "TEXT") {
        // store and show packet only if it involves the current peer
        const other = packet.from === myId ? packet.to : packet.from;
        if (other === peerId) {
          await saveMessage(packet);
          setMessages((prev) => [...prev, packet]);
        }
      }
    });

    // we don't tear down the transport here – it'll be garbage-collected when
    // the screen unmounts.  A real implementation would probably share one
    // transport instance for the whole app.
  }, [settings.useUltrasonic, myId, peerId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !myId || !peerId || sending) return;
    if (!connected) return;

    setInput("");
    setSending(true);

    // pick transport based on settings
    const transport = settings.useUltrasonic
      ? new UltrasonicTransport()
      : new BleTransport();
    const meshRouter = new MeshRouter(myId, transport);
    const packet = meshRouter.createPacket(peerId, "TEXT", { text });

    await saveMessage(packet);
    setMessages((prev) => [...prev, packet]);

    try {
      await transport.sendPacket(packet);
    } catch {
      // best-effort
    }
    setSending(false);
  }, [myId, peerId, connected, settings.useUltrasonic, input, sending]);

  const goBack = useCallback(() => router.back(), [router]);

  const startVoiceCall = useCallback(async () => {
    if (!settings.useUltrasonic) return;
    setVoiceCallActive(true);
    // start transmission and reception
    await ultrasonicManager.startVoiceTransmission();
    await ultrasonicManager.startVoiceReception();
  }, [settings.useUltrasonic]);

  const stopVoiceCall = useCallback(async () => {
    setVoiceCallActive(false);
    await ultrasonicManager.stopVoiceTransmission();
    await ultrasonicManager.stopVoiceReception();
  }, []);

  // set up voice data handler to play received audio
  useEffect(() => {
    const handleVoiceData = async (samples: Float32Array) => {
      // convert samples to WAV and play
      const wav = float32ToWav(samples, 22050);
      const uri = `data:audio/wav;base64,${wav}`;
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    };

    ultrasonicManager.onVoiceData(handleVoiceData);
  }, []);

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

        <View style={styles.headerRight}>
          {settings.useUltrasonic && (
            <Pressable
              style={[styles.voiceBtn, voiceCallActive && styles.voiceBtnActive]}
              onPress={voiceCallActive ? stopVoiceCall : startVoiceCall}
            >
              <MaterialIcons
                name={voiceCallActive ? "call-end" : "call"}
                size={20}
                color={voiceCallActive ? "#ef4444" : "#fff"}
              />
            </Pressable>
          )}
          <MaterialIcons name="more-horiz" size={22} color="#908dce" />
        </View>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtnActive: {
    backgroundColor: "#ef4444",
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

// helper to convert Float32Array to WAV base64
function float32ToWav(input: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + input.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */ writeString(view, 0, "RIFF");
  /* file length */ view.setUint32(4, 36 + input.length * 2, true);
  /* RIFF type */ writeString(view, 8, "WAVE");
  /* format chunk identifier */ writeString(view, 12, "fmt ");
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, 1, true);
  /* channel count */ view.setUint16(22, 1, true);
  /* sample rate */ view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * blockAlign) */ view.setUint32(28, sampleRate * 2, true);
  /* block align (channelCount * bytesPerSample) */ view.setUint16(32, 2, true);
  /* bits per sample */ view.setUint16(34, 16, true);
  /* data chunk identifier */ writeString(view, 36, "data");
  /* data chunk length */ view.setUint32(40, input.length * 2, true);

  // write the PCM samples
  let offset = 44;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  // return base64 string of the WAV file
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
