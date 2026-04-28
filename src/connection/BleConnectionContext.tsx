import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppSettings } from "../core/AppSettingsContext";
import { supabase } from "../storage/supabase";

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
  requestId?: string;
  retryCount: number;
  lastError?: string;
};

type ConnectionRequestRow = {
  id: string;
  sender_device_id: string;
  receiver_device_id: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "hello"
    | "ack"
    | "ready"
    | "connected"
    | "failed";
  created_at: string;
  sender?: { device_name?: string | null };
  receiver?: { device_name?: string | null };
};

type BleConnectionContextValue = {
  connectedDevices: ConnectedDevice[];
  beginHandshake: (device: { id: string; name: string }) => Promise<void>;
  acceptHandshake: (requestId: string, peer: { id: string; name: string }) => Promise<void>;
  removeConnected: (deviceId: string) => void;
  isConnected: (deviceId: string) => boolean;
  getConnectionState: (deviceId: string) => HandshakeState;
  canOpenChat: (deviceId: string) => boolean;
};

const BleConnectionContext = createContext<BleConnectionContextValue | null>(null);

const HANDSHAKE_TIMEOUT_MS = 12_000;
const HANDSHAKE_MAX_RETRIES = 2;
const RECONNECT_DELAY_MS = 5_000;
const STALE_CONNECTION_MS = 30_000;

type RetrySpec = {
  rowId: string;
  peerId: string;
  peerName: string;
  statusToResend: "hello" | "ready";
  phase: "ACK" | "CONNECTED";
  retryCount: number;
};

function mapStatusToHandshakeState(
  status: ConnectionRequestRow["status"]
): HandshakeState {
  switch (status) {
    case "hello":
      return "HELLO";
    case "ack":
      return "ACK";
    case "ready":
      return "READY";
    case "connected":
      return "CONNECTED";
    case "failed":
    case "rejected":
      return "FAILED";
    default:
      return "IDLE";
  }
}

