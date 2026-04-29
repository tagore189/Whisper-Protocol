import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDatabase, type MessageRecord } from '../storage/localDatabase';

const BLE_CHAT_KEY = '@blechat:messages';
const BLE_STATUS_KEY = '@blechat:status';

export interface BLEMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  chunks?: any[]; // For internal use
}

/**
 * BLE-specific chat store using AsyncStorage
 */
class BLEChatStore {
  private messages: Map<string, BLEMessage> = new Map();

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(BLE_CHAT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.messages = new Map(Object.entries(parsed));
      }
      console.log('[BLE Chat] Store initialized with', this.messages.size, 'messages');
    } catch (error) {
      console.error('[BLE Chat] Failed to initialize store:', error);
      this.messages = new Map();
    }
  }

  /**
   * Save a message locally (optimistic update)
   */
  async addMessage(
    content: string,
    senderId: string,
    receiverId: string,
    status: BLEMessage['status'] = 'sending'
  ): Promise<string> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: BLEMessage = {
      id: messageId,
      content,
      senderId,
      receiverId,
      timestamp: Date.now(),
      status,
    };

    // Save to BLE store
    this.messages.set(messageId, message);
    await this.persistMessages();

    // Also save to main database for consistency
    const chatId = await localDatabase.getChatId(senderId, receiverId);
    const dbMessage: MessageRecord = {
      id: messageId,
      chatId,
      sender: senderId,
      receiver: receiverId,
      timestamp: message.timestamp,
      content,
      type: 'TEXT',
      status,
    };

    await localDatabase.saveMessage(dbMessage);

    console.log('[BLE Chat] Added message:', messageId, 'status:', status);
    return messageId;
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId: string, status: BLEMessage['status']): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) {
      console.warn('[BLE Chat] Message not found for status update:', messageId);
      return;
    }

    message.status = status;
    this.messages.set(messageId, message);
    await this.persistMessages();

    // Also update in main database
    try {
      const existingMessage = await localDatabase.getMessage(messageId);
      if (existingMessage) {
        existingMessage.status = status;
        // Note: localDatabase doesn't have an update method, so we'd need to extend it
        // For now, we'll just log the status change
        console.log('[BLE Chat] Updated message status in BLE store:', messageId, status);
      }
    } catch (error) {
      console.error('[BLE Chat] Failed to update status in main DB:', error);
    }
  }

  /**
   * Get all messages
   */
  async getMessages(): Promise<BLEMessage[]> {
    await this.initialize();
    return Array.from(this.messages.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get messages between two peers
   */
  async getMessagesWithPeer(myId: string, peerId: string): Promise<BLEMessage[]> {
    await this.initialize();
    return Array.from(this.messages.values())
      .filter(msg =>
        (msg.senderId === myId && msg.receiverId === peerId) ||
        (msg.senderId === peerId && msg.receiverId === myId)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string): Promise<BLEMessage | null> {
    await this.initialize();
    return this.messages.get(messageId) || null;
  }

  /**
   * Clear all messages
   */
  async clearAllMessages(): Promise<void> {
    this.messages.clear();
    await AsyncStorage.removeItem(BLE_CHAT_KEY);
    console.log('[BLE Chat] Cleared all messages');
  }

  /**
   * Persist messages to AsyncStorage
   */
  private async persistMessages(): Promise<void> {
    try {
      const messagesObj = Object.fromEntries(this.messages);
      await AsyncStorage.setItem(BLE_CHAT_KEY, JSON.stringify(messagesObj));
    } catch (error) {
      console.error('[BLE Chat] Failed to persist messages:', error);
    }
  }

  /**
   * Save connection status
   */
  async saveConnectionStatus(connected: boolean, deviceId?: string): Promise<void> {
    try {
      const status = {
        connected,
        deviceId,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(BLE_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('[BLE Chat] Failed to save connection status:', error);
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<{connected: boolean; deviceId?: string; timestamp: number} | null> {
    try {
      const stored = await AsyncStorage.getItem(BLE_STATUS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[BLE Chat] Failed to get connection status:', error);
      return null;
    }
  }
}

export const bleChatStore = new BLEChatStore();