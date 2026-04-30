import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Crypto from "expo-crypto";
import { useAppSettings } from "../core/AppSettingsContext";
import { onMessageReceived, sendMessageBLE } from "./ble/bleMessaging";
import { connectDirectly, connectToDeviceById, connectViaQRPayload, isConnected as isBLEConnected, onConnectionStateChange } from "./ble/bleTransport";
import type { MeshPacket } from "./mesh/packet";
import { localDatabase } from "../storage/localDatabase";
import { ConnectionRequestModal, ConnectionRequestData } from '../components/ConnectionRequestModal';

export type HandshakeState =
  | "IDLE"
  | "HELLO"
  | "ACK"
  | "READY"
  | "CONNECTED"
  | "FAILED";

export type ConnectedDevice = {
  id: string;
  name: string;
  handshakeState: HandshakeState;
  retryCount: number;
  lastError?: string;
};

type BleConnectionContextValue = {
  connectedDevices: ConnectedDevice[];
  handshakeDevices: ConnectedDevice[];
  requestConnectionFromScan: (device: { id: string; name: string }) => Promise<{peerId: string; peerName: string}>;
  connectDirectlySkipHandshake: (device: { id: string; name: string; advertisedName: string; serviceUUID: string; sessionToken: string; timestamp: number }) => Promise<void>;
  removeConnected: (deviceId: string) => void;
  isConnected: (deviceId: string) => boolean;
  getConnectionState: (deviceId: string) => HandshakeState;
  canOpenChat: (deviceId: string) => boolean;
  globalBleState: string;
};

const BleConnectionContext = createContext<BleConnectionContextValue | null>(null);

const HANDSHAKE_TIMEOUT_MS = 30_000;
const HANDSHAKE_MAX_RETRIES = 3;
const STALE_CONNECTION_MS = 600_000;

