import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../src/supabase";

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

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedStr = await AsyncStorage.getItem(SETTINGS_KEY);
      let currentSettings = storedStr ? JSON.parse(storedStr) : null;

      if (!currentSettings || !currentSettings.deviceId) {
        // Generate new Device ID on first launch
        const newId = Crypto.randomUUID();
        const initialName = `Agent-${newId.substring(0, 4).toUpperCase()}`;
        currentSettings = { ...DEFAULT_SETTINGS, deviceId: newId, deviceName: initialName };
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
      } else {
        currentSettings = { ...DEFAULT_SETTINGS, ...currentSettings };
      }

      setSettings(currentSettings);
      setIsLoaded(true);

      // Register or update device on Supabase
      registerDeviceOnSupabase(currentSettings.deviceId, currentSettings.deviceName);
    } catch (e) {
      console.error("Error loading app settings", e);
    }
  };

  const registerDeviceOnSupabase = async (deviceId: string, deviceName: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .upsert({ device_id: deviceId, device_name: deviceName }, { onConflict: "device_id" });
      
      if (error) {
        console.error("Error syncing to Supabase users table:", error);
      }
    } catch (err) {
      console.error("Supabase unreachable:", err);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

      if (newSettings.deviceName && newSettings.deviceName !== settings.deviceName) {
        registerDeviceOnSupabase(updated.deviceId, updated.deviceName);
      }
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
