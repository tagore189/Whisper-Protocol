import { MeshPacket, type PacketType } from '../../connection/mesh/packet';
import { localDatabase, type MessageRecord } from '../../storage/localDatabase';

export type Conversation = {
  peerId: string;
  peerName: string;
  lastMessage: string;
  lastTime: number;
  lastFromMe: boolean;
  chatId: string;
};

export async function saveMessage(packet: MeshPacket) {
  const chatId = await localDatabase.getChatId(packet.from, packet.to);
  const content = packet.payload?.text ?? '';

  const message: MessageRecord = {
    id: packet.id,
    chatId,
    sender: packet.from,
    receiver: packet.to,
    timestamp: packet.timestamp,
    payload: packet.payload,
    content,
    type: packet.type,
    status: 'sent',
  };

  // Check if message already exists
  const existingMessage = await localDatabase.getMessage(packet.id);
  if (existingMessage) {
    console.log(`Duplicate message received with ID ${packet.id}. Ignoring.`);
    return;
  }

  await Promise.all([
    localDatabase.saveMessage(message),
    localDatabase.upsertDevice({ id: packet.from }),
    localDatabase.upsertDevice({ id: packet.to }),
  ]);
}

export async function loadMessages(): Promise<MeshPacket[]> {
  const messages = await localDatabase.getMessages();
  return messages.map((message) => ({
    id: message.id,
    from: message.sender,
    to: message.receiver,
    ttl: 4,
    timestamp: message.timestamp,
    type: (message.type as PacketType | undefined) ?? 'TEXT',
    payload: message.payload,
  }));
}

const shortId = (id: string) => {
  if (!id || id.length < 8) return id || '?';
  return id.slice(-8);
};

export async function getConversations(
  myId: string,
  allowedPeerIds?: Set<string>
): Promise<Conversation[]> {
  const chats = await localDatabase.getChats();
  const conversations: Conversation[] = [];

  for (const chat of chats) {
    const other = chat.participants.find((id) => id !== myId);
    if (!other) continue;
    if (allowedPeerIds && !allowedPeerIds.has(other)) continue;
    const peerMessages = await localDatabase.getMessagesForChat(chat.chatId);
    const lastMessage = peerMessages[peerMessages.length - 1];
    if (!lastMessage) continue;

    conversations.push({
      chatId: chat.chatId,
      peerId: other,
      peerName: shortId(other),
      lastMessage: lastMessage.content ?? JSON.stringify(lastMessage.payload ?? ''),
      lastTime: chat.lastTime ?? lastMessage.timestamp,
      lastFromMe: lastMessage.sender === myId,
    });
  }

  return conversations.sort((a, b) => b.lastTime - a.lastTime);
}

export async function getMessagesWithPeer(
  myId: string,
  peerId: string
): Promise<MeshPacket[]> {
  const chatId = await localDatabase.getChatId(myId, peerId);
  const messages = await localDatabase.getMessagesForChat(chatId);

  return messages
    .filter(
      (message) =>
        message.sender === myId || message.receiver === myId
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => ({
      id: message.id,
      from: message.sender,
      to: message.receiver,
      ttl: 4,
      timestamp: message.timestamp,
      type: (message.type as PacketType | undefined) ?? 'TEXT',
      payload: message.payload,
    }));
}
