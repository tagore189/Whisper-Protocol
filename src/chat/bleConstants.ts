// BLE Constants for FortiLink Chat System
export const BLE_CONSTANTS = {
  // Service and Characteristic UUIDs
  SERVICE_UUID: '12345678-1234-1234-1234-123456789abc',
  CHARACTERISTIC_UUID: '87654321-4321-4321-4321-cba987654321',

  // Device advertisement name
  DEVICE_NAME: 'FortiLink',

  // Message chunking
  MAX_CHUNK_SIZE: 18, // Leave room for metadata in ~20 byte BLE limit

  // ACK and retry
  ACK_TIMEOUT_MS: 3000,
  MAX_RETRIES: 3,

  // Message types
  MESSAGE_TYPE_CHUNK: 'chunk',
  MESSAGE_TYPE_ACK: 'ack',
  MESSAGE_TYPE_FULL: 'full',
} as const;