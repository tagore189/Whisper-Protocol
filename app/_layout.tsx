import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { startScanAndConnect, startGattServer } from '../src/connection/ble/bleTransport';
import { BleConnectionProvider } from '../src/connection/BleConnectionContext';
import { AppSettingsProvider, useAppSettings } from '../src/core/AppSettingsContext';
import "../src/core/polyfills";

/**
 * Manages the delayed startup of BLE services.
 */
function BLEInitializer() {
  const { settings } = useAppSettings();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current || !settings.deviceId) return;
    hasStarted.current = true;
    
    const timer = setTimeout(() => {
      console.log('[BLEInitializer] Starting BLE services...');
      startScanAndConnect().catch(err => console.error('[BLE] Scan Error:', err));
      startGattServer(`FortiLink-${settings.deviceId.slice(-6)}`).catch(err => console.error('[BLE] Server Error:', err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [settings.deviceId]);

  return null;
}

/**
 * Main Content Wrapper
 */
function RootContent() {
  const { isLoaded } = useAppSettings();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F1A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6961ff" />
      </View>
    );
  }

  return (
    <BleConnectionProvider>
      <BLEInitializer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="idgen" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chatroom" />
      </Stack>
    </BleConnectionProvider>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <RootContent />
      <StatusBar style="light" />
    </AppSettingsProvider>
  );
}
