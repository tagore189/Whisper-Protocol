export type PacketType = 'TEXT' | 'VOICE_START' | 'VOICE_END';

export interface MeshPacket<T = any> {
  id: string;
  from: string;
  to: string | '*';
  ttl: number;
  timestamp: number;
  type: PacketType;
  payload: T;
}
