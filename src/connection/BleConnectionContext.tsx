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
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActivePeer = { peerId: string | null; peerName: string | null; };

export type HandshakeState =
  | "IDLE"
  | "HELLO"
  | "ACK"
  | "READY"
  | "CONNECTED"
  | "FULLY_CONNECTED"
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
  connectDirectlySkipHandshake: (device: { id: string; name: string; advertisedName: string; serviceUUID: string; sessionToken: string; timestamp: number }) => Promise<{peerId: string; peerName: string}>;
  removeConnected: (deviceId: string) => void;
  isConnected: (deviceId: string) => boolean;
  getConnectionState: (deviceId: string) => HandshakeState;
  canOpenChat: (deviceId: string) => boolean;
  globalBleState: string;
  activePeer: ActivePeer;
  setActivePeer: (peer: ActivePeer) => void;
  deviceNameMap: Record<string, string>;
  bleToAppMap: Record<string, string>;
  pingDevice: (bleDeviceId: string) => Promise<void>;
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
  const [activePeer, setActivePeerState] = useState<ActivePeer>({ peerId: null, peerName: null });
  const [deviceNameMap, setDeviceNameMap] = useState<Record<string, string>>({});
  const [bleToAppMap, setBleToAppMap] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem('activePeer').then(stored => {
      if (stored) setActivePeerState(JSON.parse(stored));
    }).catch(() => {});
  }, []);

  const setActivePeer = useCallback((peer: ActivePeer) => {
    setActivePeerState(peer);
    if (peer.peerId) {
      AsyncStorage.setItem('activePeer', JSON.stringify(peer)).catch(() => {});
    } else {
      AsyncStorage.removeItem('activePeer').catch(() => {});
    }
  }, []);

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
      if (packet.payload?.fromDeviceName) {
        setDeviceNameMap(prev => ({ ...prev, [peerId]: packet.payload!.fromDeviceName }));
      }
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
      if (packet.payload?.fromDeviceName) {
        setDeviceNameMap(prev => ({ ...prev, [peerId]: packet.payload!.fromDeviceName }));
      }
      setPeerState(peerId, peerName, 'CONNECTED');
      setActivePeer({ peerId, peerName });
      return;
    }

    if (packet.type === 'connection_rejected') {
      console.log(`[handshake] Connection rejected by ${peerId}`);
      setPeerState(peerId, peerName, 'FAILED', { lastError: 'Connection rejected' });
      return;
    }

    if (packet.type === 'connection_ready') {
      console.log(`[handshake] Connection fully ready for ${peerId}`);
      setPeerState(peerId, peerName, 'FULLY_CONNECTED');
      setActivePeer({ peerId, peerName });
      return;
    }

    if (packet.type === 'identity_ping') {
      console.log(`[identity] Responding to identity ping from ${peerId}`);
      const responsePacket: MeshPacket = {
        id: Crypto.randomUUID(),
        from: settings.deviceId!,
        to: peerId,
        ttl: 4,
        timestamp: Date.now(),
        type: 'identity_response',
        payload: {
          deviceName: settings.deviceName || 'Unknown',
          deviceId: settings.deviceId,
        },
      };
      sendMessageBLE(responsePacket).catch(() => {});
      return;
    }

    if (packet.type === 'identity_response') {
      console.log(`[identity] Received identity response from ${peerId}: ${packet.payload?.deviceName}`);
      if (packet.payload?.deviceName) {
        setDeviceNameMap(prev => ({ ...prev, [peerId]: packet.payload!.deviceName }));
      }
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

              // Send connection_ready to tell peer we are fully connected
              const readyPacket: MeshPacket = {
                id: Crypto.randomUUID(),
                from: settings.deviceId!,
                to: peerId,
                ttl: 4,
                timestamp: Date.now(),
                type: 'connection_ready',
                payload: {
                  fromDeviceId: settings.deviceId,
                  fromDeviceName: settings.deviceName || 'Unknown',
                },
              };
              sendMessageBLE(readyPacket).catch(() => {});

              setBleToAppMap(prev => ({ ...prev, [device.id]: peerId }));
              setPeerState(peerId, peerName, 'FULLY_CONNECTED');
              setActivePeer({ peerId, peerName });
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
      // ... existing code ...
      return new Promise<{peerId: string; peerName: string}>(async (resolve, reject) => {
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

          console.log('[qr-connect] Connected physically to peer:', device.id, 'sending connection request');

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

              // Send connection_ready to tell peer we are fully connected
              const readyPacket: MeshPacket = {
                id: Crypto.randomUUID(),
                from: settings.deviceId!,
                to: peerId,
                ttl: 4,
                timestamp: Date.now(),
                type: 'connection_ready',
                payload: {
                  fromDeviceId: settings.deviceId,
                  fromDeviceName: settings.deviceName || 'Unknown',
                },
              };
              sendMessageBLE(readyPacket).catch(() => {});

              setBleToAppMap(prev => ({ ...prev, [device.id]: peerId }));
              setPeerState(peerId, peerName, 'FULLY_CONNECTED');
              setActivePeer({ peerId, peerName });
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
          console.error('[qr-connect] QR connection failed:', error);
          reject(error);
        }
      });
    },
    [settings.deviceId, settings.deviceName, clearPeerTimer, setPeerState]
  );

  const pingDevice = useCallback((bleDeviceId: string) => {
    return new Promise<void>(async (resolve) => {
      if (!settings.deviceId) return resolve();

      try {
        console.log('[identity] Pinging device:', bleDeviceId);
        // Connect physically but do not update handshake state
        const ok = await connectToDeviceById(bleDeviceId);
        if (!ok) return resolve();

        const requestId = Crypto.randomUUID();
        const pingPacket: MeshPacket = {
          id: Crypto.randomUUID(),
          from: settings.deviceId,
          to: '*',
          ttl: 4,
          timestamp: Date.now(),
          type: 'identity_ping',
          payload: { requestId }
        };

        let resolved = false;

        const unsubscribe = onMessageReceived((response) => {
          if (resolved) return;
          if (response.type === 'identity_response' && response.payload?.requestId === requestId) {
            resolved = true;
            unsubscribe();
            clearTimeout(timeoutId);
            
            const peerAppId = response.from;
            const peerName = response.payload?.deviceName;

            if (peerName) {
              setDeviceNameMap(prev => ({ ...prev, [peerAppId]: peerName }));
            }
            setBleToAppMap(prev => ({ ...prev, [bleDeviceId]: peerAppId }));
            
            console.log('[identity] Ping successful for:', peerName);
            resolve();
          }
        });

        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            unsubscribe();
            console.log('[identity] Ping timed out for:', bleDeviceId);
            resolve();
          }
        }, 8000);

        await sendMessageBLE(pingPacket);
      } catch (e) {
        resolve();
      }
    });
  }, [settings.deviceId]);

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
      handshakeDevices.filter(d => d.handshakeState === "CONNECTED" || d.handshakeState === "FULLY_CONNECTED"),
    [handshakeDevices]
  );


  const isConnected = useCallback(
    (deviceId: string) => {
      const state = devicesById[deviceId]?.handshakeState;
      return state === "CONNECTED" || state === "FULLY_CONNECTED";
    },
    [devicesById]
  );

  const getConnectionState = useCallback(
    (deviceId: string) => devicesById[deviceId]?.handshakeState || "IDLE",
    [devicesById]
  );

  const canOpenChat = useCallback(
    (deviceId: string) => {
      const state = getConnectionState(deviceId);
      return state === "CONNECTED" || state === "FULLY_CONNECTED";
    },
    [getConnectionState]
  );

  const handleAcceptRequest = async () => {
    if (!incomingRequest) return;
    const { packet } = incomingRequest;
    const peerName = packet.payload?.fromDeviceName || packet.from.slice(-8);
    setPeerState(packet.from, peerName, 'CONNECTED');
    setActivePeer({ peerId: packet.from, peerName });
    
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
        activePeer,
        setActivePeer,
        deviceNameMap,
        bleToAppMap,
        pingDevice,
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
      connectDirectlySkipHandshake: async (_device) => ({ peerId: '', peerName: '' }),
      removeConnected: () => {},
      isConnected: () => false,
      getConnectionState: () => "IDLE",
      canOpenChat: () => false,
      globalBleState: 'disconnected',
      activePeer: { peerId: null, peerName: null },
      setActivePeer: () => {},
      deviceNameMap: {},
      bleToAppMap: {},
      pingDevice: async () => {},
    };
  }
  return ctx;
}
