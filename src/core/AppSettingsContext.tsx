import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import React, { createContext, useContext, useEffect, useState } from "react";
// import { supabase } from '../storage/supabase';

export interface AppSettings {
  deviceId: string;
  deviceName: string;
  theme: "dark" | "light";
  notificationsEnabled: boolean;
  connectionRequestsEnabled: boolean;
  requireConfirmation: boolean;
}

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  isLoaded: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  deviceId: "",
  deviceName: "Unknown Device",
  theme: "dark",
  notificationsEnabled: true,
  connectionRequestsEnabled: true,
  requireConfirmation: true,
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const SETTINGS_KEY = "@fortilink_settings";

function createDeviceName(deviceId: string): string {
  return `Agent-${deviceId.substring(0, 4).toUpperCase()}`;
}

async function loadOrCreateSettingsIdentity(
  storedSettings: Partial<AppSettings> | null
): Promise<AppSettings> {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...storedSettings };
  const existingDeviceId = storedSettings?.deviceId?.trim();
  const existingDeviceName = storedSettings?.deviceName?.trim();

  if (existingDeviceId) {
    const resolvedSettings: AppSettings = {
      ...mergedSettings,
      deviceId: existingDeviceId,
      deviceName: existingDeviceName || createDeviceName(existingDeviceId),
    };

    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(resolvedSettings));
    console.log(
      `[identity] loaded persistent device identity deviceId=${resolvedSettings.deviceId} deviceName=${resolvedSettings.deviceName}`
    );
    return resolvedSettings;
  }

  const deviceId = Crypto.randomUUID();
  const createdSettings: AppSettings = {
    ...mergedSettings,
    deviceId,
    deviceName: existingDeviceName || createDeviceName(deviceId),
  };

  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(createdSettings));
  console.log(
    `[identity] created persistent device identity deviceId=${createdSettings.deviceId} deviceName=${createdSettings.deviceName}`
  );
  return createdSettings;
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedStr = await AsyncStorage.getItem(SETTINGS_KEY);
      const storedSettings = storedStr ? (JSON.parse(storedStr) as Partial<AppSettings>) : null;
      const currentSettings = await loadOrCreateSettingsIdentity(storedSettings);

      setSettings(currentSettings);
      setIsLoaded(true);

      // Offline: No Supabase registration needed

    } catch (e) {
      console.error("Error loading app settings", e);
    }
  };



  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const { deviceId: ignoredDeviceId, ...restSettings } = newSettings;

      if (typeof ignoredDeviceId === "string" && ignoredDeviceId !== settings.deviceId) {
        console.log(
          `[identity] ignored deviceId update attempt; keeping persistent deviceId=${settings.deviceId}`
        );
      }

      const updated = { ...settings, ...restSettings };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

      // Offline: No Supabase sync needed

    } catch (e) {
      console.error("Error saving app settings", e);
    }
  };

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
}
