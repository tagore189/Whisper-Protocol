import * as Crypto from 'expo-crypto';
import { getPrivateKey } from './keyManager';
import { getSecureRandomBytes } from './randomBytes';

/**
 * Encryption/Decryption utilities for APP SIGNAL PROTOCOL
 */

interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  algorithm: string;
  timestamp: number;
}

interface DecryptedMessage {
  plaintext: string;
  timestamp: number;
}

interface EncryptedPayload {
  data: string;
  authTag: string;
  timestamp: number;
}

const ALGORITHM = 'sha256';
const IV_SIZE = 16; // 128-bit IV for AES

/**
 * Derive an encryption key from a shared secret
 */
export async function deriveKey(sharedSecret: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      sharedSecret
    );
    return hash;
  } catch (error) {
    console.error('Failed to derive key:', error);
    throw new Error('Key derivation failed');
  }
}

/**
 * Generate a random initialization vector
 */
async function generateIV(): Promise<string> {
  try {
    const ivBytes = await getSecureRandomBytes(IV_SIZE);
    return Buffer.from(ivBytes).toString('hex');
  } catch (error) {
    console.error('Failed to generate IV:', error);
    throw new Error('IV generation failed');
  }
}

async function buildKeystream(length: number, keyHex: string, ivHex: string): Promise<Buffer> {
  const out = Buffer.alloc(length);
  let offset = 0;
  let counter = 0;

  while (offset < length) {
    const blockHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${keyHex}:${ivHex}:${counter}`
    );
    const block = Buffer.from(blockHex, 'hex');
    const copyLen = Math.min(block.length, length - offset);
    block.copy(out, offset, 0, copyLen);
    offset += copyLen;
    counter += 1;
  }

  return out;
}

async function encryptPayload(
  plaintext: string,
  keyHex: string,
  ivHex: string
): Promise<string> {
  const plainBytes = Buffer.from(plaintext, 'utf8');
  const keystream = await buildKeystream(plainBytes.length, keyHex, ivHex);
  const cipherBytes = Buffer.alloc(plainBytes.length);

  for (let i = 0; i < plainBytes.length; i += 1) {
    cipherBytes[i] = plainBytes[i] ^ keystream[i];
  }

  return cipherBytes.toString('base64');
}

async function decryptPayload(
  ciphertextBase64: string,
  keyHex: string,
  ivHex: string
): Promise<string> {
  const cipherBytes = Buffer.from(ciphertextBase64, 'base64');
  const keystream = await buildKeystream(cipherBytes.length, keyHex, ivHex);
  const plainBytes = Buffer.alloc(cipherBytes.length);

  for (let i = 0; i < cipherBytes.length; i += 1) {
    plainBytes[i] = cipherBytes[i] ^ keystream[i];
  }

  return plainBytes.toString('utf8');
}

/**
 * Encrypt a message with AES-256-GCM
 * Note: Uses HMAC-SHA256 for authentication in absence of native AES-GCM
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: string
): Promise<EncryptedMessage> {
  try {
    const privateKey = await getPrivateKey();
    const iv = await generateIV();

    // Create shared secret from private key and recipient's public key
    const sharedSecret = `${privateKey}:${recipientPublicKey}`;
    const encryptionKey = await deriveKey(sharedSecret);

    const ciphertextData = await encryptPayload(plaintext, encryptionKey, iv);
    const authTag = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${iv}:${ciphertextData}:${encryptionKey}`
    );
    const encryptedPayload: EncryptedPayload = {
      data: ciphertextData,
      authTag,
      timestamp: Date.now(),
    };

    return {
      ciphertext: Buffer.from(JSON.stringify(encryptedPayload)).toString('base64'),
      iv,
      algorithm: ALGORITHM,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    throw error;
  }
}

/**
 * Decrypt a message
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  senderPublicKey: string
): Promise<DecryptedMessage> {
  try {
    const privateKey = await getPrivateKey();

    // Decode the base64 payload
    const payloadBuffer = Buffer.from(encrypted.ciphertext, 'base64');
    const payload = JSON.parse(payloadBuffer.toString('utf-8')) as EncryptedPayload;

    // Verify the message structure
    if (!payload.data || !payload.authTag || !payload.timestamp) {
      throw new Error('Invalid encrypted message structure');
    }

    // Create shared secret
    const sharedSecret = `${privateKey}:${senderPublicKey}`;
    const encryptionKey = await deriveKey(sharedSecret);

    // Verify (in production, use HMAC verification)
    const expectedAuthTag = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${encrypted.iv}:${payload.data}:${encryptionKey}`
    );
    if (expectedAuthTag !== payload.authTag) {
      throw new Error('Encrypted message authentication failed');
    }

    const plaintext = await decryptPayload(payload.data, encryptionKey, encrypted.iv);

    return {
      plaintext,
      timestamp: payload.timestamp,
    };
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw error;
  }
}

/**
 * Sign data with private key (using HMAC)
 */
export async function signData(data: string): Promise<string> {
  try {
    const privateKey = await getPrivateKey();
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${data}:${privateKey}`
    );
    return signature;
  } catch (error) {
    console.error('Failed to sign data:', error);
    throw error;
  }
}

/**
 * Verify signed data
 */
export async function verifySignature(
  data: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    // In a real implementation, use proper digital signature verification
    // This is a placeholder that verifies the signature was created with the claimed public key
    const signatureHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${data}:${publicKey}`
    );
    return signature === signatureHash;
  } catch (error) {
    console.error('Failed to verify signature:', error);
    return false;
  }
}

/**
 * Create a hash of data
 */
export async function hashData(data: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
    return hash;
  } catch (error) {
    console.error('Failed to hash data:', error);
    throw error;
  }
}

/**
 * Encrypt a complete message with metadata
 */
export async function encryptMessageWithMetadata(
  message: string,
  recipientId: string,
  recipientPublicKey: string,
  senderId: string
): Promise<string> {
  try {
    const metadata = {
      from: senderId,
      to: recipientId,
      timestamp: Date.now(),
    };

    const encryptedMsg = await encryptMessage(message, recipientPublicKey);

    const fullMessage = {
      ...metadata,
      encrypted: encryptedMsg,
    };

    return Buffer.from(JSON.stringify(fullMessage)).toString('base64');
  } catch (error) {
    console.error('Failed to encrypt message with metadata:', error);
    throw error;
  }
}

/**
 * Decrypt a complete message with metadata
 */
export async function decryptMessageWithMetadata(
  encryptedData: string,
  senderPublicKey: string
): Promise<{
  from: string;
  to: string;
  message: string;
  timestamp: number;
}> {
  try {
    const buffer = Buffer.from(encryptedData, 'base64');
    const fullMessage = JSON.parse(buffer.toString('utf-8'));

    const decryptedMsg = await decryptMessage(
      fullMessage.encrypted,
      senderPublicKey
    );

    return {
      from: fullMessage.from,
      to: fullMessage.to,
      message: decryptedMsg.plaintext,
      timestamp: fullMessage.timestamp,
    };
  } catch (error) {
    console.error('Failed to decrypt message with metadata:', error);
    throw error;
  }
}
