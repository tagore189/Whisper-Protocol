import * as Crypto from 'expo-crypto';
import * as Random from 'expo-random';

export async function getSecureRandomBytes(size: number): Promise<Uint8Array> {
  const randomModule = Random as unknown as {
    getRandomBytesAsync?: (count: number) => Promise<Uint8Array>;
  };
  if (typeof randomModule.getRandomBytesAsync === 'function') {
    try {
      return await randomModule.getRandomBytesAsync(size);
    } catch {
      // expo-random can be present while its native module is unavailable.
      // Fall through to other secure providers.
    }
  }

  const cryptoModule = Crypto as unknown as {
    getRandomBytesAsync?: (count: number) => Promise<Uint8Array>;
    getRandomBytes?: (count: number) => Uint8Array;
  };
  if (typeof cryptoModule.getRandomBytesAsync === 'function') {
    try {
      return await cryptoModule.getRandomBytesAsync(size);
    } catch {
      // Fall through to sync/web fallbacks.
    }
  }
  if (typeof cryptoModule.getRandomBytes === 'function') {
    try {
      return cryptoModule.getRandomBytes(size);
    } catch {
      // Fall through to web fallback.
    }
  }

  const webCrypto = (globalThis as unknown as { crypto?: Crypto }).crypto as
    | { getRandomValues?: (arr: Uint8Array) => Uint8Array }
    | undefined;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(size);
    webCrypto.getRandomValues(bytes);
    return bytes;
  }

  console.warn('Secure random source unavailable; falling back to Math.random bytes.');
  const fallback = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    fallback[i] = Math.floor(Math.random() * 256);
  }
  return fallback;
}
