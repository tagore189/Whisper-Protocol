import React, { useEffect } from "react";
import { Alert } from "react-native";
import { type Href, useRouter } from "expo-router";
import { useAppSettings } from '../src/core/AppSettingsContext';
import { onMessageReceived } from "../src/connection/ble/bleMessaging";
import { MeshPacket } from "../src/connection/mesh/packet";

export function ConnectionRequestListener() {
  const { settings } = useAppSettings();
  const router = useRouter();

  useEffect(() => {
    if (!settings.deviceId) return;

    const handlePacket = (packet: MeshPacket) => {
      if (packet.type === 'HANDSHAKE' && packet.to === settings.deviceId) {
        const status = packet.payload?.status;
        if (status === 'hello') {
           const senderName = packet.payload?.name || packet.from.slice(-8);
           
           Alert.alert(
            "Connection Request",
            `${senderName} wants to connect with you.`,
            [
              { text: "Dismiss", style: "cancel" },
              {
                text: "View Connections",
                onPress: () => router.push("/network" as Href),
              },
            ]
          );
        }
      }
    };

    onMessageReceived(handlePacket);
  }, [settings.deviceId, router]);

  return null; // Headless component
}
