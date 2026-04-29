import { BLE_CONSTANTS } from './bleConstants';

interface PendingMessage {
  messageId: string;
  chunks: any[];
  retryCount: number;
  timestamp: number;
  timeoutId: NodeJS.Timeout | null;
  onAck: () => void;
  onRetry: (retryCount: number) => void;
  onFailure: () => void;
}

class AckManager {
  private pendingMessages = new Map<string, PendingMessage>();

  /**
   * Registers a message for ACK tracking
   */
  registerMessage(
    messageId: string,
    chunks: any[],
    onAck: () => void,
    onRetry: (retryCount: number) => void,
    onFailure: () => void
  ): void {
    console.log(`[ACK] Registering message ${messageId} for ACK tracking`);

    // Clear any existing timeout
    const existing = this.pendingMessages.get(messageId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      this.handleTimeout(messageId);
    }, BLE_CONSTANTS.ACK_TIMEOUT_MS);

    this.pendingMessages.set(messageId, {
      messageId,
      chunks,
      retryCount: 0,
      timestamp: Date.now(),
      timeoutId,
      onAck,
      onRetry,
      onFailure,
    });
  }

  /**
   * Handles received ACK for a message
   */
  handleAck(messageId: string): void {
    const pending = this.pendingMessages.get(messageId);
    if (!pending) {
      console.log(`[ACK] Received ACK for unknown message ${messageId}`);
      return;
    }

    console.log(`[ACK] Received ACK for message ${messageId}`);

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Call success callback
    pending.onAck();

    // Remove from pending
    this.pendingMessages.delete(messageId);
  }

  /**
   * Handles ACK timeout - triggers retry or failure
   */
  private handleTimeout(messageId: string): void {
    const pending = this.pendingMessages.get(messageId);
    if (!pending) return;

    pending.retryCount++;

    if (pending.retryCount >= BLE_CONSTANTS.MAX_RETRIES) {
      console.log(`[ACK] Message ${messageId} failed after ${BLE_CONSTANTS.MAX_RETRIES} retries`);
      pending.onFailure();
      this.pendingMessages.delete(messageId);
      return;
    }

    console.log(`[ACK] Message ${messageId} timeout, retry ${pending.retryCount}/${BLE_CONSTANTS.MAX_RETRIES}`);

    // Reset timeout for next retry
    pending.timeoutId = setTimeout(() => {
      this.handleTimeout(messageId);
    }, BLE_CONSTANTS.ACK_TIMEOUT_MS);

    // Call retry callback
    pending.onRetry(pending.retryCount);
  }

  /**
   * Gets pending message for retry
   */
  getPendingMessage(messageId: string): PendingMessage | undefined {
    return this.pendingMessages.get(messageId);
  }

  /**
   * Clears all pending messages (for cleanup)
   */
  clearAll(): void {
    for (const pending of this.pendingMessages.values()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    }
    this.pendingMessages.clear();
  }

  /**
   * Gets count of pending messages
   */
  getPendingCount(): number {
    return this.pendingMessages.size;
  }
}

export const ackManager = new AckManager();