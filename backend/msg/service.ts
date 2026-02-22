import { MeshPacket } from '../mesh/packet';
import { saveMessage } from './chatStore';

export async function onTextMessage(
  packet: MeshPacket<{ text: string }>
) {
  await saveMessage(packet);
}
