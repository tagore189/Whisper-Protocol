import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppSettingsProvider } from '../src/core/AppSettingsContext';
import { BleConnectionProvider } from '../src/connection/BleConnectionContext';
import { ConnectionRequestListener } from "../components/ConnectionRequestListener";
import "../src/polyfills";

export default function RootLayout() {
  return (
    <AppSettingsProvider>
        <BleConnectionProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="idgen" />
            <Stack.Screen name="radar" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chatroom" />
          </Stack>
          <ConnectionRequestListener />
          <StatusBar style="light" />
        </BleConnectionProvider>
    </AppSettingsProvider>
  );
}
