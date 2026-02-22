import * as Crypto from 'expo-crypto';
import * as Random from 'expo-random';

export async function getSecureRandomBytes(size: number): Promise<Uint8Array> {
  const randomModule = Random as unknown as {
    getRandomBytesAsync?: (count: number) => Promise<Uint8Array>;
  };
  if (typeof randomModule.getRandomBytesAsync === 'function') {
    return randomModule.getRandomBytesAsync(size);
  }

  const cryptoModule = Crypto as unknown as {
    getRandomBytesAsync?: (count: number) => Promise<Uint8Array>;
    getRandomBytes?: (count: number) => Uint8Array;
  };
  if (typeof cryptoModule.getRandomBytesAsync === 'function') {
    return cryptoModule.getRandomBytesAsync(size);
  }
  if (typeof cryptoModule.getRandomBytes === 'function') {
    return cryptoModule.getRandomBytes(size);
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
