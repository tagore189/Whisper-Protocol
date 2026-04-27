import * as Crypto from 'expo-crypto';

export async function getSecureRandomBytes(size: number): Promise<Uint8Array> {
  return await Crypto.getRandomBytesAsync(size);
}