export function BleConnectionProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const [devicesById, setDevicesById] = useState<Record<string, ConnectedDevice>>({});
  const devicesByIdRef = useRef<Record<string, ConnectedDevice>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const [globalBleState, setGlobalBleState] = useState<string>('disconnected');
  const [incomingRequest, setIncomingRequest] = useState<{ packet: MeshPacket; data: ConnectionRequestData } | null>(null);

  useEffect(() => {
    devicesByIdRef.current = devicesById;
  }, [devicesById]);

  const updatePeer = useCallback(
    (
      peerId: string,
      updater: (prev?: ConnectedDevice) => ConnectedDevice | null
    ) => {
      setDevicesById((prev) => {
        const nextValue = updater(prev[peerId]);
        if (!nextValue) {
          const next = { ...prev };
          delete next[peerId];
          return next;
        }
        return {
          ...prev,
          [peerId]: nextValue,
        };
      });
    },
    []
  );

  const setPeerState = useCallback(
    (
      peerId: string,
      peerName: string,
      handshakeState: HandshakeState,
      extras?: Partial<ConnectedDevice>
    ) => {
      updatePeer(peerId, (prev) => {
        const next: ConnectedDevice = {
          id: peerId,
          name: extras?.name || prev?.name || peerName || peerId.slice(-8),
          handshakeState,
          retryCount: extras?.retryCount ?? prev?.retryCount ?? 0,
          lastError: extras?.lastError ?? prev?.lastError,
        };
        
        // Persist to local database
        void localDatabase.upsertDevice({
          id: peerId,
          name: next.name,
          handshakeState: next.handshakeState,
          lastSeen: Date.now(),
        });

        return next;
      });
    },
    [updatePeer]
  );

  const clearPeerTimer = useCallback((peerId: string) => {
    const existing = timersRef.current.get(peerId);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(peerId);
    }
  }, []);

  const processPacket = useCallback(async (packet: MeshPacket) => {
    if (!settings.deviceId || (packet.to !== settings.deviceId && packet.to !== '*')) {
      return;
    }
    console.log('[handshake] Processing packet:', packet.id, packet.type, packet.payload);
    const peerId = packet.from;
    const peerName = packet.payload?.name || packet.payload?.fromDeviceName || peerId.slice(-8);

    if (packet.type === 'connection_request') {
      console.log(`[handshake] Incoming connection request from ${peerId}`);
      setIncomingRequest({
        packet,
        data: {
          fromDeviceId: peerId,
          fromDeviceName: peerName,
        }
      });
      return;
    }

    if (packet.type === 'connection_accepted') {
      console.log(`[handshake] Connection accepted by ${peerId}`);
      setPeerState(peerId, peerName, 'CONNECTED');
      return;
    }

    if (packet.type === 'connection_rejected') {
      console.log(`[handshake] Connection rejected by ${peerId}`);
      setPeerState(peerId, peerName, 'FAILED', { lastError: 'Connection rejected' });
      return;
    }

    if (packet.type !== 'HANDSHAKE') return;
  }, [settings.deviceId, setPeerState]);

  // Listen for incoming packets
  useEffect(() => {
    const unsubscribe = onMessageReceived(processPacket);
    return () => unsubscribe();
  }, [processPacket]);

  // Listen to low-level BLE transport state
  useEffect(() => {
    onConnectionStateChange((state) => {
      console.log('[BleConnectionContext] Global Connection State:', state);
      setGlobalBleState(state);
      if (state === 'disconnected') {
        Object.values(devicesByIdRef.current).forEach(d => {
          if (d.handshakeState === 'CONNECTED') {
            setPeerState(d.id, d.name, 'FAILED', { lastError: 'BLE device disconnected' });
          }
        });
      }
    });
  }, [setPeerState]);

  // Load existing connections from local DB
  useEffect(() => {
    const loadLocal = async () => {
      const devices = await localDatabase.getDevices();
      devices.forEach(d => {
        if (d.handshakeState && d.handshakeState !== 'IDLE') {
          setPeerState(d.id, d.name || d.id.slice(-8), d.handshakeState as HandshakeState);
        }
      });
    };
    loadLocal();
  }, [setPeerState]);

  const requestConnectionFromScan = useCallback(
    (device: { id: string; name: string }) => {
      return new Promise<{peerId: string; peerName: string}>(async (resolve, reject) => {
        if (!settings.deviceId) return reject(new Error('Identity unavailable'));

        console.log('[ble-connect] Starting scan→BLE connect to peer:', device.id);
        clearPeerTimer(device.id);

        try {
          const ok = await connectToDeviceById(device.id);
          if (!ok) throw new Error('Physical connection failed');

          console.log('[ble-connect] Connected physically to peer:', device.id, 'sending connection request');

          const requestId = Crypto.randomUUID();
          const packet: MeshPacket = {
            id: Crypto.randomUUID(),
            from: settings.deviceId,
            to: '*',
            ttl: 4,
            timestamp: Date.now(),
            type: 'connection_request',
            payload: {
              requestId,
              targetBleId: device.id,
              fromDeviceId: settings.deviceId,
              fromDeviceName: settings.deviceName || 'Unknown',
              timestamp: Date.now(),
            },
          };
          
          let resolved = false;

          const unsubscribe = onMessageReceived((response) => {
            if (resolved) return;
            if (response.type === 'connection_accepted' && response.payload?.requestId === requestId) {
              resolved = true;
              unsubscribe();
              clearTimeout(timeoutId);
              const peerId = response.from;
              const peerName = response.payload?.fromDeviceName || peerId.slice(-8);
              setPeerState(peerId, peerName, 'CONNECTED');
              resolve({ peerId, peerName });
            } else if (response.type === 'connection_rejected' && response.payload?.requestId === requestId) {
              resolved = true;
              unsubscribe();
              clearTimeout(timeoutId);
              reject(new Error('Connection rejected by peer'));
            }
          });

          const timeoutId = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            unsubscribe();
            reject(new Error('Connection request timed out'));
          }, 30000);

          await sendMessageBLE(packet);
        } catch (error) {
          console.error('[ble-connect] connection failed:', error);
          reject(error);
        }
      });
    },
    [settings.deviceId, settings.deviceName, clearPeerTimer, setPeerState]
  );

  const connectDirectlySkipHandshake = useCallback(
    (device: { id: string; name: string; advertisedName: string; serviceUUID: string; sessionToken: string; timestamp: number }) => {
      return new Promise<void>(async (resolve, reject) => {
        if (!settings.deviceId) return reject(new Error('Identity unavailable'));

        console.log('[qr-connect] Starting QR→BLE connect to peer:', device.id, 'advertisedName:', device.advertisedName);
        clearPeerTimer(device.id);

        try {
          await connectViaQRPayload({
            deviceId: device.id,
            deviceName: device.name,
            advertisedName: device.advertisedName,
            serviceUUID: device.serviceUUID,
            sessionToken: device.sessionToken,
            timestamp: device.timestamp,
          });

          setPeerState(device.id, device.name, 'HELLO');
          console.log('[qr-connect] Connected physically to peer:', device.id, 'sending connection request');

          const packet: MeshPacket = {
            id: Crypto.randomUUID(),
            from: settings.deviceId,
            to: device.id,
            ttl: 4,
            timestamp: Date.now(),
            type: 'connection_request',
            payload: {
              fromDeviceId: settings.deviceId,
              fromDeviceName: settings.deviceName || 'Unknown',
              timestamp: Date.now(),
            },
          };
          await sendMessageBLE(packet);

          let resolved = false;

          const checkInterval = setInterval(() => {
            if (resolved) return;
            const current = devicesByIdRef.current[device.id];
            if (current) {
              if (current.handshakeState === 'CONNECTED') {
                clearInterval(checkInterval);
                resolved = true;
                resolve();
              } else if (current.handshakeState === 'FAILED') {
                clearInterval(checkInterval);
                resolved = true;
                reject(new Error(current.lastError || 'Connection rejected or failed'));
              }
            }
          }, 500);

          setTimeout(() => {
            if (resolved) return;
            clearInterval(checkInterval);
            resolved = true;
            setPeerState(device.id, device.name, 'FAILED', { lastError: 'Connection request timed out' });
            reject(new Error('Connection request timed out'));
          }, 30000);

        } catch (error) {
          console.error('[qr-connect] QR connection failed:', error);
          setPeerState(device.id, device.name, 'FAILED', { lastError: 'QR connection failed' });
          reject(error);
        }
      });
    },
    [settings.deviceId, settings.deviceName, clearPeerTimer, setPeerState]
  );



  const removeConnected = useCallback(
    (deviceId: string) => {
      clearPeerTimer(deviceId);
      updatePeer(deviceId, () => null);
      lastSeenRef.current.delete(deviceId);
      
      void localDatabase.upsertDevice({
        id: deviceId,
        handshakeState: 'IDLE'
      });
    },
    [clearPeerTimer, updatePeer]
  );

  const handshakeDevices = useMemo(
    () =>
      Object.values(devicesById)
        .filter((device) => device.handshakeState !== "IDLE")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devicesById]
  );

  const connectedDevices = useMemo(
    () =>
      handshakeDevices.filter(d => d.handshakeState === "CONNECTED"),
    [handshakeDevices]
  );


  const isConnected = useCallback(
    (deviceId: string) => devicesById[deviceId]?.handshakeState === "CONNECTED",
    [devicesById]
  );

  const getConnectionState = useCallback(
    (deviceId: string) => devicesById[deviceId]?.handshakeState || "IDLE",
    [devicesById]
  );

  const canOpenChat = useCallback(
    (deviceId: string) => getConnectionState(deviceId) === "CONNECTED",
    [getConnectionState]
  );

  const handleAcceptRequest = async () => {
    if (!incomingRequest) return;
    const { packet } = incomingRequest;
    
    setPeerState(packet.from, packet.payload?.fromDeviceName || packet.from.slice(-8), 'CONNECTED');
    
    const acceptPacket: MeshPacket = {
      id: Crypto.randomUUID(),
      from: settings.deviceId!,
      to: packet.from,
      ttl: 4,
      timestamp: Date.now(),
      type: 'connection_accepted',
      payload: {
        requestId: packet.payload?.requestId,
        fromDeviceId: settings.deviceId,
        fromDeviceName: settings.deviceName || 'Unknown',
        timestamp: Date.now(),
      },
    };
    await sendMessageBLE(acceptPacket);
    setIncomingRequest(null);
  };

  const handleRejectRequest = async () => {
    if (!incomingRequest) return;
    const { packet } = incomingRequest;
    
    const rejectPacket: MeshPacket = {
      id: Crypto.randomUUID(),
      from: settings.deviceId!,
      to: packet.from,
      ttl: 4,
      timestamp: Date.now(),
      type: 'connection_rejected',
      payload: {
        requestId: packet.payload?.requestId,
        fromDeviceId: settings.deviceId,
        fromDeviceName: settings.deviceName || 'Unknown',
        timestamp: Date.now(),
      },
    };
    await sendMessageBLE(rejectPacket);
    setIncomingRequest(null);
  };

  return (
    <BleConnectionContext.Provider
      value={{
        connectedDevices,
        handshakeDevices,
        requestConnectionFromScan,
        connectDirectlySkipHandshake,
        removeConnected,
        isConnected,
        getConnectionState,
        canOpenChat,
        globalBleState,
      }}
    >
      {children}
      <ConnectionRequestModal 
        request={incomingRequest ? incomingRequest.data : null}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />
    </BleConnectionContext.Provider>
  );
}

export function useBleConnections(): BleConnectionContextValue {
  const ctx = useContext(BleConnectionContext);
  if (!ctx) {
    return {
      connectedDevices: [],
      handshakeDevices: [],
      requestConnectionFromScan: async () => ({ peerId: '', peerName: '' }),
      connectDirectlySkipHandshake: async (_device) => {},
      removeConnected: () => {},
      isConnected: () => false,
      getConnectionState: () => "IDLE",
      canOpenChat: () => false,
      globalBleState: 'disconnected',
    };
  }
  return ctx;
}
