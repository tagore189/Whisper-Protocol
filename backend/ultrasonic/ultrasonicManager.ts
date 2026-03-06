import { EventEmitter } from "events";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { MeshPacket } from "../mesh/packet";
import { decodeSamples, encodePacket } from "./codec";

/**
 * UltrasonicManager handles playing and recording of ultrasonic data.  The
 * implementation here is bootstrapped with a naive FSK codec (see
 * codec.ts); the real-world reliability of the codec should be verified on
 * actual devices and improved as necessary.
 */
class UltrasonicManager {
  private emitter = new EventEmitter();
  private recording: Audio.Recording | null = null;
  private processing = false;

  constructor() {
    // nothing yet
  }

  /**
   * register a callback to be invoked when a full mesh packet has been
   * received.  Callers (e.g. UltrasonicTransport) will forward this to the
   * mesh router.
   */
  onPacket(cb: (packet: MeshPacket) => void) {
    this.emitter.on("packet", cb);
  }

  /**
   * Encode and play a packet.  The encode step returns a WAV file as a
   * base64 string; expo-av accepts data URI input.
   */
  async playPacket(packet: MeshPacket) {
    const wavB64 = encodePacket(packet);
    const uri = `data:audio/wav;base64,${wavB64}`;

    // ensure audio mode allows playback in silent mode
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        // if we "hear" our own packet we push it back through the emitter.
        // when two physical devices exchange audio the recording/processing
        // path below will cause the peer to emit the packet instead.
        this.emitter.emit("packet", packet);
        sound.unloadAsync().catch(() => {});
      }
    });

    await sound.playAsync();
  }

  /**
   * start a background recording session that will periodically examine the
   * captured buffer and attempt to decode packets.  The decode step is
   * relatively expensive so we only run it once per second for now.
   */
  async startListening() {
    if (this.recording) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (!status.granted) throw new Error("microphone permission denied");

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await this.recording.startAsync();

      // schedule processing loop
      this.processing = true;
      this.processLoop();
    } catch (e) {
      console.warn("ultrasonic: failed to start listening", e);
    }
  }

  async stopListening() {
    if (!this.recording) return;
    this.processing = false;
    try {
      await this.recording.stopAndUnloadAsync();
    } catch {}
    this.recording = null;
  }

  private async processLoop() {
    while (this.processing && this.recording) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const uri = this.recording.getURI();
        if (!uri) continue;

        // read file as base64 so we can get raw samples
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const raw = base64ToFloat32Array(b64);
        const packet = decodeSamples(raw);
        if (packet) {
          this.emitter.emit("packet", packet);
        }
      } catch (e) {
        console.warn("ultrasonic: processing error", e);
      }
    }
  }
}

const manager = new UltrasonicManager();
export { manager as ultrasonicManager };

/**
 * helper that converts WAV file encoded in base64 into Float32 samples.
 * this implementation only supports 16-bit mono WAV; it is sufficient for
 * the codec produced by encodePacket above.
 */
function base64ToFloat32Array(b64: string): Float32Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // skip wav header (44 bytes)
  const samples = new Float32Array((bytes.length - 44) / 2);
  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    const lo = bytes[index++];
    const hi = bytes[index++];
    const val = (hi << 8) | lo;
    samples[i] = val > 0x7fff ? (val - 0x10000) / 0x8000 : val / 0x7fff;
  }
  return samples;
}
