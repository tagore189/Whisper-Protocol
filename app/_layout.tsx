import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ConnectionRequestListener } from "../components/ConnectionRequestListener";
import { startScanAndConnect } from '../src/connection/ble/bleTransport';
import { BleConnectionProvider } from '../src/connection/BleConnectionContext';
import { AppSettingsProvider } from '../src/core/AppSettingsContext';
import "../src/core/polyfills";

export default function RootLayout() {
  useEffect(() => {
    // Start BLE scanning on app load
    console.log('[RootLayout] Starting BLE scan and connect');
    startScanAndConnect().catch(error => {
      console.error('[RootLayout] Failed to start BLE:', error);
    });
  }, []);

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
