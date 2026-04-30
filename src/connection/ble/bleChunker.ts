/**
 * BLE Chunker Utility
 * Handles splitting large JSON messages into small BLE-compatible chunks
 * and reassembling them on the receiver side.
 */

const CHUNK_SIZE = 40; // Increased for better throughput

interface PendingMessage {
  chunks: string[];
  total: number;
  lastSeen: number;
}

const pendingMessages = new Map<string, PendingMessage>();

/**
 * Split a string into chunks with headers: [MSG_ID:CHUNK_IDX:TOTAL]
 */
export function chunkMessage(messageId: string, data: string): string[] {
  const total = Math.ceil(data.length / CHUNK_SIZE);
  const chunks: string[] = [];
  
  for (let i = 0; i < total; i++) {
    const segment = data.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    // Format: ID|IDX|TOTAL|DATA
    chunks.push(`${messageId.substring(0, 4)}|${i}|${total}|${segment}`);
  }
  
  return chunks;
}

/**
 * Process an incoming chunk and return the full message if complete
 */
export function processChunk(chunk: string): string | null {
  try {
    const parts = chunk.split('|');
    if (parts.length < 4) return null;
    
    const [msgId, idxStr, totalStr, ...dataParts] = parts;
    const idx = parseInt(idxStr);
    const total = parseInt(totalStr);
    const data = dataParts.join('|');
    
    let pending = pendingMessages.get(msgId);
    if (!pending) {
      pending = { chunks: new Array(total).fill(''), total, lastSeen: Date.now() };
      pendingMessages.set(msgId, pending);
    }
    
    pending.chunks[idx] = data;
    pending.lastSeen = Date.now();
    
    // Check if all chunks are present
    if (pending.chunks.every(c => c !== '')) {
      const fullMessage = pending.chunks.join('');
      pendingMessages.delete(msgId);
      return fullMessage;
    }
    
    // Cleanup old pending messages dynamically, but we also have interval
    if (pendingMessages.size > 20) {
      cleanupPending();
    }
    
    return null;
  } catch (e) {
    console.error('[bleChunker] Failed to process chunk:', e);
    return null;
  }
}

function cleanupPending() {
  const now = Date.now();
  for (const [id, p] of pendingMessages.entries()) {
    if (now - p.lastSeen > 10000) { // 10 seconds timeout
       console.log(`[bleChunker] Dropping incomplete message ${id} (missing chunks)`);
       pendingMessages.delete(id);
    }
  }
}

// Active cleanup every 5s
setInterval(cleanupPending, 5000);
