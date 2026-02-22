import { Buffer } from "buffer";
import { getOrCreateIdentity } from "../identity/identity";
import { SERVICE_UUID, HANDSHAKE_CHAR_UUID } from "./types";
import type { Device } from "react-native-ble-plx";

export type WhisperPeer = {
  whisperId: string;
  name: string;
};

export async function performHandshake(device: Device): Promise<WhisperPeer> {
  const identity = await getOrCreateIdentity();

  const hello = {
    protocol: "whisper/1",
    id: identity.id,
    name: identity.name,
    timestamp: Date.now(),
  };

  const payload = Buffer.from(JSON.stringify(hello)).toString("base64");

  const services = await device.discoverAllServicesAndCharacteristics();
  const chars = await services.characteristicsForService(SERVICE_UUID);

  const handshakeChar = chars.find(
    (c) => c.uuid.toLowerCase() === HANDSHAKE_CHAR_UUID
  );

  if (!handshakeChar) {
    throw new Error("Whisper handshake characteristic missing");
  }

  // Send our identity
  await handshakeChar.writeWithResponse(payload);

  // Read peer identity
  const response = await handshakeChar.read();
  if (!response.value) throw new Error("Handshake failed");

  const decoded = JSON.parse(
    Buffer.from(response.value, "base64").toString()
  );

  if (decoded.protocol !== "whisper/1") {
    throw new Error("Invalid Whisper peer");
  }

  return {
    whisperId: decoded.id,
    name: decoded.name,
  };
}
