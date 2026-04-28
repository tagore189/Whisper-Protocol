import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

interface Message {
  id: string;
  from: string;
  to: string;
  payload: any;
  timestamp: number;
  ttl: number;
  encrypted?: boolean;
}

interface ConversationThread {
  peerId: string;
  messages: Message[];
  lastUpdated: number;
}

interface MessageStore {
  conversations: Map<string, ConversationThread>;
  pendingMessages: Message[];
  deliveredMessages: Set<string>;
}

const MESSAGES_STORAGE_KEY = '@app_signal_protocol:messages';
const CONVERSATIONS_STORAGE_KEY = '@app_signal_protocol:conversations';

class ReactNativeMessageStore {
  private conversations: Map<string, ConversationThread> = new Map();
  private pendingMessages: Message[] = [];
  private deliveredMessages: Set<string> = new Set();
  private listeners: ((store: MessageStore) => void)[] = [];
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private peerToConversationId: Map<string, string> = new Map();
  private readonly maxPendingMessages = 500;
  private readonly maxDeliveredIds = 5000;
  private readonly persistDebounceMs = 200;

  /**
   * Initialize the message store from persistent storage
   */
  async initialize(): Promise<void> {
    try {
      const [conversationData, deliveredData] = await Promise.all([
        AsyncStorage.getItem(CONVERSATIONS_STORAGE_KEY),
        AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
      ]);

      if (conversationData) {
        const conversations = JSON.parse(conversationData);
        this.conversations = new Map(Object.entries(conversations));
        this.rebuildPeerIndex();
      }

      if (deliveredData) {
        const delivered = JSON.parse(deliveredData);
        this.deliveredMessages = new Set(delivered);
      }

      console.log('Message store initialized');
    } catch (error) {
      console.error('Failed to initialize message store:', error);
    }
  }

  /**
   * Save current state to persistent storage
   */
  private async persistNow(): Promise<void> {
    try {
      const conversationData = Object.fromEntries(this.conversations);
      const deliveredData = Array.from(this.deliveredMessages);

      await Promise.all([
        AsyncStorage.setItem(
          CONVERSATIONS_STORAGE_KEY,
          JSON.stringify(conversationData)
        ),
        AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(deliveredData)),
      ]);
    } catch (error) {
      console.error('Failed to persist message store:', error);
    }
  }

  private queuePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, this.persistDebounceMs);
  }

  private rebuildPeerIndex(): void {
    this.peerToConversationId.clear();
    for (const [conversationId, thread] of this.conversations.entries()) {
      this.peerToConversationId.set(thread.peerId, conversationId);
    }
  }

  /**
   * Add or update a message in a conversation
   */
  async addMessage(
    from: string,
    to: string,
    payload: any,
    encrypted: boolean = false
  ): Promise<Message> {
    try {
      const conversationId = await this.getConversationId(from, to);
      const message: Message = {
        id: Math.random().toString(36).slice(2),
        from,
        to,
        payload,
        timestamp: Date.now(),
        ttl: 4,
        encrypted,
      };

      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, {
          peerId: from === to ? from : to,
          messages: [],
          lastUpdated: Date.now(),
        });
        this.peerToConversationId.set(from === to ? from : to, conversationId);
      }

      const conversation = this.conversations.get(conversationId)!;
      conversation.messages.push(message);
      conversation.lastUpdated = Date.now();

      this.queuePersist();
      this.notifyListeners();

      return message;
    } catch (error) {
      console.error('Failed to add message:', error);
      throw error;
    }
  }

  /**
   * Mark message as delivered
   */
  async markMessageAsDelivered(messageId: string): Promise<void> {
    try {
      this.deliveredMessages.add(messageId);
      if (this.deliveredMessages.size > this.maxDeliveredIds) {
        const keep = Array.from(this.deliveredMessages).slice(-this.maxDeliveredIds);
        this.deliveredMessages = new Set(keep);
      }
      this.queuePersist();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to mark message as delivered:', error);
    }
  }

  /**
   * Get conversation with a peer
   */
  getConversation(peerId: string): ConversationThread | undefined {
    const key = this.resolveConversationKey(peerId);
    return key ? this.conversations.get(key) : undefined;
  }

  /**
   * Get all conversations
   */
  getConversations(): ConversationThread[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Get messages between two nodes
   */
  getMessages(peerId: string): Message[] {
    const key = this.resolveConversationKey(peerId);
    const conversation = key ? this.conversations.get(key) : undefined;
    return conversation ? conversation.messages : [];
  }

  /**
   * Get pending messages
   */
  getPendingMessages(): Message[] {
    return [...this.pendingMessages];
  }

  /**
   * Add pending message
   */
  async addPendingMessage(message: Message): Promise<void> {
    try {
      this.pendingMessages.push(message);
      if (this.pendingMessages.length > this.maxPendingMessages) {
        this.pendingMessages = this.pendingMessages.slice(-this.maxPendingMessages);
      }
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to add pending message:', error);
    }
  }

  /**
   * Remove pending message (after delivery)
   */
  async removePendingMessage(messageId: string): Promise<void> {
    try {
      const idx = this.pendingMessages.findIndex((m) => m.id === messageId);
      if (idx >= 0) {
        this.pendingMessages.splice(idx, 1);
      }
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to remove pending message:', error);
    }
  }

  /**
   * Check if message was delivered
   */
  isMessageDelivered(messageId: string): boolean {
    return this.deliveredMessages.has(messageId);
  }

  /**
   * Clear conversation history
   */
  async clearConversation(peerId: string): Promise<void> {
    try {
      const key = this.resolveConversationKey(peerId);
      if (key) {
        this.conversations.delete(key);
        this.peerToConversationId.delete(peerId);
      }
      this.queuePersist();
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to clear conversation:', error);
    }
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    try {
      this.conversations.clear();
      this.pendingMessages = [];
      this.deliveredMessages.clear();
      this.peerToConversationId.clear();
      if (this.persistTimer) {
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
      }
      await Promise.all([
        AsyncStorage.removeItem(CONVERSATIONS_STORAGE_KEY),
        AsyncStorage.removeItem(MESSAGES_STORAGE_KEY),
      ]);
      this.notifyListeners();
      console.log('Message store cleared');
    } catch (error) {
      console.error('Failed to clear message store:', error);
    }
  }

  /**
   * Subscribe to store updates
   */
  subscribe(listener: (store: MessageStore) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    const store: MessageStore = {
      conversations: this.conversations,
      pendingMessages: this.pendingMessages,
      deliveredMessages: this.deliveredMessages,
    };
    this.listeners.forEach(listener => listener(store));
  }

  /**
   * Get conversation ID from two node IDs
   */
  private async getConversationId(nodeA: string, nodeB: string): Promise<string> {
    const [first, second] = [nodeA, nodeB].sort();
    const normalized = `${first}:${second}`;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      normalized
    );
  }

  private resolveConversationKey(peerIdOrConversationId: string): string | undefined {
    if (this.conversations.has(peerIdOrConversationId)) {
      return peerIdOrConversationId;
    }

    return this.peerToConversationId.get(peerIdOrConversationId);
  }

  /**
   * Get store state
   */
  getState(): MessageStore {
    return {
      conversations: this.conversations,
      pendingMessages: this.pendingMessages,
      deliveredMessages: this.deliveredMessages,
    };
  }
}

// Export singleton instance
export const messageStore = new ReactNativeMessageStore();

// Export initialization function
export async function initializeMessageStore(): Promise<void> {
  await messageStore.initialize();
}
