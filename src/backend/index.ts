/**
 * APP SIGNAL PROTOCOL Backend - Main Entry Point
 * React Native Compatible Implementation
 */

import { getOrCreateIdentity } from './identity/identity';
import { startScanning, stopScanning } from './ble/scan';
import { startAdvertising, stopAdvertising } from './ble/advertise';
import { getOrCreateKeyPair } from './crypto/keyManager';
import { initializeMessageStore } from './mesh/messageStore';

interface Identity {
  nodeId: string;
}

interface Node {
  id: string;
  rssi: number | null;
  lastSeen: number;
}

interface BackendConfig {
  enableBLEScanning?: boolean;
  enableBLEAdvertising?: boolean;
  enableEncryption?: boolean;
}

/**
 * Initialize the entire backend system
 * This should be called once on app startup
 */
export async function initBackend(
  onNodesUpdate: (nodes: Node[]) => void,
  config: BackendConfig = {}
): Promise<Identity> {
  const {
    enableBLEScanning = true,
    enableBLEAdvertising = true,
    enableEncryption = true,
  } = config;

  try {
    console.log('Initializing APP SIGNAL PROTOCOL Backend...');

    // Initialize identity
    const identity = await getOrCreateIdentity();
    console.log('Node Identity:', identity.nodeId);

    // Initialize message store
    await initializeMessageStore();
    console.log('Message Store initialized');

    // Initialize encryption
    if (enableEncryption) {
      const keyPair = await getOrCreateKeyPair();
      console.log('Encryption enabled, public key:', keyPair.publicKey.substring(0, 16) + '...');
    }

    // Start BLE operations
    if (enableBLEScanning) {
      await startScanning(onNodesUpdate);
      console.log('BLE Scanning started');
    }

    if (enableBLEAdvertising) {
      await startAdvertising();
      console.log('BLE Advertising started');
    }

    console.log('Backend initialization complete');
    return identity;
  } catch (error) {
    console.error('Backend initialization failed:', error);
    throw error;
  }
}

/**
 * Shutdown the backend gracefully
 */
export async function shutdownBackend(): Promise<void> {
  try {
    console.log('Shutting down backend...');
    stopScanning();
    await stopAdvertising();
    console.log('Backend shutdown complete');
  } catch (error) {
    console.error('Error during backend shutdown:', error);
  }
}

// Re-export key modules for direct access
export { getOrCreateIdentity } from './identity/identity';
export { startScanning, stopScanning } from './ble/scan';
export { startAdvertising, stopAdvertising, isAdvertising } from './ble/advertise';
export { getOrCreateKeyPair, getPublicKey, rotateKeys } from './crypto/keyManager';
export {
  encryptMessage,
  decryptMessage,
  signData,
  verifySignature,
  hashData,
} from './crypto/encrypt';
export { messageStore, initializeMessageStore } from './mesh/messageStore';
export { createPacket } from './mesh/packet';
export { handlePacket } from './mesh/router';
