import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeshPacket } from '../mesh/packet';

const KEY = 'CHAT_MESSAGES';

export async function saveMessage(packet: MeshPacket) {
  const raw = await AsyncStorage.getItem(KEY);
  const messages = raw ? JSON.parse(raw) : [];
  messages.push(packet);
  await AsyncStorage.setItem(KEY, JSON.stringify(messages));
}

export async function loadMessages(): Promise<MeshPacket[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export type Conversation = {
  peerId: string;
  peerName: string;
  lastMessage: string;
  lastTime: number;
  lastFromMe: boolean;
};

/** Get conversations for myId, optionally filtered to only include peerIds in allowedPeerIds. */
export async function getConversations(
  myId: string,
  allowedPeerIds?: Set<string>
): Promise<Conversation[]> {
  const messages = await loadMessages();
  const byPeer = new Map<string, { last: MeshPacket; fromMe: boolean }>();

  for (const m of messages) {
    if (m.type !== 'TEXT' || !m.payload?.text) continue;
    const other = m.from === myId ? m.to : m.from;
    if (other === myId) continue;
    if (allowedPeerIds && !allowedPeerIds.has(other)) continue;
    const fromMe = m.from === myId;
    const existing = byPeer.get(other);
    if (!existing || m.timestamp > existing.last.timestamp) {
      byPeer.set(other, { last: m, fromMe });
    }
  }

  return Array.from(byPeer.entries())
    .map(([peerId, { last, fromMe }]) => ({
      peerId,
      peerName: shortId(peerId),
      lastMessage: (last.payload as { text?: string })?.text ?? '',
      lastTime: last.timestamp,
      lastFromMe: fromMe,
    }))
    .sort((a, b) => b.lastTime - a.lastTime);
}

/** Get messages between myId and peerId, sorted by time. */
export async function getMessagesWithPeer(
  myId: string,
  peerId: string
): Promise<MeshPacket[]> {
  const messages = await loadMessages();
  return messages
    .filter(
      (m) =>
        m.type === 'TEXT' &&
        ((m.from === myId && m.to === peerId) || (m.from === peerId && m.to === myId))
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function shortId(id: string): string {
  if (!id || id.length < 8) return id || '?';
  return id.slice(-8);
}
