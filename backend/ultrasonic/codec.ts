import { Buffer } from "buffer";
import { MeshPacket } from "../mesh/packet";

// -----------------------------------------------------------------------------
// Simple FSK-based encoder/decoder for ultrasonic packets
//
// This module provides a very naive proof-of-concept implementation.  A real
// production system would need a much more robust modulation/demodulation
// algorithm, error correction, preamble/sync, bandwidth management, etc.
// The code below is intentionally simple so that you can understand the
// flow; it may not work reliably on real hardware without tuning.
// -----------------------------------------------------------------------------

const SAMPLE_RATE = 22050; // samples per second (expo-av supports this)
const BIT_DURATION = 0.04; // seconds per bit (~25 bits/second)
const SAMPLES_PER_BIT = Math.floor(SAMPLE_RATE * BIT_DURATION);
const FREQ_ZERO = 18000; // tone for bit 0
const FREQ_ONE = 19000; // tone for bit 1

function stringToBits(str: string): number[] {
  const bits: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    for (let b = 0; b < 8; b++) {
      bits.push((chr >> b) & 1);
    }
  }
  return bits;
}

function bitsToString(bits: number[]): string {
  let chars = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      if (bits[i + b]) byte |= 1 << b;
    }
    chars.push(String.fromCharCode(byte));
  }
  return chars.join("");
}

export function encodePacket(packet: MeshPacket): string {
  // convert packet to base64 so we stay in printable range
  const json = JSON.stringify(packet);
  const b64 = Buffer.from(json).toString("base64");
  const bits = stringToBits(b64);

  // generate PCM samples (Float32) containing the alternating tones
  const totalSamples = bits.length * SAMPLES_PER_BIT;
  const samples = new Float32Array(totalSamples);

  for (let i = 0; i < bits.length; i++) {
    const freq = bits[i] ? FREQ_ONE : FREQ_ZERO;
    for (let j = 0; j < SAMPLES_PER_BIT; j++) {
      const t = (i * SAMPLES_PER_BIT + j) / SAMPLE_RATE;
      samples[i * SAMPLES_PER_BIT + j] = Math.sin(2 * Math.PI * freq * t);
    }
  }

  // convert Float32Array to 16-bit PCM and wrap in WAV header
  const wav = float32ToWav(samples, SAMPLE_RATE);
  return wav; // base64 encoded WAV data without the prefix
}

export function decodeSamples(raw: Float32Array): MeshPacket | null {
  // split the incoming stream into bit-sized chunks and decide which
  // frequency dominates each slot by simple energy correlation.
  const numBits = Math.floor(raw.length / SAMPLES_PER_BIT);
  const bits: number[] = [];

  for (let i = 0; i < numBits; i++) {
    let e0 = 0;
    let e1 = 0;
    for (let j = 0; j < SAMPLES_PER_BIT; j++) {
      const sample = raw[i * SAMPLES_PER_BIT + j];
      const t = j / SAMPLE_RATE;
      e0 += sample * Math.sin(2 * Math.PI * FREQ_ZERO * t);
      e1 += sample * Math.sin(2 * Math.PI * FREQ_ONE * t);
    }
    bits.push(e1 > e0 ? 1 : 0);
  }

  const b64 = bitsToString(bits);
  try {
    const json = Buffer.from(b64, "base64").toString();
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

// helper to wrap a Float32Array of samples in a WAV container
export function float32ToWav(input: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + input.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */ writeString(view, 0, "RIFF");
  /* file length */ view.setUint32(4, 36 + input.length * 2, true);
  /* RIFF type */ writeString(view, 8, "WAVE");
  /* format chunk identifier */ writeString(view, 12, "fmt ");
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, 1, true);
  /* channel count */ view.setUint16(22, 1, true);
  /* sample rate */ view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * blockAlign) */ view.setUint32(28, sampleRate * 2, true);
  /* block align (channelCount * bytesPerSample) */ view.setUint16(32, 2, true);
  /* bits per sample */ view.setUint16(34, 16, true);
  /* data chunk identifier */ writeString(view, 36, "data");
  /* data chunk length */ view.setUint32(40, input.length * 2, true);

  // write the PCM samples
  let offset = 44;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  // return base64 string of the WAV file (without data URI prefix)
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
