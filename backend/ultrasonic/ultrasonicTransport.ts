import { MeshPacket } from "../mesh/packet";
import { MeshTransport } from "../mesh/router";
import { ultrasonicManager } from "./ultrasonicManager";

/**
 * Transport implementation that sends/receives mesh packets via an
 * ultrasonic audio channel.  The codec lives in codec.ts and manager is
 * responsible for platform-specific playback/recording.
 */
export class UltrasonicTransport implements MeshTransport {
  private receiveCallback?: (pkt: MeshPacket) => void;

  constructor() {
    // make sure the manager is listening and forward any incoming packet
    ultrasonicManager.onPacket((pkt) => {
      if (this.receiveCallback) this.receiveCallback(pkt);
    });
    ultrasonicManager.startListening().catch(() => {});
  }

  async sendPacket(packet: MeshPacket): Promise<void> {
    await ultrasonicManager.playPacket(packet);
  }

  /**
   * MeshRouter cannot natively push a packet to the transport; the caller
   * (usually whoever constructs the transport) should wire this up if they
   * want to receive traffic.
   */
  setOnReceive(cb: (pkt: MeshPacket) => void) {
    this.receiveCallback = cb;
  }
}
