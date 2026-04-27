interface Packet {
  id: string;
  ttl: number;
}

const seen = new Set<string>();

export function handlePacket(
  packet: Packet,
  deliver: (packet: Packet) => void,
  relay: (packet: Packet) => void
) {
  if (seen.has(packet.id)) return;
  seen.add(packet.id);

  deliver(packet);

  if (packet.ttl > 0) {
    packet.ttl--;
    relay(packet);
  }
}
