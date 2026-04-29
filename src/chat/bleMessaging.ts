import { chunkMessage, reassembleMessage, createAckMessage, type MessageChunk, type AckMessage } from './chunker';
import { ackManager } from './ackManager';
import { bleChatStore } from './bleChatStore';
import { writeCharacteristic } from './bleCentral';
import { notifyCharacteristic } from './blePeripheral';
import { BLE_CONSTANTS } from './bleConstants';

// Message reassembly buffer
const messageBuffer = new Map<string, MessageChunk[]>();

/**
 * Send a message via BLE with chunking and ACK handling
 */
export async function sendMessageBLE(
  content: string,
  senderId: string,
  receiverId: string,
  usePeripheral: boolean = false // true for peripheral mode, false for central mode
): Promise<string> {
  try {
    // 1. Save message locally first (optimistic update)
    const messageId = await bleChatStore.addMessage(content, senderId, receiverId, 'sending');
    console.log('[BLE Send] Saved message locally:', messageId);

    // 2. Split message into chunks
    const chunks = chunkMessage(messageId, content);
    console.log('[BLE Send] Split into', chunks.length, 'chunks');

    // 3. Register for ACK tracking
    ackManager.registerMessage(
      messageId,
      chunks,
      () => {
        // On ACK received
        console.log('[BLE Send] Message delivered:', messageId);
        bleChatStore.updateMessageStatus(messageId, 'delivered');
      },
      (retryCount) => {
        // On retry needed
        console.log('[BLE Send] Retrying message:', messageId, 'attempt:', retryCount);
        sendChunks(chunks, usePeripheral);
      },
      () => {
        // On failure
        console.log('[BLE Send] Message failed after retries:', messageId);
        bleChatStore.updateMessageStatus(messageId, 'failed');
      }
    );

    // 4. Send chunks
    const success = await sendChunks(chunks, usePeripheral);
    if (!success) {
      console.error('[BLE Send] Failed to send initial chunks for:', messageId);
      bleChatStore.updateMessageStatus(messageId, 'failed');
      return messageId;
    }

    return messageId;
  } catch (error) {
    console.error('[BLE Send] Failed to send message:', error);
    throw error;
  }
}

/**
 * Send chunks via BLE
 */
async function sendChunks(chunks: MessageChunk[], usePeripheral: boolean): Promise<boolean> {
  try {
    for (const chunk of chunks) {
      const chunkData = JSON.stringify(chunk);

      let success = false;
      if (usePeripheral) {
        success = await notifyCharacteristic(chunkData);
      } else {
        success = await writeCharacteristic(chunkData);
      }

      if (!success) {
        console.error('[BLE Send] Failed to send chunk:', chunk.id);
        return false;
      }

      console.log('[BLE Send] Sent chunk:', chunk.chunkIndex + 1, '/', chunk.totalChunks);
    }

    return true;
  } catch (error) {
    console.error('[BLE Send] Failed to send chunks:', error);
    return false;
  }
}

/**
 * Handle incoming BLE data (chunks and ACKs)
 */
export async function handleIncomingBLEData(data: string): Promise<void> {
  try {
    const parsed = JSON.parse(data);

    if (parsed.type === BLE_CONSTANTS.MESSAGE_TYPE_CHUNK) {
      await handleIncomingChunk(parsed as MessageChunk);
    } else if (parsed.type === BLE_CONSTANTS.MESSAGE_TYPE_ACK) {
      await handleIncomingAck(parsed as AckMessage);
    } else {
      console.warn('[BLE Receive] Unknown message type:', parsed.type);
    }
  } catch (error) {
    console.error('[BLE Receive] Failed to parse incoming data:', error);
  }
}

/**
 * Handle incoming message chunk
 */
async function handleIncomingChunk(chunk: MessageChunk): Promise<void> {
  console.log('[BLE Receive] Received chunk:', chunk.chunkIndex + 1, '/', chunk.totalChunks, 'for message:', chunk.id);

  const messageId = chunk.id.split('_chunk_')[0];
  const existingChunks = messageBuffer.get(messageId) || [];

  // Check for duplicate chunk
  const isDuplicate = existingChunks.some(c => c.chunkIndex === chunk.chunkIndex);
  if (isDuplicate) {
    console.log('[BLE Receive] Duplicate chunk received, ignoring');
    return;
  }

  existingChunks.push(chunk);
  messageBuffer.set(messageId, existingChunks);

  // Check if we have all chunks
  if (existingChunks.length === chunk.totalChunks) {
    console.log('[BLE Receive] All chunks received for message:', messageId);

    // Reassemble message
    const fullMessage = reassembleMessage(existingChunks);
    if (fullMessage) {
      console.log('[BLE Receive] Reassembled message:', fullMessage.substring(0, 50) + '...');

      // Save to local storage
      await bleChatStore.addMessage(
        fullMessage,
        'unknown', // We don't know sender from BLE data yet
        'me', // Assuming we're the receiver
        'delivered'
      );

      // Send ACK
      const ackMessage = createAckMessage(messageId);
      const ackData = JSON.stringify(ackMessage);

      // Send ACK (we need to determine if we're peripheral or central)
      // For now, try both methods
      try {
        await writeCharacteristic(ackData);
      } catch {
        try {
          await notifyCharacteristic(ackData);
        } catch {
          console.error('[BLE Receive] Failed to send ACK');
        }
      }

      console.log('[BLE Receive] Sent ACK for message:', messageId);
    } else {
      console.error('[BLE Receive] Failed to reassemble message:', messageId);
    }

    // Clean up buffer
    messageBuffer.delete(messageId);
  }
}

/**
 * Handle incoming ACK
 */
async function handleIncomingAck(ack: AckMessage): Promise<void> {
  console.log('[BLE Receive] Received ACK for message:', ack.messageId);
  ackManager.handleAck(ack.messageId);
}

/**
 * Clean up message buffer (remove old incomplete messages)
 */
export function cleanupMessageBuffer(): void {
  const now = Date.now();
  const timeoutMs = 30000; // 30 seconds

  for (const [messageId, chunks] of messageBuffer.entries()) {
    if (chunks.length > 0) {
      const oldestChunk = chunks.reduce((oldest, chunk) =>
        chunk.timestamp < oldest.timestamp ? chunk : oldest
      );

      if (now - oldestChunk.timestamp > timeoutMs) {
        console.log('[BLE Receive] Cleaning up stale message buffer:', messageId);
        messageBuffer.delete(messageId);
      }
    }
  }
}

/**
 * Get buffer stats for debugging
 */
export function getBufferStats(): { messageCount: number; totalChunks: number } {
  let totalChunks = 0;
  for (const chunks of messageBuffer.values()) {
    totalChunks += chunks.length;
  }

  return {
    messageCount: messageBuffer.size,
    totalChunks,
  };
}