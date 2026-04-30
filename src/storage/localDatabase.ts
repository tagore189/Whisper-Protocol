import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICES_KEY = '@localdb:devices';
const CHATS_KEY = '@localdb:chats';
const MESSAGES_KEY = '@localdb:messages';

export interface DeviceRecord {
  id: string;
  name?: string;
  lastSeen?: number;
  handshakeState?: string;
}

export interface ChatRecord {
  chatId: string;
  participants: [string, string];
  lastMessage?: string;
  lastTime?: number;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  sender: string;
  receiver: string;
  timestamp: number;
  payload?: any;
  content?: string;
  type?: string;
  status?: string;
}

interface LocalTables {
  devices: Record<string, DeviceRecord>;
  chats: Record<string, ChatRecord>;
  messages: Record<string, MessageRecord>;
}

const initialTables: LocalTables = {
  devices: {},
  chats: {},
  messages: {},
};

class LocalDatabase {
  private devices: Record<string, DeviceRecord> = {};
  private chats: Record<string, ChatRecord> = {};
  private messages: Record<string, MessageRecord> = {};
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const [devicesRaw, chatsRaw, messagesRaw] = await Promise.all([
        AsyncStorage.getItem(DEVICES_KEY),
        AsyncStorage.getItem(CHATS_KEY),
        AsyncStorage.getItem(MESSAGES_KEY),
      ]);

      this.devices = devicesRaw ? JSON.parse(devicesRaw) : {};
      this.chats = chatsRaw ? JSON.parse(chatsRaw) : {};
      this.messages = messagesRaw ? JSON.parse(messagesRaw) : {};
      this.initialized = true;
    } catch (error) {
      console.error('LocalDatabase initialization failed:', error);
      this.devices = {};
      this.chats = {};
      this.messages = {};
      this.initialized = true;
    }
  }

  private async persistTable<T>(key: string, value: Record<string, T>): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to persist ${key}:`, error);
    }
  }

  async getDevices(): Promise<DeviceRecord[]> {
    await this.initialize();
    return Object.values(this.devices);
  }

  async upsertDevice(device: DeviceRecord): Promise<void> {
    await this.initialize();
    const existing = this.devices[device.id];
    this.devices[device.id] = {
      ...existing,
      ...device,
      lastSeen: device.lastSeen ?? existing?.lastSeen,
    };
    await this.persistTable(DEVICES_KEY, this.devices);
  }

  async getChats(): Promise<ChatRecord[]> {
    await this.initialize();
    return Object.values(this.chats).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));
  }

  async getChat(chatId: string): Promise<ChatRecord | undefined> {
    await this.initialize();
    return this.chats[chatId];
  }

  async upsertChat(chat: ChatRecord): Promise<void> {
    await this.initialize();
    const existing = this.chats[chat.chatId];
    this.chats[chat.chatId] = {
      ...existing,
      ...chat,
      participants: chat.participants,
      lastMessage: chat.lastMessage ?? existing?.lastMessage,
      lastTime: chat.lastTime ?? existing?.lastTime,
    };
    await this.persistTable(CHATS_KEY, this.chats);
  }

  async getMessages(): Promise<MessageRecord[]> {
    await this.initialize();
    return Object.values(this.messages).sort((a, b) => a.timestamp - b.timestamp);
  }

  async getMessagesForChat(chatId: string): Promise<MessageRecord[]> {
    await this.initialize();
    return Object.values(this.messages)
      .filter((message) => message.chatId === chatId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getMessage(messageId: string): Promise<MessageRecord | undefined> {
    await this.initialize();
    return this.messages[messageId];
  }

  async saveMessage(message: MessageRecord): Promise<void> {
    await this.initialize();
    if (this.messages[message.id]) {
      console.log(`Message with ID ${message.id} already exists. Skipping save.`);
      return;
    }

    this.messages[message.id] = message;
    await this.persistTable(MESSAGES_KEY, this.messages);

    const participants = await LocalDatabase.getParticipantsFromMessage(message);
    const lastMessage = typeof message.content === 'string' ? message.content : JSON.stringify(message.payload ?? '');
    const lastTime = message.timestamp;

    await this.upsertChat({
      chatId: message.chatId,
      participants,
      lastMessage,
      lastTime,
    });
  }

  async clearAll(): Promise<void> {
    this.devices = {};
    this.chats = {};
    this.messages = {};
    await Promise.all([
      AsyncStorage.removeItem(DEVICES_KEY),
      AsyncStorage.removeItem(CHATS_KEY),
      AsyncStorage.removeItem(MESSAGES_KEY),
    ]);
  }

  async getChatId(peerA: string, peerB: string): Promise<string> {
    const [first, second] = [peerA, peerB].sort();
    const normalized = `${first}:${second}`;
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
  }

  private static async getParticipantsFromMessage(message: MessageRecord): Promise<[string, string]> {
    const participants: [string, string] = [message.sender, message.receiver];
    return participants;
  }
}

export const localDatabase = new LocalDatabase();
