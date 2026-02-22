import { BleTransport } from "./ble/bleTransport";
import { getOrCreateIdentity } from "./identity/identity";
import { MeshRouter } from "./mesh/router";
import { onTextMessage } from "./msg/service";
import { startVoice, stopVoice } from "./voice/Vc";

export async function initBackend() {
  const identity = await getOrCreateIdentity();
  const nodeId = identity.id;
  const transport = new BleTransport();
  const router = new MeshRouter(nodeId, transport);

  return {
    router,

    async onIncoming(packet: any) {
      const delivered = await router.handleIncoming(packet);
      if (!delivered) return;

      if (packet.type === "TEXT") onTextMessage(packet);
      if (packet.type === "VOICE_START") startVoice(packet);
      if (packet.type === "VOICE_END") stopVoice();
    },
  };
}
