import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getOrCreateIdentity } from '../src/backend/identity/identity';
import { initializeMessageStore, messageStore } from '../src/backend/mesh/messageStore';

export default function ChatRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const peerId = typeof params.peerId === 'string' ? params.peerId : '';
  const [myId, setMyId] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');

  const loadMessages = useCallback(
    (targetPeerId) => {
      if (!targetPeerId) {
        setMessages([]);
        return;
      }
      const threadMessages = messageStore.getMessages(targetPeerId);
      setMessages([...threadMessages].sort((a, b) => a.timestamp - b.timestamp));
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    let unsubscribe = null;

    const initialize = async () => {
      try {
        const identity = await getOrCreateIdentity();
        await initializeMessageStore();
        if (!mounted) {
          return;
        }
        setMyId(identity.nodeId);
        loadMessages(peerId);

        unsubscribe = messageStore.subscribe(() => {
          loadMessages(peerId);
        });
      } catch (initError) {
        console.error('Failed to initialize chat room:', initError);
        setError('Unable to load this chat.');
      }
    };

    initialize().catch((initError) => {
      console.error('Chat room init error:', initError);
      setError('Unable to open chat.');
    });

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadMessages, peerId]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !peerId || !myId) {
      return;
    }

    try {
      await messageStore.addMessage(myId, peerId, text);
      setDraft('');
      setError('');
      loadMessages(peerId);
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
      setError('Sending failed. Try again.');
    }
  }, [draft, loadMessages, myId, peerId]);

  const title = useMemo(() => {
    if (!peerId) {
      return 'Unknown Peer';
    }
    if (peerId.length <= 18) {
      return peerId;
    }
    return `${peerId.slice(0, 10)}...${peerId.slice(-6)}`;
  }, [peerId]);

  return (
    <View style={styles.root}>
      <BlurView intensity={30} tint="dark" style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back-ios" size={18} color="#fff" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.secureRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.secureText}>MESH SECURED</Text>
          </View>
        </View>

        <MaterialIcons name="chat" size={20} color="#908dce" />
      </BlurView>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <Text style={styles.meta}>Conversation: {peerId || 'N/A'}</Text>

        {messages.map((item) => {
          const mine = item.from === myId;
          return (
            <View key={item.id} style={[styles.row, mine && styles.rowRight]}>
              <View style={[mine ? styles.bubbleSent : styles.bubbleReceived]}>
                <Text style={styles.message}>{String(item.payload)}</Text>
              </View>
            </View>
          );
        })}

        {!messages.length ? (
          <Text style={styles.emptyHint}>No messages yet. Send the first message.</Text>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BlurView intensity={30} tint="dark" style={styles.footer}>
        <TextInput
          placeholder="Message via mesh..."
          placeholderTextColor="#908dce"
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
        />

        <Pressable style={styles.sendBtn} onPress={sendMessage}>
          <MaterialCommunityIcons name="send" size={20} color="#fff" />
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#100f23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconBtn: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secureText: {
    fontSize: 10,
    color: '#908dce',
    letterSpacing: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  messages: {
    padding: 16,
    gap: 10,
  },
  meta: {
    textAlign: 'center',
    color: '#908dce',
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubbleReceived: {
    backgroundColor: '#22204b',
    padding: 12,
    borderRadius: 16,
    maxWidth: '82%',
  },
  bubbleSent: {
    backgroundColor: '#6961ff',
    padding: 12,
    borderRadius: 16,
    maxWidth: '82%',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  emptyHint: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#fca5a5',
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#22204b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6961ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
