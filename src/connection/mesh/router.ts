import { randomUUID } from 'expo-crypto';
import { MeshPacket, PacketType } from './packet';

export interface MeshTransport {
  sendPacket(packet: MeshPacket): Promise<void>;
}

export class MeshRouter {
  private seen = new Set<string>();

  constructor(
    private nodeId: string,
    private transport: MeshTransport
  ) {}

  createPacket<T>(
    to: string | '*',
    type: PacketType,
    payload: T,
    ttl = 5
  ): MeshPacket<T> {
    return {
      id: randomUUID(),
      from: this.nodeId,
      to,
      ttl,
      timestamp: Date.now(),
      type,
      payload,
    };
  }

  async handleIncoming(packet: MeshPacket) {
    if (this.seen.has(packet.id)) return;
    this.seen.add(packet.id);

    if (packet.to === this.nodeId || packet.to === '*') {
      return packet;
    }

    if (packet.ttl > 0) {
      await this.transport.sendPacket({
        ...packet,
        ttl: packet.ttl - 1,
      });
    }
  }
}
