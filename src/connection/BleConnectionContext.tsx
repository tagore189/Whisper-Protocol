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
import { connectDirectly, connectToDeviceById, isConnected as isBLEConnected, onConnectionStateChange } from "./ble/bleTransport";
import type { MeshPacket } from "./mesh/packet";
import { localDatabase } from "../storage/localDatabase";

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
  beginHandshake: (device: { id: string; name: string }) => Promise<void>;
  connectDirectlySkipHandshake: (device: { id: string; name: string; bleId: string }) => Promise<void>;
  acceptHandshake: (requestId: string, peer: { id: string; name: string }) => Promise<void>;
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

  const sendHandshakePacket = useCallback(async (
    to: string, 
    status: string, 
    extraPayload: any = {}
  ) => {
    if (!settings.deviceId) return;

    // Ensure GATT connection before sending
    if (!isBLEConnected()) {
      console.log(`[handshake] GATT not connected to ${to}. Attempting direct connection...`);
      const ok = await connectDirectly(to);
      if (!ok) {
        throw new Error(`Failed to establish physical BLE connection to ${to}`);
      }
    }

    const packet: MeshPacket = {
      id: Crypto.randomUUID(),
      from: settings.deviceId,
      to,
      ttl: 4,
      timestamp: Date.now(),
      type: 'HANDSHAKE',
      payload: { status, ...extraPayload },
    };

    console.log(`[handshake] Sending ${status} to ${to}`);
    await sendMessageBLE(packet);
  }, [settings.deviceId]);

  const processPacket = useCallback(async (packet: MeshPacket) => {
    console.log('[handshake] Processing packet:', packet.id, packet.type, packet.payload);
    if (packet.type !== 'HANDSHAKE') return;
    if (!settings.deviceId || packet.to !== settings.deviceId) {
      console.log('[handshake] Ignoring packet - not for us or not handshake');
      return;
    }

    const peerId = packet.from;
    const status = packet.payload?.status;
    const peerName = packet.payload?.name || peerId.slice(-8);

    console.log(`[handshake] Received ${status} from ${peerId}`);
    lastSeenRef.current.set(peerId, Date.now());

    switch (status) {
      case 'hello':
        // Auto-accept HELLO from peer for BLE mesh connections
        setPeerState(peerId, peerName, 'ACK');
        await sendHandshakePacket(peerId, 'ack');
        break;

      case 'ack':
        // Peer accepted our HELLO. Move to READY and send READY back.
        setPeerState(peerId, peerName, 'READY');
        await sendHandshakePacket(peerId, 'ready');
        break;

      case 'ready':
        // Peer is READY. Move to CONNECTED and send CONNECTED back.
        setPeerState(peerId, peerName, 'CONNECTED');
        await sendHandshakePacket(peerId, 'connected');
        break;

      case 'connected':
        // Handshake complete.
        setPeerState(peerId, peerName, 'CONNECTED');
        break;

      case 'failed':
      case 'rejected':
        setPeerState(peerId, peerName, 'FAILED', { lastError: 'Peer rejected or failed connection' });
        break;
    }
  }, [settings.deviceId, setPeerState, sendHandshakePacket]);

  // Listen for incoming packets
  useEffect(() => {
    onMessageReceived(processPacket);
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

  const beginHandshake = useCallback(
    async (device: { id: string; name: string }) => {
      if (!settings.deviceId) throw new Error('Identity unavailable');

      clearPeerTimer(device.id);
      setPeerState(device.id, device.name, 'HELLO', { retryCount: 0 });

      await sendHandshakePacket(device.id, 'hello', { name: settings.deviceName || 'Unknown' });

      // Set timeout for handshake
      const timer = setTimeout(() => {
        const current = devicesByIdRef.current[device.id];
        if (current && current.handshakeState !== 'CONNECTED') {
          setPeerState(device.id, device.name, 'FAILED', { lastError: 'Handshake timed out' });
        }
      }, HANDSHAKE_TIMEOUT_MS);
      
      timersRef.current.set(device.id, timer);
    },
    [settings.deviceId, settings.deviceName, clearPeerTimer, setPeerState, sendHandshakePacket]
  );

  const connectDirectlySkipHandshake = useCallback(
    async (device: { id: string; name: string; bleId: string }) => {
      if (!settings.deviceId) throw new Error('Identity unavailable');

      console.log('[qr-connect] Connecting directly and skipping handshake to:', device.id, 'using bleId:', device.bleId);
      clearPeerTimer(device.id);

      // Establish BLE connection directly
      try {
        const connected = await connectToDeviceById(device.bleId);
        if (!connected) {
          throw new Error('Unable to connect to device');
        }

        // Skip handshake - set state directly to CONNECTED
        setPeerState(device.id, device.name, 'CONNECTED');
        console.log('[qr-connect] Connected directly to:', device.id);
      } catch (error) {
        console.error('[qr-connect] Direct connection failed:', error);
        setPeerState(device.id, device.name, 'FAILED', { lastError: 'Direct connection failed' });
        throw error;
      }
    },
    [settings.deviceId, clearPeerTimer, setPeerState]
  );

  const acceptHandshake = useCallback(
    async (requestId: string, peer: { id: string; name: string }) => {
      // requestId isn't strictly needed for offline BLE, but we use peer.id
      setPeerState(peer.id, peer.name, 'ACK');
      await sendHandshakePacket(peer.id, 'ack');
    },
    [setPeerState, sendHandshakePacket]
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

  return (
    <BleConnectionContext.Provider
      value={{
        connectedDevices,
        handshakeDevices,
        beginHandshake,
        connectDirectlySkipHandshake,
        acceptHandshake,
        removeConnected,
        isConnected,
        getConnectionState,
        canOpenChat,
        globalBleState,
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
      handshakeDevices: [],
      beginHandshake: async () => {},
      connectDirectlySkipHandshake: async () => {},
      acceptHandshake: async () => {},
      removeConnected: () => {},
      isConnected: () => false,
      getConnectionState: () => "IDLE",
      canOpenChat: () => false,
      globalBleState: 'disconnected',
    };
  }
  return ctx;
}
