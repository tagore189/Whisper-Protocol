import { EventEmitter } from "events";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { MeshPacket } from "../mesh/packet";
import { decodeSamples, encodePacket, float32ToWav } from "./codec";

const SAMPLE_RATE = 22050;
const CARRIER_FREQ = 20000; // 20kHz carrier for voice

/**
 * UltrasonicManager handles playing and recording of ultrasonic data.  The
 * implementation here is bootstrapped with a naive FSK codec (see
 * codec.ts); the real-world reliability of the codec should be verified on
 * actual devices and improved as necessary.
 */
class UltrasonicManager {
  private emitter = new EventEmitter();
  private voiceRecording: Audio.Recording | null = null;
  private voiceTransmitting = false;
  private voiceReceiving = false;
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
   * register a callback for incoming voice audio data (raw Float32Array samples)
   */
  onVoiceData(cb: (samples: Float32Array) => void) {
    this.emitter.on("voiceData", cb);
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
      if (status.isLoaded && status.didJustFinish) {
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
    if (this.voiceRecording) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (!status.granted) throw new Error("microphone permission denied");

      this.voiceRecording = new Audio.Recording();
      await this.voiceRecording.prepareToRecordAsync();
      await this.voiceRecording.startAsync();

      // schedule processing loop
      this.processing = true;
      this.processLoop();
    } catch (e) {
      console.warn("ultrasonic: failed to start listening", e);
    }
  }

  async stopListening() {
    if (!this.voiceRecording) return;
    this.processing = false;
    try {
      await this.voiceRecording.stopAndUnloadAsync();
    } catch {}
    this.voiceRecording = null;
  }

  /**
   * Start voice transmission: capture mic, modulate to ultrasonic, play continuously
   */
  async startVoiceTransmission() {
    if (this.voiceTransmitting) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (!status.granted) throw new Error("microphone permission denied");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      this.voiceRecording = new Audio.Recording();
      await this.voiceRecording.prepareToRecordAsync();
      await this.voiceRecording.startAsync();

      this.voiceTransmitting = true;
      this.voiceTransmitLoop();
    } catch (e) {
      console.warn("ultrasonic: failed to start voice transmission", e);
    }
  }

  /**
   * Stop voice transmission
   */
  async stopVoiceTransmission() {
    if (!this.voiceTransmitting) return;
    this.voiceTransmitting = false;
    if (this.voiceRecording) {
      try {
        await this.voiceRecording.stopAndUnloadAsync();
      } catch {}
      this.voiceRecording = null;
    }
  }

  /**
   * Start voice reception: record ultrasonic, demodulate, emit voice data
   */
  async startVoiceReception() {
    if (this.voiceReceiving) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      this.voiceRecording = new Audio.Recording();
      await this.voiceRecording.prepareToRecordAsync();
      await this.voiceRecording.startAsync();

      this.voiceReceiving = true;
      this.voiceReceiveLoop();
    } catch (e) {
      console.warn("ultrasonic: failed to start voice reception", e);
    }
  }

  /**
   * Stop voice reception
   */
  async stopVoiceReception() {
    if (!this.voiceReceiving) return;
    this.voiceReceiving = false;
    if (this.voiceRecording) {
      try {
        await this.voiceRecording.stopAndUnloadAsync();
      } catch {}
      this.voiceRecording = null;
    }
  }

  private async processLoop() {
    while (this.processing && this.voiceRecording) {
      await new Promise(r => setTimeout(r, 1000)); // Process every second

      try {
        const uri = this.voiceRecording.getURI();
        if (!uri) continue;

        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const samples = base64ToFloat32Array(b64);

        // Try to decode ultrasonic packets
        const packet = decodeSamples(samples);
        if (packet) {
          this.emitter.emit("packet", packet);
        }
      } catch (e) {
        console.warn("ultrasonic processing error", e);
      }
    }
  }

  private async voiceTransmitLoop() {
    while (this.voiceTransmitting && this.voiceRecording) {
      await new Promise(r => setTimeout(r, 100)); // 10Hz chunks

      try {
        const uri = this.voiceRecording.getURI();
        if (!uri) continue;

        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const voiceSamples = base64ToFloat32Array(b64);

        // modulate voice to ultrasonic carrier
        const modulated = modulateVoiceToUltrasonic(voiceSamples);

        // play modulated audio
        await this.playModulatedAudio(modulated);
      } catch (e) {
        console.warn("voice transmit error", e);
      }
    }
  }

  private async voiceReceiveLoop() {
    while (this.voiceReceiving && this.voiceRecording) {
      await new Promise(r => setTimeout(r, 100));

      try {
        const uri = this.voiceRecording.getURI();
        if (!uri) continue;

        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const ultrasonicSamples = base64ToFloat32Array(b64);

        // demodulate ultrasonic to voice
        const voiceSamples = demodulateUltrasonicToVoice(ultrasonicSamples);

        // emit voice data
        this.emitter.emit("voiceData", voiceSamples);
      } catch (e) {
        console.warn("voice receive error", e);
      }
    }
  }

  private async playModulatedAudio(samples: Float32Array) {
    // convert to WAV and play
    const wav = float32ToWav(samples, SAMPLE_RATE);
    const uri = `data:audio/wav;base64,${wav}`;

    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
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

/**
 * Modulate voice samples to ultrasonic carrier using AM modulation
 */
function modulateVoiceToUltrasonic(voiceSamples: Float32Array): Float32Array {
  const modulated = new Float32Array(voiceSamples.length);
  for (let i = 0; i < voiceSamples.length; i++) {
    const t = i / SAMPLE_RATE;
    const carrier = Math.sin(2 * Math.PI * CARRIER_FREQ * t);
    modulated[i] = voiceSamples[i] * carrier; // AM modulation
  }
  return modulated;
}

/**
 * Demodulate ultrasonic samples back to voice using envelope detection
 */
function demodulateUltrasonicToVoice(ultrasonicSamples: Float32Array): Float32Array {
  // simple envelope detection for AM demodulation
  const voice = new Float32Array(ultrasonicSamples.length);
  for (let i = 0; i < ultrasonicSamples.length; i++) {
    voice[i] = Math.abs(ultrasonicSamples[i]); // rectify
  }
  // low-pass filter to remove carrier (simple moving average)
  const windowSize = Math.floor(SAMPLE_RATE / CARRIER_FREQ);
  for (let i = windowSize; i < voice.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += voice[i - j];
    }
    voice[i] = sum / windowSize;
  }
  return voice;
}
