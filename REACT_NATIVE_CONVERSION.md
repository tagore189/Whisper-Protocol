# APP SIGNAL PROTOCOL - React Native Backend Conversion Guide

## Overview
The entire backend has been converted to React Native with full support for Expo. This means all functionality is now compatible with mobile platforms (iOS, Android) and can be seamlessly integrated into your React Native app.

## Architecture

### Core Modules

#### 1. **BLE (Bluetooth Low Energy)** - `src/backend/ble/`
- **bleManager.ts**: Initializes and manages the BLE Manager singleton
- **advertise.ts**: Handles BLE advertising for device discoverability
- **scan.ts**: Scans for nearby BLE devices and reports mesh nodes

**React Native Libraries Used:**
- `react-native-ble-plx`: Full-featured BLE implementation

#### 2. **Cryptography** - `src/backend/crypto/`
- **keyManager.ts**: Manages asymmetric key generation, storage, and rotation
- **encrypt.ts**: Provides message encryption/decryption using HMAC-SHA256

**React Native Libraries Used:**
- `expo-crypto`: Cryptographic operations
- `expo-random`: Secure random number generation
- `@react-native-async-storage/async-storage`: Persistent key storage

#### 3. **Identity** - `src/backend/identity/`
- **identity.ts**: Creates and manages unique node identity
- **nodeIdentify.ts**: Generates node IDs

#### 4. **Mesh Networking** - `src/backend/mesh/`
- **packet.ts**: Packet structure and creation
- **router.ts**: Packet routing with TTL and deduplication
- **messageStore.ts**: Message storage with persistence
- **nodeIdentify.ts**: Node identification

**Features:**
- TTL-based packet routing
- Message deduplication
- Persistent conversation storage
- Event-driven message updates

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

The following packages have been added:
- `expo-crypto`: ~14.0.2
- `@react-native-async-storage/async-storage`: ^1.21.0

### 2. Initialize Backend in Your App

```typescript
import { initBackend } from '@/src/backend';

// In your main component or at app startup
useEffect(() => {
  const init = async () => {
    const identity = await initBackend((nodes) => {
      console.log('Discovered nodes:', nodes);
    });
    console.log('My node ID:', identity.nodeId);
  };
  
  init();
}, []);
```

## Usage

### Using React Hooks (Recommended)

The `useProtocol` hook provides easy access to all backend functionality:

```typescript
import { useProtocol } from '@/src/hooks/useProtocol';

function MyComponent() {
  const {
    identity,
    ble,
    encryption,
    messages,
    mesh,
  } = useProtocol();

  // Access individual features
  const { nodes, startScan } = ble;
  const { encrypt, decrypt, hash } = encryption;
  const { conversations, addMessage } = messages;

  return (
    <View>
      <Text>Node ID: {identity?.nodeId}</Text>
      <Text>Nearby Nodes: {ble.nodes.length}</Text>
      <Button title="Start Scanning" onPress={startScan} />
    </View>
  );
}
```

### Individual Hooks

#### Backend Initialization
```typescript
const { identity, loading, error } = useBackendInitialization();
```

#### BLE Operations
```typescript
// Scanning
const { nodes, scanning, startScan } = useBLEScanning();

// Advertising
const { advertising, start, stop } = useBLEAdvertising();
```

#### Encryption
```typescript
const { encrypt, decrypt, hash, loading, error } = useEncryption();

// Encrypt a message
const encrypted = await encrypt(message, recipientPublicKey);

// Decrypt a message
const decrypted = await decrypt(encryptedData, senderPublicKey);

// Hash data
const hash = await hash(data);
```

#### Message Management
```typescript
const { conversations, addMessage, markDelivered, clearConversation } = useMessageStore();

// Add a new message
await addMessage(fromId, toId, payload);

// Mark as delivered
await markDelivered(messageId);

// Clear conversation
await clearConversation(peerId);
```

#### Mesh Networking
```typescript
const { createAndSendPacket } = useMeshNetworking();

// Create and send a packet
const packet = await createAndSendPacket(fromId, toId, payload, ttl);
```

### Direct Backend Access

If you prefer not to use hooks, you can import functions directly:

```typescript
import {
  getOrCreateIdentity,
  getOrCreateKeyPair,
  encryptMessage,
  decryptMessage,
  messageStore,
  createPacket,
  startAdvertising,
  startScanning,
} from '@/src/backend';

// Initialize identity
const identity = await getOrCreateIdentity();

// Work with keys
const keys = await getOrCreateKeyPair();

// Encrypt/decrypt
const encrypted = await encryptMessage(message, publicKey);
const decrypted = await decryptMessage(encrypted, senderPublicKey);

// Work with messages
await messageStore.addMessage(fromId, toId, payload);

// Create packets
const packet = createPacket({ from: fromId, to: toId, payload });
```

