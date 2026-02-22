import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureRandomBytes } from './randomBytes';

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface StoredKeys {
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

const KEYS_STORAGE_KEY = '@app_signal_protocol:keys';
const KEY_SIZE = 32; // 256-bit key for AES-256

/**
 * Generate a new cryptographic key pair for the node
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const randomBytes = await getSecureRandomBytes(KEY_SIZE);
    const publicKeyBytes = await getSecureRandomBytes(KEY_SIZE);

    const publicKey = Buffer.from(publicKeyBytes).toString('hex');
    const privateKey = Buffer.from(randomBytes).toString('hex');

    return { publicKey, privateKey };
  } catch (error) {
    console.error('Failed to generate key pair:', error);
    throw new Error('Key pair generation failed');
  }
}

/**
 * Get or create node's key pair
 */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  try {
    const stored = await AsyncStorage.getItem(KEYS_STORAGE_KEY);

    if (stored) {
      const storedKeys: StoredKeys = JSON.parse(stored);
      return {
        publicKey: storedKeys.publicKey,
        privateKey: storedKeys.privateKey,
      };
    }

    // Generate new key pair
    const keyPair = await generateKeyPair();

    // Store keys
    const toStore: StoredKeys = {
      ...keyPair,
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(toStore));
    return keyPair;
  } catch (error) {
    console.error('Failed to get or create key pair:', error);
    throw error;
  }
}

/**
 * Get the public key
 */
export async function getPublicKey(): Promise<string> {
  try {
    const keyPair = await getOrCreateKeyPair();
    return keyPair.publicKey;
  } catch (error) {
    console.error('Failed to get public key:', error);
    throw error;
  }
}

/**
 * Get the private key (use with caution!)
 */
export async function getPrivateKey(): Promise<string> {
  try {
    const keyPair = await getOrCreateKeyPair();
    return keyPair.privateKey;
  } catch (error) {
    console.error('Failed to get private key:', error);
    throw error;
  }
}

/**
 * Rotate keys - generate new pair and store
 */
export async function rotateKeys(): Promise<KeyPair> {
  try {
    const newKeyPair = await generateKeyPair();

    const toStore: StoredKeys = {
      ...newKeyPair,
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(toStore));
    console.log('Keys rotated successfully');

    return newKeyPair;
  } catch (error) {
    console.error('Failed to rotate keys:', error);
    throw error;
  }
}

/**
 * Delete stored keys (for reset/logout)
 */
export async function deleteKeys(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS_STORAGE_KEY);
    console.log('Keys deleted successfully');
  } catch (error) {
    console.error('Failed to delete keys:', error);
    throw error;
  }
}

/**
 * Get key metadata
 */
export async function getKeyMetadata(): Promise<{
  hasKeys: boolean;
  createdAt?: number;
}> {
  try {
    const stored = await AsyncStorage.getItem(KEYS_STORAGE_KEY);

    if (!stored) {
      return { hasKeys: false };
    }

    const storedKeys: StoredKeys = JSON.parse(stored);
    return {
      hasKeys: true,
      createdAt: storedKeys.createdAt,
    };
  } catch (error) {
    console.error('Failed to get key metadata:', error);
    return { hasKeys: false };
  }
}
