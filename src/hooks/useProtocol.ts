/**
 * React Native Hooks for APP SIGNAL PROTOCOL Backend Integration
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getOrCreateIdentity } from '../backend/identity/identity';
import { startScanning, stopScanning } from '../backend/ble/scan';
import { startAdvertising, stopAdvertising, isAdvertising } from '../backend/ble/advertise';
import { getOrCreateKeyPair, rotateKeys } from '../backend/crypto/keyManager';
import {
  encryptMessage,
  decryptMessage,
  hashData,
} from '../backend/crypto/encrypt';
import { messageStore, initializeMessageStore } from '../backend/mesh/messageStore';
import { createPacket } from '../backend/mesh/packet';

interface Identity {
  nodeId: string;
}

interface Node {
  id: string;
  rssi: number | null;
  lastSeen: number;
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Hook to initialize the entire backend
 */
export function useBackendInitialization() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initBackend = async () => {
      try {
        setLoading(true);
        const nodeIdentity = await getOrCreateIdentity();
        await initializeMessageStore();
        setIdentity(nodeIdentity);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('Failed to initialize backend:', err);
      } finally {
        setLoading(false);
      }
    };

    initBackend();
  }, []);

  return { identity, loading, error };
}

/**
 * Hook to manage BLE scanning
 */
export function useBLEScanning() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async () => {
    try {
      setError(null);
      const started = await startScanning((discoveredNodes) => {
        setNodes(discoveredNodes);
      });
      setScanning(started);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scanning failed';
      setError(errorMsg);
      setScanning(false);
      console.error('Failed to start scanning:', err);
    }
  }, []);

  const stopScan = useCallback(() => {
    stopScanning();
    setScanning(false);
  }, []);

  return { nodes, scanning, error, startScan, stopScan };
}

/**
 * Hook to manage BLE advertising
 */
export function useBLEAdvertising() {
  const [advertising, setAdvertising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      const result = await startAdvertising();
      setAdvertising(result);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Advertising failed';
      setError(errorMsg);
      console.error('Failed to start advertising:', err);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      const result = stopAdvertising();
      setAdvertising(!result);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Stop failed';
      setError(errorMsg);
      console.error('Failed to stop advertising:', err);
    }
  }, []);

  return { advertising, error, start, stop };
}

/**
 * Hook to manage cryptographic keys
 */
export function useCryptoKeys() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const keys = await getOrCreateKeyPair();
      setKeyPair(keys);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load keys';
      setError(errorMsg);
      console.error('Failed to load keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const rotate = useCallback(async () => {
    try {
      setLoading(true);
      const newKeys = await rotateKeys();
      setKeyPair(newKeys);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Rotation failed';
      setError(errorMsg);
      console.error('Failed to rotate keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  return { keyPair, loading, error, rotate };
}

/**
 * Hook to encrypt and decrypt messages
 */
export function useEncryption() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encrypt = useCallback(
    async (message: string, recipientPublicKey: string): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);
        const encrypted = await encryptMessage(message, recipientPublicKey);
        return encrypted.ciphertext;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Encryption failed';
        setError(errorMsg);
        console.error('Encryption error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const decrypt = useCallback(
    async (encryptedData: any, senderPublicKey: string): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);
        const decrypted = await decryptMessage(encryptedData, senderPublicKey);
        return decrypted.plaintext;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Decryption failed';
        setError(errorMsg);
        console.error('Decryption error:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const hash = useCallback(async (data: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const hashed = await hashData(data);
      return hashed;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Hashing failed';
      setError(errorMsg);
      console.error('Hashing error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { encrypt, decrypt, hash, loading, error };
}

/**
 * Hook to manage messages and conversations
 */
export function useMessageStore() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = messageStore.subscribe((store) => {
      setConversations(Array.from(store.conversations.values()));
      setPendingMessages(store.pendingMessages);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const addMessage = useCallback(
    async (from: string, to: string, payload: any) => {
      return messageStore.addMessage(from, to, payload);
    },
    []
  );

  const markDelivered = useCallback((messageId: string) => {
    return messageStore.markMessageAsDelivered(messageId);
  }, []);

  const clearConversation = useCallback((peerId: string) => {
    return messageStore.clearConversation(peerId);
  }, []);

  return {
    conversations,
    pendingMessages,
    addMessage,
    markDelivered,
    clearConversation,
  };
}

/**
 * Hook for mesh routing and packet handling
 */
export function useMeshNetworking() {
  const { keyPair } = useCryptoKeys();
  const { addMessage } = useMessageStore();

  const createAndSendPacket = useCallback(
    async (
      from: string,
      to: string,
      payload: any,
      ttl: number = 4
    ): Promise<any | null> => {
      try {
        const packet = createPacket({ from, to, payload });
        packet.ttl = ttl;

        // Add to message store
        await addMessage(from, to, payload);

        return packet;
      } catch (error) {
        console.error('Failed to create packet:', error);
        return null;
      }
    },
    [addMessage]
  );

  return { createAndSendPacket };
}

/**
 * Hook for combined BLE and mesh operations
 */
export function useProtocol() {
  const backendInit = useBackendInitialization();
  const bleAdvertising = useBLEAdvertising();
  const bleScanning = useBLEScanning();
  const encryption = useEncryption();
  const messageStore = useMessageStore();
  const mesh = useMeshNetworking();

  useEffect(() => {
    if (backendInit.identity && !bleAdvertising.advertising) {
      bleAdvertising.start();
    }
  }, [backendInit.identity, bleAdvertising]);

  return {
    ...backendInit,
    ble: { ...bleAdvertising, ...bleScanning },
    encryption,
    messages: messageStore,
    mesh,
  };
}
