import { saveMessage, updateMessageStatus } from '../../chat/msg/chatStore';
import type { MeshPacket } from '../mesh/packet';
import { onBLEMessage, sendBLE } from './bleTransport';

let listeners: ((packet: MeshPacket) => void)[] = [];

/**
 * Register a listener for incoming messages
 */
export function onMessageReceived(cb: (packet: MeshPacket) => void) {
  listeners.push(cb);
  console.log(`[bleMessaging] Registered listener, total: ${listeners.length}`);
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

/**
 * Send message via real BLE transport
 */
export async function sendMessageBLE(packet: MeshPacket): Promise<void> {
  try {
    console.log('[bleMessaging] Sending packet via BLE:', packet.id, packet.type);

    // Serialize to JSON
    const jsonData = JSON.stringify(packet);

    // Send via BLE
    const success = await sendBLE(jsonData);

    if (!success) {
      console.error('[bleMessaging] Failed to send via BLE');
    }
  } catch (error) {
    console.error('[bleMessaging] Error in sendMessageBLE:', error);
  }
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
    // Handle ACK messages
    if (packet.type === 'ACK') {
      console.log('[bleMessaging] Received ACK for:', packet.payload?.messageId);
      if (packet.payload?.messageId) {
        await updateMessageStatus(packet.payload.messageId, 'delivered');
      }
      emitMessage(packet);
      return;
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

    console.log('[bleMessaging] Sending ACK back for:', packet.id);
    await sendMessageBLE(ackPacket);
  } catch (error) {
    console.error('[bleMessaging] Error handling incoming message:', error);
  }
}

// Initialize on module load
initializeBLEMessaging();
