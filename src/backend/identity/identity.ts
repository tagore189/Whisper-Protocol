import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureRandomBytes } from '../crypto/randomBytes';

interface Identity {
  nodeId: string;
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const stored = await AsyncStorage.getItem('IDENTITY');
  if (stored) return JSON.parse(stored) as Identity;

  const bytes = await getSecureRandomBytes(16);
  const nodeId = Buffer.from(bytes).toString('hex');

  const identity = { nodeId };
  await AsyncStorage.setItem('IDENTITY', JSON.stringify(identity));

  return identity;
}
