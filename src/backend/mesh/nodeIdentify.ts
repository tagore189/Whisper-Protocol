// nodeIdentity.ts
import { getSecureRandomBytes } from '../crypto/randomBytes';

export const createNodeId = async () => {
  const bytes = await getSecureRandomBytes(16);
  return Buffer.from(bytes).toString('hex');
};
