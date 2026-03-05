import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureRandomBytes } from '../crypto/randomBytes';

interface Identity {
  nodeId: string;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const stored = await AsyncStorage.getItem('IDENTITY');
  if (stored) return JSON.parse(stored) as Identity;

  const bytes = await getSecureRandomBytes(16);
  const nodeId = bytesToHex(bytes);

  const identity = { nodeId };
  await AsyncStorage.setItem('IDENTITY', JSON.stringify(identity));

  return identity;
}
