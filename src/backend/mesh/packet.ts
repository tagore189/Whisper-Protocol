interface PacketData {
  from: string;
  to: string;
  payload: any;
}

interface Packet {
  id: string;
  from: string;
  to: string;
  ttl: number;
  timestamp: number;
  payload: any;
}

export function createPacket({ from, to, payload }: PacketData): Packet {
  return {
    id: Math.random().toString(36).slice(2),
    from,
    to,
    ttl: 4,
    timestamp: Date.now(),
    payload,
  };
}
