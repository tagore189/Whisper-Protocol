import { BLE_CONSTANTS } from './bleConstants';

/**
 * Message chunk structure
 */
export interface MessageChunk {
  id: string;
  type: 'chunk';
  payload: string;
  chunkIndex: number;
  totalChunks: number;
  timestamp: number;
}

/**
 * ACK message structure
 */
export interface AckMessage {
  id: string;
  type: 'ack';
  messageId: string;
  timestamp: number;
}

/**
 * Splits a message into chunks for BLE transmission
 */
export function chunkMessage(messageId: string, content: string): MessageChunk[] {
  const chunks: MessageChunk[] = [];
  const totalChunks = Math.ceil(content.length / BLE_CONSTANTS.MAX_CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * BLE_CONSTANTS.MAX_CHUNK_SIZE;
    const end = Math.min(start + BLE_CONSTANTS.MAX_CHUNK_SIZE, content.length);
    const payload = content.slice(start, end);

    chunks.push({
      id: `${messageId}_chunk_${i}`,
      type: BLE_CONSTANTS.MESSAGE_TYPE_CHUNK,
      payload,
      chunkIndex: i,
      totalChunks,
      timestamp: Date.now(),
    });
  }

  return chunks;
}

/**
 * Reassembles chunks back into the original message
 */
export function reassembleMessage(chunks: MessageChunk[]): string | null {
  if (chunks.length === 0) return null;

  // Sort chunks by index
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Verify we have all chunks
  const totalChunks = chunks[0].totalChunks;
  if (chunks.length !== totalChunks) {
    return null; // Missing chunks
  }

  // Verify all chunks belong to the same message
  const messageId = chunks[0].id.split('_chunk_')[0];
  for (const chunk of chunks) {
    if (!chunk.id.startsWith(messageId)) {
      return null; // Inconsistent message IDs
    }
  }

  // Reassemble the message
  return chunks.map(chunk => chunk.payload).join('');
}

/**
 * Creates an ACK message for a received message
 */
export function createAckMessage(messageId: string): AckMessage {
  return {
    id: `ack_${messageId}_${Date.now()}`,
    type: BLE_CONSTANTS.MESSAGE_TYPE_ACK,
    messageId,
    timestamp: Date.now(),
  };
}