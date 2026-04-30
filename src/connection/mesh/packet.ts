export type PacketType = 'TEXT' | 'VOICE_START' | 'VOICE_END' | 'ULTRASONIC' | 'ACK' | 'HANDSHAKE' | 'connection_request' | 'connection_accepted' | 'connection_rejected' | 'message';

export interface MeshPacket<T = any> {
  id: string;
  from: string;
  to: string | '*';
  ttl: number;
  timestamp: number;
  type: PacketType;
  payload: T;
}