export function BleConnectionProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppSettings();
  const [devicesById, setDevicesById] = useState<Record<string, ConnectedDevice>>({});
  const devicesByIdRef = useRef<Record<string, ConnectedDevice>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activeRowsRef = useRef<Map<string, ConnectionRequestRow>>(new Map());
  const processingRowsRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    devicesByIdRef.current = devicesById;
  }, [devicesById]);

  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSeenRef = useRef<Map<string, number>>(new Map());

  const clearPeerTimer = useCallback((peerId: string) => {
    const existing = timersRef.current.get(peerId);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(peerId);
    }
  }, []);

  const clearReconnectTimer = useCallback((peerId: string) => {
    const existing = reconnectTimersRef.current.get(peerId);
    if (existing) {
      clearTimeout(existing);
      reconnectTimersRef.current.delete(peerId);
    }
  }, []);

  const updateLastSeen = useCallback((peerId: string) => {
    lastSeenRef.current.set(peerId, Date.now());
  }, []);

  let beginHandshake: (device: { id: string; name: string }) => Promise<void>;

  const scheduleReconnect = useCallback(
    (peerId: string, peerName: string): void => {
      clearReconnectTimer(peerId);
      const timer = setTimeout(async () => {
        console.log(
          `[handshake][${settings.deviceId || 'unknown'}][${peerId}] reconnecting after failure or stale connection`
        );

        try {
          if (typeof beginHandshake === 'function') {
            await beginHandshake({ id: peerId, name: peerName });
          }
        } catch (error) {
          console.error('Reconnect attempt failed:', error);
        }
      }, RECONNECT_DELAY_MS);

      reconnectTimersRef.current.set(peerId, timer);
    },
    [clearReconnectTimer, settings.deviceId]
  );

  const buildConnectionQuery = useCallback(
    (peerId: string) =>
      `or(and(sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${peerId}),and(sender_device_id.eq.${peerId},receiver_device_id.eq.${settings.deviceId}))`,
    [settings.deviceId]
  );

  const findExistingConnection = useCallback(
    async (peerId: string): Promise<ConnectionRequestRow | null> => {
      if (!settings.deviceId) return null;
      const { data, error } = await supabase
        .from('connection_requests')
        .select(
          '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
        )
        .or(buildConnectionQuery(peerId))
        .limit(1)
        .single();

      if (error) {
        console.warn('Failed to query existing connection row:', error);
        return null;
      }

      return data as ConnectionRequestRow | null;
    },
    [buildConnectionQuery, settings.deviceId]
  );

  const updateConnectionStatus = useCallback(
    async (
      rowId: string,
      status: ConnectionRequestRow['status'],
      expectedStatus: ConnectionRequestRow['status'] | null = null
    ) => {
      let query = supabase.from('connection_requests').update({ status });
      if (expectedStatus) {
        query = query.eq('status', expectedStatus);
      }
      const result = await query
        .eq('id', rowId)
        .select(
          '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
        )
        .single();
      if (result.error) {
        return { error: result.error, data: null };
      }
      return { error: null as null, data: result.data as ConnectionRequestRow | null };
    },
    []
  );

  const logStep = useCallback(
    (peerId: string, step: "HELLO" | "ACK" | "READY", message: string) => {
      console.log(`[handshake][${settings.deviceId || "unknown"}][${peerId}][${step}] ${message}`);
    },
    [settings.deviceId]
  );

  const setPeerState = useCallback(
    (
      peerId: string,
      peerName: string,
      handshakeState: HandshakeState,
      extras?: Partial<ConnectedDevice>
    ) => {
      updatePeer(peerId, (prev) => ({
        id: peerId,
        name: extras?.name || prev?.name || peerName || peerId.slice(-8),
        handshakeState,
        retryCount: extras?.retryCount ?? prev?.retryCount ?? 0,
        requestId: extras?.requestId ?? prev?.requestId,
        lastError: extras?.lastError ?? prev?.lastError,
      }));
    },
    [updatePeer]
  );

  const scheduleRetry = useCallback(
    (spec: RetrySpec) => {
      clearPeerTimer(spec.peerId);
      const timer = setTimeout(async () => {
        if (spec.retryCount >= HANDSHAKE_MAX_RETRIES) {
          await supabase
            .from("connection_requests")
            .update({ status: "failed" })
            .eq("id", spec.rowId);

          setPeerState(spec.peerId, spec.peerName, "FAILED", {
            requestId: spec.rowId,
            retryCount: spec.retryCount,
            lastError: `Timed out waiting for ${spec.phase}`,
          });
          return;
        }

        const nextRetry = spec.retryCount + 1;
        console.log(
          `[handshake][${settings.deviceId || "unknown"}][${spec.peerId}] timeout waiting for ${spec.phase}; retry ${nextRetry}/${HANDSHAKE_MAX_RETRIES}`
        );

        const nextState = spec.statusToResend === "hello" ? "HELLO" : "READY";
        setPeerState(spec.peerId, spec.peerName, nextState, {
          requestId: spec.rowId,
          retryCount: nextRetry,
          lastError: undefined,
        });

        await supabase
          .from("connection_requests")
          .update({ status: spec.statusToResend })
          .eq("id", spec.rowId);

        scheduleRetry({ ...spec, retryCount: nextRetry });
      }, HANDSHAKE_TIMEOUT_MS);

      timersRef.current.set(spec.peerId, timer);
    },
    [clearPeerTimer, setPeerState, settings.deviceId]
  );

  const processRow = useCallback(
    async (row: ConnectionRequestRow): Promise<void> => {
      if (!settings.deviceId) return;
      if (processingRowsRef.current.has(row.id)) return;

      processingRowsRef.current.add(row.id);
      try {
        const peerId =
          row.sender_device_id === settings.deviceId
            ? row.receiver_device_id
            : row.sender_device_id;
        const peerName =
          (row.sender_device_id === settings.deviceId
            ? row.receiver?.device_name
            : row.sender?.device_name) || peerId.slice(-8);

        activeRowsRef.current.set(peerId, row);
        updateLastSeen(peerId);

        if (row.status === 'rejected' || row.status === 'failed') {
          clearPeerTimer(peerId);
          clearReconnectTimer(peerId);
          setPeerState(peerId, peerName, 'FAILED', {
            requestId: row.id,
            lastError:
              row.status === 'rejected'
                ? 'Connection rejected'
                : 'Handshake failed',
          });

          scheduleReconnect(peerId, peerName);
          return;
        }

        if (row.status === 'connected') {
          clearPeerTimer(peerId);
          clearReconnectTimer(peerId);
          setPeerState(peerId, peerName, 'CONNECTED', {
            requestId: row.id,
            lastError: undefined,
          });
          return;
        }

        if (row.status === 'hello') {
          setPeerState(peerId, peerName, 'HELLO', {
            requestId: row.id,
            lastError: undefined,
          });

          if (row.sender_device_id !== settings.deviceId) {
            logStep(peerId, 'HELLO', 'HELLO received; sending ACK');
            const { data } = await updateConnectionStatus(row.id, 'ack', 'hello');
            if (data) {
              await processRow(data);
            }
          } else {
            logStep(peerId, 'HELLO', 'HELLO sent; waiting for ACK');
            scheduleRetry({
              rowId: row.id,
              peerId,
              peerName,
              statusToResend: 'hello',
              phase: 'ACK',
              retryCount: devicesByIdRef.current[peerId]?.retryCount ?? 0,
            });
          }
          return;
        }

        if (row.status === 'ack') {
          clearPeerTimer(peerId);
          setPeerState(peerId, peerName, 'ACK', {
            requestId: row.id,
            lastError: undefined,
          });

          logStep(peerId, 'ACK', 'ACK observed; moving to READY');
          setPeerState(peerId, peerName, 'READY', {
            requestId: row.id,
            retryCount: devicesByIdRef.current[peerId]?.retryCount ?? 0,
          });

          const { data } = await updateConnectionStatus(row.id, 'ready', 'ack');
          if (data) {
            scheduleRetry({
              rowId: row.id,
              peerId,
              peerName,
              statusToResend: 'ready',
              phase: 'CONNECTED',
              retryCount: devicesByIdRef.current[peerId]?.retryCount ?? 0,
            });
            await processRow(data);
          }
          return;
        }

        if (row.status === 'ready') {
          clearPeerTimer(peerId);
          setPeerState(peerId, peerName, 'READY', {
            requestId: row.id,
            lastError: undefined,
          });

          logStep(peerId, 'READY', 'READY observed; moving to CONNECTED');
          const { data } = await updateConnectionStatus(row.id, 'connected', 'ready');
          if (data) {
            setPeerState(peerId, peerName, 'CONNECTED', {
              requestId: row.id,
            });
          }
          return;
        }
      } finally {
        processingRowsRef.current.delete(row.id);
      }
    },
    [
      clearPeerTimer,
      clearReconnectTimer,
      logStep,
      scheduleReconnect,
      scheduleRetry,
      setPeerState,
      settings.deviceId,
      updateConnectionStatus,
      updateLastSeen,
    ]
  );

  useEffect(() => {
    if (!settings.deviceId) return;

    let isMounted = true;

    const loadExisting = async () => {
      const { data } = await supabase
        .from("connection_requests")
        .select(
          "*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)"
        )
        .or(
          `sender_device_id.eq.${settings.deviceId},receiver_device_id.eq.${settings.deviceId}`
        )
        .in("status", ["hello", "ack", "ready", "connected"]);

      if (!isMounted || !data) return;
      for (const row of data as ConnectionRequestRow[]) {
        await processRow(row);
      }
    };

    loadExisting();

    const channel = supabase
      .channel(`ble_connection_requests_${settings.deviceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        async (payload) => {
          const row = (payload.new || payload.old) as ConnectionRequestRow;
          if (!row) return;
          if (
            row.sender_device_id !== settings.deviceId &&
            row.receiver_device_id !== settings.deviceId
          ) {
            return;
          }
          await processRow(row);
        }
      )
      .subscribe();

    const keepAliveTimer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, lastSeen] of lastSeenRef.current.entries()) {
        const state = devicesByIdRef.current[peerId]?.handshakeState;
        if (state === 'CONNECTED' && now - lastSeen > STALE_CONNECTION_MS) {
          const peerName = devicesByIdRef.current[peerId]?.name || peerId.slice(-8);
          console.log(
            `[handshake][${settings.deviceId || 'unknown'}][${peerId}] detected stale connection; reconnecting`
          );
          scheduleReconnect(peerId, peerName);
        }
      }
    }, 10_000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      reconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
      reconnectTimersRef.current.clear();
      clearInterval(keepAliveTimer);
    };
  }, [processRow, scheduleReconnect, settings.deviceId]);

  beginHandshake = useCallback(
    async (device: { id: string; name: string }) => {
      if (!settings.deviceId) {
        throw new Error('Local device identity unavailable');
      }

      clearPeerTimer(device.id);
      clearReconnectTimer(device.id);
      logStep(device.id, 'HELLO', 'starting outgoing handshake');
      setPeerState(device.id, device.name, 'HELLO', {
        retryCount: 0,
        lastError: undefined,
      });

      const existing =
        activeRowsRef.current.get(device.id) ??
        (await findExistingConnection(device.id));

      if (existing) {
        if (existing.status === 'connected') {
          await processRow(existing);
          return;
        }

        const resolvedStatus = existing.status === 'failed' || existing.status === 'rejected' ? 'hello' : existing.status;
        const { data, error } = await supabase
          .from('connection_requests')
          .update({ status: resolvedStatus })
          .eq('id', existing.id)
          .select(
            '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
          )
          .single();

        if (error) throw error;
        await processRow(data as ConnectionRequestRow);
        return;
      }

      const { data, error } = await supabase
        .from('connection_requests')
        .insert({
          sender_device_id: settings.deviceId,
          receiver_device_id: device.id,
          status: 'hello',
        })
        .select(
          '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
        )
        .single();

      if (error) throw error;
      await processRow(data as ConnectionRequestRow);
    },
    [
      clearPeerTimer,
      clearReconnectTimer,
      findExistingConnection,
      logStep,
      processRow,
      setPeerState,
      settings.deviceId,
    ]
  );

  const acceptHandshake = useCallback(
    async (requestId: string, peer: { id: string; name: string }) => {
      logStep(peer.id, 'ACK', 'accepting handshake and sending ACK');
      setPeerState(peer.id, peer.name, 'ACK', {
        requestId,
        retryCount: 0,
        lastError: undefined,
      });

      const { data, error } = await supabase
        .from('connection_requests')
        .update({ status: 'ack' })
        .eq('id', requestId)
        .eq('status', 'hello')
        .select(
          '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
        )
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is returned when no rows are updated due to status mismatch.
        throw error;
      }

      if (data) {
        await processRow(data as ConnectionRequestRow);
        return;
      }

      const fallback = await supabase
        .from('connection_requests')
        .select(
          '*, sender:users!connection_requests_sender_device_id_fkey(device_name), receiver:users!connection_requests_receiver_device_id_fkey(device_name)'
        )
        .eq('id', requestId)
        .single();

      if (fallback.error) throw fallback.error;
      if (fallback.data) {
        await processRow(fallback.data as ConnectionRequestRow);
      }
    },
    [logStep, processRow, setPeerState]
  );

  const removeConnected = useCallback(
    (deviceId: string) => {
      clearPeerTimer(deviceId);
      clearReconnectTimer(deviceId);
      updatePeer(deviceId, () => null);
      activeRowsRef.current.delete(deviceId);
      lastSeenRef.current.delete(deviceId);
    },
    [clearPeerTimer, clearReconnectTimer, updatePeer]
  );

  const connectedDevices = useMemo(
    () =>
      Object.values(devicesById)
        .filter((device) => device.handshakeState === "CONNECTED")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [devicesById]
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
        beginHandshake,
        acceptHandshake,
        removeConnected,
        isConnected,
        getConnectionState,
        canOpenChat,
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
      beginHandshake: async () => {},
      acceptHandshake: async () => {},
      removeConnected: () => {},
      isConnected: () => false,
      getConnectionState: () => "IDLE",
      canOpenChat: () => false,
    };
  }
  return ctx;
}