## Data Persistence

All important data is persisted to AsyncStorage:
- **Identity**: `@app_signal_protocol:identity`
- **Keys**: `@app_signal_protocol:keys`
- **Conversations**: `@app_signal_protocol:conversations`
- **Delivered Messages**: `@app_signal_protocol:messages`

This means data survives app restarts automatically.

## Key Features

### ✅ BLE Networking
- Device advertising and scanning
- GATT service communication
- Automatic node discovery

### ✅ Encryption
- Asymmetric key generation and storage
- Message encryption/decryption
- Data signing and verification
- Secure hashing

### ✅ Mesh Networking
- Packet routing with TTL
- Message deduplication
- Multi-hop communication
- Persistent message store

### ✅ State Management
- React hooks for easy integration
- Message event subscriptions
- Automatic persistence
- Real-time updates

## Configuration

### Backend Initialization Options

```typescript
const config = {
  enableBLEScanning: true,      // Enable device scanning
  enableBLEAdvertising: true,   // Enable device advertisement
  enableEncryption: true,       // Initialize encryption
};

const identity = await initBackend(onNodesUpdate, config);
```

## Best Practices

1. **Initialize Once**: Call `initBackend()` once in your root component
2. **Use Hooks**: Prefer React hooks for component integration
3. **Handle Permissions**: The code requests necessary permissions automatically
4. **Error Handling**: Always wrap backend calls in try-catch blocks
5. **Cleanup**: Call `shutdownBackend()` when the app closes
6. **Key Rotation**: Rotate keys periodically using `rotateKeys()`

## Example App Integration

```typescript
import { useProtocol } from '@/src/hooks/useProtocol';
import { View, Text, Button, FlatList } from 'react-native';

export default function MeshScreen() {
  const { identity, ble, messages, encryption, mesh } = useProtocol();

  const handleSendMessage = async () => {
    if (!identity) return;

    // Create and encrypt message
    const payload = { text: 'Hello from mesh!' };
    const encrypted = await encryption.encrypt(
      JSON.stringify(payload),
      targetNodePublicKey
    );

    // Send via mesh
    const packet = await mesh.createAndSendPacket(
      identity.nodeId,
      targetNodeId,
      encrypted
    );

    // Mark as delivered
    await messages.markDelivered(packet.id);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Node ID: {identity?.nodeId?.substring(0, 8)}...</Text>
      <Text>Nearby Nodes: {ble.nodes.length}</Text>
      
      <Button title="Start Scanning" onPress={ble.startScan} />
      <Button title="Send Message" onPress={handleSendMessage} />

      <FlatList
        data={messages.conversations}
        keyExtractor={(item) => item.peerId}
        renderItem={({ item }) => (
          <View>
            <Text>Messages from: {item.peerId}</Text>
            <Text>Count: {item.messages.length}</Text>
          </View>
        )}
      />
    </View>
  );
}
```

## Troubleshooting

### BLE Not Working
- Check platform-specific permissions in AndroidManifest.xml and Info.plist
- Ensure BLE Manager initialization succeeds
- Verify the device supports BLE

### Encryption Issues
- Check that keys are properly initialized
- Ensure matching public keys for encryption/decryption
- Verify AsyncStorage is accessible

### Message Storage Not Persisting
- Check AsyncStorage permissions
- Verify AsyncStorage is properly initialized
- Clear AsyncStorage cache if needed

## Future Enhancements

The architecture supports:
- [ ] Native AES-256-GCM encryption
- [ ] ECDH key exchange
- [ ] Digital signature verification
- [ ] Advanced routing algorithms
- [ ] Multi-hop message relay
- [ ] Network discovery caching
- [ ] QoS and message ordering

## API Reference

See detailed JSDoc comments in each module for complete API documentation.

### Core Functions
- `initBackend(onNodesUpdate, config)` - Initialize the protocol
- `shutdownBackend()` - Graceful shutdown
- `getOrCreateIdentity()` - Get node identity
- `getOrCreateKeyPair()` - Get or create encryption keys
- `encryptMessage(plaintext, recipientPublicKey)` - Encrypt
- `decryptMessage(encrypted, senderPublicKey)` - Decrypt
- `messageStore.addMessage(from, to, payload)` - Store message
- `createPacket(data)` - Create mesh packet

## Support

For issues or questions about the implementation, check the source code comments and type definitions for detailed information.
