import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BleConnectionProvider } from "../contexts/BleConnectionContext";
import { TransportSettingsProvider } from "../contexts/TransportSettingsContext";
import "../src/polyfills";

export default function RootLayout() {
  return (
    <TransportSettingsProvider>
      <BleConnectionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="idgen" />
          <Stack.Screen name="radar" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chatroom" />
        </Stack>
        <StatusBar style="light" />
      </BleConnectionProvider>
    </TransportSettingsProvider>
  );
}
