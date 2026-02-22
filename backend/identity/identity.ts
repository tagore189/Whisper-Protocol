import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IDENTITY_KEY = "WHISPER_IDENTITY";

export type Identity = {
  id: string;
  name: string;
  createdAt: number;
};

function generateName() {
  const animals = ["Fox", "Otter", "Wolf", "Hawk", "Raven", "Tiger"];
  return `Whisper-${animals[Math.floor(Math.random() * animals.length)]}`;
}

export async function getOrCreateIdentity(): Promise<Identity> {
  const stored = await AsyncStorage.getItem(IDENTITY_KEY);
  if (stored) return JSON.parse(stored);

  const id = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}`
  );

  const identity: Identity = {
    id,
    name: generateName(),
    createdAt: Date.now(),
  };

  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}
