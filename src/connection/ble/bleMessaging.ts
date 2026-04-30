import { saveMessage, updateMessageStatus } from '../../chat/msg/chatStore';
import type { MeshPacket } from '../mesh/packet';
import { onBLEMessage, sendBLE, isConnected } from './bleTransport';

let listeners: ((packet: MeshPacket) => void)[] = [];

/**
 * Register a listener for incoming messages
 */
export function onMessageReceived(cb: (packet: MeshPacket) => void): () => void {
  listeners.push(cb);
  console.log(`[bleMessaging] Registered listener, total: ${listeners.length}`);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    console.log(`[bleMessaging] Unregistered listener, total: ${listeners.length}`);
  };
}

/**
 * Emit a message to all listeners
 */
function emitMessage(packet: MeshPacket) {
  console.log('[bleMessaging] Emitting message to', listeners.length, 'listeners:', packet.type);
  listeners.forEach((cb) => {
    try {
      cb(packet);
    } catch (error) {
      console.error('[bleMessaging] Listener error:', error);
    }
  });
}

const PENDING_TIMEOUT = 5000;
const MAX_RETRIES = 3;

interface PendingMessage {
  packet: MeshPacket;
  retries: number;
  timer: ReturnType<typeof setTimeout>;
}

const pendingQueue = new Map<string, PendingMessage>();
const receivedMessageIds = new Set<string>();
const recentAckPackets = new Map<string, MeshPacket>();

export function resendPendingMessages() {
  console.log(`[bleMessaging] Resending ${pendingQueue.size} pending messages after reconnect`);
  for (const [id, pending] of pendingQueue.entries()) {
    clearTimeout(pending.timer); // Clear old timer
    sendMessageReliable(pending.packet, pending.retries);
  }

  // Resend recent ACKs to handle ACK loss during disconnect
  console.log(`[bleMessaging] Resending ${recentAckPackets.size} recent ACKs`);
  for (const ackPacket of recentAckPackets.values()) {
    sendMessageBLE(ackPacket).catch(() => {});
  }
}

const MAX_QUEUE_SIZE = 50;

/**
 * Send message via real BLE transport with reliability (ACK + Retry)
 */
export async function sendMessageReliable(packet: MeshPacket, initialRetries = 0): Promise<boolean> {
  if (pendingQueue.size >= MAX_QUEUE_SIZE) {
    console.error(`[bleMessaging] Queue full (${pendingQueue.size}). Rejecting message ${packet.id}`);
    await updateMessageStatus(packet.id, 'failed').catch(() => {});
    return false;
  }

  return new Promise((resolve) => {
    const attemptSend = async (retries: number) => {
      try {
        console.log(`[bleMessaging] Sending packet: ${packet.id} (Retry: ${retries})`);
        const jsonData = JSON.stringify(packet);
        const success = await sendBLE(jsonData);

        if (!success) {
          console.error('[bleMessaging] Failed to send via BLE directly.');
          if (retries >= MAX_RETRIES) {
             await updateMessageStatus(packet.id, 'failed').catch(() => {});
             pendingQueue.delete(packet.id);
             resolve(false);
          } else {
             if (!isConnected()) {
               console.warn(`[bleMessaging] Pausing retry for ${packet.id} due to disconnect`);
               // Just keep it in queue without timer, will be picked up by resendPendingMessages
               pendingQueue.set(packet.id, { packet, retries: retries + 1, timer: setTimeout(() => {}, 0) });
               return;
             }
             const timer = setTimeout(() => attemptSend(retries + 1), PENDING_TIMEOUT);
             pendingQueue.set(packet.id, { packet, retries: retries + 1, timer });
          }
          return;
        }

        // Initially marked as sent
        await updateMessageStatus(packet.id, 'sent').catch(() => {});

        // Successfully written to BLE, wait for ACK
        const timer = setTimeout(() => {
          if (!isConnected()) {
             console.warn(`[bleMessaging] Pausing ACK timeout for ${packet.id} due to disconnect`);
             return; // Will be picked up by resendPendingMessages
          }
          console.warn(`[bleMessaging] ACK timeout for ${packet.id}`);
          if (retries >= MAX_RETRIES) {
            console.error(`[bleMessaging] Max retries reached for ${packet.id}. Failing.`);
            pendingQueue.delete(packet.id);
            updateMessageStatus(packet.id, 'failed').catch(() => {});
            resolve(false);
          } else {
            attemptSend(retries + 1);
          }
        }, PENDING_TIMEOUT);

        pendingQueue.set(packet.id, { packet, retries, timer });

      } catch (e) {
        console.error('[bleMessaging] Error in attemptSend:', e);
        resolve(false);
      }
    };

    attemptSend(initialRetries);
    // Resolve true immediately as it is successfully queued
    resolve(true);
  });
}

