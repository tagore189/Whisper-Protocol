export type WhisperHandshake = {
  protocol: "whisper/1";
  id: string;
  ts: number;
};

export function encodeHandshake(identityId: string): string {
  const payload: WhisperHandshake = {
    protocol: "whisper/1",
    id: identityId,
    ts: Date.now(),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeHandshake(base64: string): WhisperHandshake | null {
  try {
    const json = Buffer.from(base64, "base64").toString("utf8");
    const data = JSON.parse(json);
    if (data.protocol !== "whisper/1") return null;
    return data;
  } catch {
    return null;
  }
}
