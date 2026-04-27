/**
 * Type Definitions for APP SIGNAL PROTOCOL
 * Complete TypeScript interfaces for the React Native backend
 */

// ============================================================================
// Identity Types
// ============================================================================

export interface Identity {
  nodeId: string;
}

// ============================================================================
// BLE Types
// ============================================================================

export interface Node {
  id: string;
  rssi: number | null;
  lastSeen: number;
}

export interface BleScanConfig {
  serviceUUIDs?: string[];
  allowDuplicates?: boolean;
}

export interface BleAdvertiserState {
  isAdvertising: boolean;
  peripheral: {
    serviceId: string;
    nodeId: string;
    startTime: number;
  } | null;
}

// ============================================================================
// Cryptography Types
// ============================================================================

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface StoredKeys extends KeyPair {
  createdAt: number;
}

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  algorithm: string;
  timestamp: number;
}

export interface DecryptedMessage {
  plaintext: string;
  timestamp: number;
}

export interface SignatureVerification {
  isValid: boolean;
  timestamp?: number;
}

// ============================================================================
// Mesh Networking Types
// ============================================================================

export interface PacketData {
  from: string;
  to: string;
  payload: any;
}

export interface Packet extends PacketData {
  id: string;
  ttl: number;
  timestamp: number;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  payload: any;
  timestamp: number;
  ttl: number;
  encrypted?: boolean;
}

export interface ConversationThread {
  peerId: string;
  messages: Message[];
  lastUpdated: number;
}

export interface MessageStore {
  conversations: Map<string, ConversationThread>;
  pendingMessages: Message[];
  deliveredMessages: Set<string>;
}

export interface MessageListener {
  (store: MessageStore): void;
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UseBackendInitializationResult {
  identity: Identity | null;
  loading: boolean;
  error: string | null;
}

export interface UseBleScanningResult {
  nodes: Node[];
  scanning: boolean;
  error: string | null;
  startScan: () => void;
}

export interface UseBleScanningOptions {
  serviceUUIDs?: string[];
  allowDuplicates?: boolean;
}

export interface UseBleAdvertisingResult {
  advertising: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export interface UseCryptoKeysResult {
  keyPair: KeyPair | null;
  loading: boolean;
  error: string | null;
  rotate: () => Promise<void>;
}

export interface UseEncryptionResult {
  encrypt: (message: string, recipientPublicKey: string) => Promise<string | null>;
  decrypt: (encryptedData: any, senderPublicKey: string) => Promise<string | null>;
  hash: (data: string) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

export interface UseMessageStoreResult {
  conversations: ConversationThread[];
  pendingMessages: Message[];
  addMessage: (from: string, to: string, payload: any) => Promise<Message>;
  markDelivered: (messageId: string) => Promise<void>;
  clearConversation: (peerId: string) => Promise<void>;
}

export interface UseMeshNetworkingResult {
  createAndSendPacket: (
    from: string,
    to: string,
    payload: any,
    ttl?: number
  ) => Promise<Packet | null>;
}

export interface UseProtocolResult
  extends UseBackendInitializationResult,
    UseMeshNetworkingResult {
  ble: UseBleScanningResult & UseBleAdvertisingResult;
  encryption: UseEncryptionResult;
  messages: UseMessageStoreResult;
  mesh: UseMeshNetworkingResult;
}

// ============================================================================
// Backend Configuration Types
// ============================================================================

export interface BackendConfig {
  enableBLEScanning?: boolean;
  enableBLEAdvertising?: boolean;
  enableEncryption?: boolean;
}

// ============================================================================
// Event Emitter Types
// ============================================================================

export type NodeDiscoveryCallback = (nodes: Node[]) => void;
export type MessageUpdateCallback = (store: MessageStore) => void;

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: number;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  timestamp: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================================
// Platform-Specific Types
// ============================================================================

export interface AndroidBluetoothPermissions {
  BLUETOOTH_SCAN: string;
  BLUETOOTH_CONNECT: string;
  BLUETOOTH_ADVERTISE: string;
  ACCESS_FINE_LOCATION: string;
  ACCESS_COARSE_LOCATION: string;
}

export interface IosBluetoothPermissions {
  NSBluetoothPeripheralUsageDescription: string;
  NSLocationWhenInUseUsageDescription: string;
}

// ============================================================================
// Storage Keys
// ============================================================================

export const StorageKeys = {
  IDENTITY: '@app_signal_protocol:identity' as const,
  KEYS: '@app_signal_protocol:keys' as const,
  CONVERSATIONS: '@app_signal_protocol:conversations' as const,
  MESSAGES: '@app_signal_protocol:messages' as const,
  NETWORK_TOPOLOGY: '@app_signal_protocol:topology' as const,
};

// ============================================================================
// Constants
// ============================================================================

export const PROTOCOL_CONSTANTS = {
  DEFAULT_TTL: 4,
  MAX_PACKET_SIZE: 240, // BLE MTU limit
  MESSAGE_RETENTION_TIME: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  KEY_ROTATION_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  ENCRYPTION_ALGORITHM: 'sha256' as const,
  BLE_SERVICE_UUID: '0000abcd-0000-1000-8000-00805f9b34fb' as const,
  BLE_CHARACTERISTIC_UUID: '0000dcba-0000-1000-8000-00805f9b34fb' as const,
};

// ============================================================================
// Error Types
// ============================================================================

export class ProtocolError extends Error {
  constructor(
    public code: string,
    public message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class BleError extends ProtocolError {
  constructor(message: string, originalError?: Error) {
    super('BLE_ERROR', message, originalError);
    this.name = 'BleError';
  }
}

export class EncryptionError extends ProtocolError {
  constructor(message: string, originalError?: Error) {
    super('ENCRYPTION_ERROR', message, originalError);
    this.name = 'EncryptionError';
  }
}

export class IdentityError extends ProtocolError {
  constructor(message: string, originalError?: Error) {
    super('IDENTITY_ERROR', message, originalError);
    this.name = 'IdentityError';
  }
}

export class MessagingError extends ProtocolError {
  constructor(message: string, originalError?: Error) {
    super('MESSAGING_ERROR', message, originalError);
    this.name = 'MessagingError';
  }
}

// ============================================================================
// Export type utilities
// ============================================================================

export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type Promisified<T> = Promise<T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