/**
 * Send message via real BLE transport (legacy, keeping for backwards compatibility)
 */
export async function sendMessageBLE(packet: MeshPacket): Promise<void> {
  await sendMessageReliable(packet);
}

/**
 * Initialize BLE message handling
 */
export function initializeBLEMessaging(): void {
  console.log('[bleMessaging] Initializing BLE message handling');

  // Listen for incoming BLE messages
  onBLEMessage((data: string) => {
    console.log('[bleMessaging] Received raw BLE data:', data.substring(0, 100) + '...');
    try {
      const packet = JSON.parse(data) as MeshPacket;
      console.log('[bleMessaging] Received BLE message:', packet.id, packet.type);

      // Handle incoming message
      handleIncomingMessage(packet);
    } catch (error) {
      console.error('[bleMessaging] Failed to parse BLE message:', error);
    }
  });
}

/**
 * Handle incoming messages - save and send ACK
 */
async function handleIncomingMessage(packet: MeshPacket): Promise<void> {
  try {
    // Handle Control messages
    if (['HANDSHAKE', 'connection_request', 'connection_accepted', 'connection_rejected'].includes(packet.type)) {
      emitMessage(packet);
      return;
    }

    // Handle ACK messages
    if (packet.type === 'ACK') {
      const msgId = packet.payload?.messageId;
      console.log('[bleMessaging] Received ACK for:', msgId);
      
      if (msgId) {
        if (pendingQueue.has(msgId)) {
          const pending = pendingQueue.get(msgId)!;
          clearTimeout(pending.timer);
          pendingQueue.delete(msgId);
        }
        await updateMessageStatus(msgId, 'delivered');
      }
      emitMessage(packet);
      return;
    }

    // Deduplication check
    if (receivedMessageIds.has(packet.id)) {
      console.log(`[bleMessaging] Ignoring duplicate message ${packet.id}`);
      if (packet.type !== 'ACK') {
        // Send ACK back in case peer missed it
        const ackPacket: MeshPacket = {
          id: `ack_${packet.id}`,
          from: packet.to,
          to: packet.from,
          ttl: 4,
          timestamp: Date.now(),
          type: 'ACK',
          payload: { messageId: packet.id },
        };
        
        recentAckPackets.set(packet.id, ackPacket);
        if (recentAckPackets.size > 20) {
           const oldest = Array.from(recentAckPackets.keys())[0];
           recentAckPackets.delete(oldest);
        }
        
        await sendMessageBLE(ackPacket);
      }
      return;
    }
    
    receivedMessageIds.add(packet.id);
    if (receivedMessageIds.size > 1000) {
       const ids = Array.from(receivedMessageIds).slice(-500);
       receivedMessageIds.clear();
       ids.forEach(id => receivedMessageIds.add(id));
    }

    // Save received message
    console.log('[bleMessaging] Received message:', packet.id);
    await saveMessage(packet);

    // Emit to UI listeners
    emitMessage(packet);

    // Auto-send ACK back
    const ackPacket: MeshPacket = {
      id: `ack_${packet.id}`,
      from: packet.to,
      to: packet.from,
      ttl: 4,
      timestamp: Date.now(),
      type: 'ACK',
      payload: { messageId: packet.id },
    };

    recentAckPackets.set(packet.id, ackPacket);
    if (recentAckPackets.size > 20) {
       const oldest = Array.from(recentAckPackets.keys())[0];
       recentAckPackets.delete(oldest);
    }

    console.log('[bleMessaging] Sending ACK back for:', packet.id);
    await sendMessageBLE(ackPacket);
  } catch (error) {
    console.error('[bleMessaging] Error handling incoming message:', error);
  }
}

// Initialize on next tick to break circular dependency
setTimeout(() => {
  initializeBLEMessaging();
}, 0);
