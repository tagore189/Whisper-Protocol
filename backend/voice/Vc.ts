import { MeshPacket } from '../mesh/packet';

export function startVoice(packet: MeshPacket) {
  console.log('🎤 Voice start from', packet.from);
}

export function stopVoice() {
  console.log('🛑 Voice stopped');
}
