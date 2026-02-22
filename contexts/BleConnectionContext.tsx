import React, { createContext, useCallback, useContext, useState } from "react";

export type ConnectedDevice = {
  id: string;
  name: string;
};

type BleConnectionContextValue = {
  connectedDevices: ConnectedDevice[];
  addConnected: (device: ConnectedDevice) => void;
  removeConnected: (deviceId: string) => void;
  isConnected: (deviceId: string) => boolean;
};

const BleConnectionContext = createContext<BleConnectionContextValue | null>(null);

export function BleConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);

  const addConnected = useCallback((device: ConnectedDevice) => {
    setConnectedDevices((prev) => {
      if (prev.some((d) => d.id === device.id)) return prev;
      return [...prev, device];
    });
  }, []);

  const removeConnected = useCallback((deviceId: string) => {
    setConnectedDevices((prev) => prev.filter((d) => d.id !== deviceId));
  }, []);

  const isConnected = useCallback(
    (deviceId: string) => connectedDevices.some((d) => d.id === deviceId),
    [connectedDevices]
  );

  return (
    <BleConnectionContext.Provider
      value={{
        connectedDevices,
        addConnected,
        removeConnected,
        isConnected,
      }}
    >
      {children}
    </BleConnectionContext.Provider>
  );
}

export function useBleConnections(): BleConnectionContextValue {
  const ctx = useContext(BleConnectionContext);
  if (!ctx) {
    return {
      connectedDevices: [],
      addConnected: () => {},
      removeConnected: () => {},
      isConnected: () => false,
    };
  }
  return ctx;
}
