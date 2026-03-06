import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = '@app_signal_protocol:transport';

export type TransportSettings = {
  useUltrasonic: boolean;
};

const defaultSettings: TransportSettings = {
  useUltrasonic: false,
};

type ContextValue = {
  settings: TransportSettings;
  setSettings: (s: TransportSettings) => void;
};

const TransportSettingsContext = createContext<ContextValue | null>(null);

export function TransportSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<TransportSettings>(defaultSettings);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setSettingsState(JSON.parse(raw));
        }
      } catch (e) {
        console.warn("failed to load transport settings", e);
      }
    })();
  }, []);

  const setSettings = async (s: TransportSettings) => {
    setSettingsState(s);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("failed to persist transport settings", e);
    }
  };

  return (
    <TransportSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </TransportSettingsContext.Provider>
  );
}

export function useTransportSettings(): ContextValue {
  const ctx = useContext(TransportSettingsContext);
  if (!ctx) {
    throw new Error("useTransportSettings must be used within a TransportSettingsProvider");
  }
  return ctx;
}
