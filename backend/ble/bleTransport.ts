import { Buffer } from "buffer";
import { MeshPacket } from "../mesh/packet";
import { MeshTransport } from "../mesh/router";
import { getBleManager } from "./bleManager";
import { CHAR_UUID, SERVICE_UUID } from "./types";

export class BleTransport implements MeshTransport {
  async sendPacket(packet: MeshPacket): Promise<void> {
    const { bleManager } = getBleManager();
    if (!bleManager) return;

    const data = Buffer.from(JSON.stringify(packet)).toString("base64");

    try {
      const devices = await bleManager.connectedDevices([SERVICE_UUID]);
      for (const device of devices) {
        try {
          await device.writeCharacteristicWithResponseForService(
            SERVICE_UUID,
            CHAR_UUID,
            data
          );
        } catch {
          // ignore unreachable or incompatible devices
        }
      }
    } catch {
      // no connected devices with our service
    }
  }
}
