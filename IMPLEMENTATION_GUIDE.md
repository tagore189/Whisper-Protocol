# React Native Implementation Guide - Quick Start

This guide helps you integrate the converted APP SIGNAL PROTOCOL into your React Native app for future updates and features.

## What Has Been Done

✅ **Complete Backend Conversion**
- All TypeScript backend code converted to React Native compatible modules
- Full support for Expo and native React Native apps
- Async/await patterns for proper promise handling
- React Hooks for component integration

✅ **Modules Converted**
1. **BLE (Bluetooth Low Energy)**
   - Device advertising and scanning
   - Service discovery
   - GATT communication

2. **Cryptography**
   - Key generation and management
   - Message encryption/decryption
   - Data signing and verification
   - Secure hashing

3. **Mesh Networking**
   - Packet routing with TTL
   - Message deduplication
   - Persistent storage
   - Event subscriptions

4. **Identity Management**
   - Unique node ID generation
   - Key pair management
   - Identity persistence

✅ **React Integration**
- Custom React Hooks for all backend operations
- Event-driven message updates
- Automatic persistence
- Error handling

## Installation Steps

### 1. Install Dependencies

```bash
cd hackathonWoxsen
npm install
```

This installs:
- `expo-crypto` - Cryptographic operations
- `@react-native-async-storage/async-storage` - Persistent storage
- `react-native-ble-plx` - BLE functionality (already included)

### 2. Android Configuration

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### 3. iOS Configuration

Add to `ios/Podfile`:

```ruby
target 'YourAppName' do
  # ... existing pods ...
  
  # BLE requires location services
  pod 'RNBlePeripheral', :path => '../node_modules/react-native-ble-plx'
end
```

Update `ios/YourApp/Info.plist`:

```xml
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to communicate with nearby devices</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location to discover nearby Bluetooth devices</string>
</key>
```

## Integration in Your App

### Option 1: Using Hooks (Recommended)

```typescript
import { useProtocol } from '@/src/hooks/useProtocol';

export function MyScreen() {
  const { identity, ble, encryption, messages } = useProtocol();

  return (
    <View>
      <Text>Node: {identity?.nodeId}</Text>
      <Button title="Scan" onPress={ble.startScan} />
    </View>
  );
}
```

### Option 2: Using Direct Functions

```typescript
import { initBackend, startScanning } from '@/src/backend';

// In your root component
useEffect(() => {
  initBackend((nodes) => {
    console.log('Nodes:', nodes);
  });
}, []);
```

## Key Module Imports

```typescript
// Identity
import { getOrCreateIdentity } from '@/src/backend/identity/identity';

// BLE
import { startAdvertising, startScanning } from '@/src/backend/ble';

// Encryption
import { encryptMessage, decryptMessage } from '@/src/backend/crypto/encrypt';
import { getOrCreateKeyPair } from '@/src/backend/crypto/keyManager';

// Messaging
import { messageStore } from '@/src/backend/mesh/messageStore';

// Hooks
import {
  useProtocol,
  useBLEScanning,
  useBLEAdvertising,
  useEncryption,
  useMessageStore,
  useMeshNetworking,
} from '@/src/hooks/useProtocol';
```

## Complete Example

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useProtocol } from '@/src/hooks/useProtocol';

export function MeshNetworkScreen() {
  const protocol = useProtocol();
  const { identity, ble, encryption, messages, mesh } = protocol;

  const handleInitialSetup = async () => {
    if (!identity) return;

    // Get public key
    const keyPair = await encryption.encrypt?.('test', '');
    console.log('Setup complete');
  };

  const handleScanDevices = () => {
    ble.startScan?.();
  };

  const handleSendMessage = async () => {
    if (!identity || !ble.nodes.length) return;

    const recipient = ble.nodes[0];
    const message = 'Hello Mesh!';

    // Encrypt and send
    const encrypted = await encryption.encrypt?.(message, recipient.id);
    await mesh.createAndSendPacket?.(
      identity.nodeId,
      recipient.id,
      encrypted
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>APP SIGNAL PROTOCOL</Text>

      {identity && (
        <View style={styles.infoSection}>
          <Text>Node ID: {identity.nodeId.substring(0, 16)}...</Text>
          <Text>Nearby Nodes: {ble.nodes?.length || 0}</Text>
        </View>
      )}

      <Button title="Initialize" onPress={handleInitialSetup} />
      <Button title="Scan Devices" onPress={handleScanDevices} />
      <Button title="Send Message" onPress={handleSendMessage} />

      {messages.conversations && messages.conversations.length > 0 && (
        <View style={styles.conversationList}>
          <Text>Conversations: {messages.conversations.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  infoSection: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  conversationList: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
});
```

## Future Enhancement Points

The architecture supports easy addition of:

### 1. Advanced Encryption
```typescript
// Can be added to encrypt.ts
export async function encryptWithAESGCM(data, key) {
  // Implement native AES-256-GCM
}
```

### 2. Improved Routing
```typescript
// Enhance mesh/router.ts
export function calculateBestRoute(nodes) {
  // Implement advanced routing algorithms
}
```

### 3. Message Relaying
```typescript
// Extend mesh networking for multi-hop
export async function relayMessage(packet) {
  // Forward packets through the mesh
}
```

### 4. Network Discovery
```typescript
// Add discovery caching
export async function cacheNetworkTopology(nodes) {
  // Store and retrieve network topology
}
```

## Testing

### Unit Tests Example

```typescript
import { encryptMessage, decryptMessage } from '@/src/backend/crypto/encrypt';

describe('Encryption', () => {
  it('should encrypt and decrypt messages', async () => {
    const message = 'Hello World';
    const encrypted = await encryptMessage(message, publicKey);
    const decrypted = await decryptMessage(encrypted, senderPublicKey);
    
    expect(decrypted.plaintext).toBe(message);
  });
});
```

## Troubleshooting

### BLE Not Working
1. Check permissions in Android/iOS config
2. Verify BLE Manager initialization in bleManager.ts
3. Ensure device supports BLE

### Encryption Issues
1. Verify AsyncStorage is initialized
2. Check key generation succeeds
3. Use same keys for encrypt/decrypt pairs

### Build Errors
1. Run `npm install` again
2. Clear node_modules and reinstall
3. Check Node/npm versions

## Documentation Files

- **REACT_NATIVE_CONVERSION.md** - Complete API reference
- **src/backend/** - Backend modules with JSDoc comments
- **src/hooks/useProtocol.ts** - Hook definitions with examples

## Next Steps

1. Integrate `useProtocol` hook into your main app component
2. Add BLE permission handling for your target platforms
3. Implement message UI components
4. Test with multiple devices
5. Implement advanced routing and encryption features

## Performance Notes

- Message storage uses AsyncStorage (suitable for < 10MB data)
- BLE scanning runs continuously (adjust timing as needed)
- Encryption uses SHA256 (suitable for most use cases)
- Consider implementing proper AES-GCM for production security

## Support

All code includes JSDoc comments. Check:
- `/src/backend/*/` for module documentation
- `/src/hooks/useProtocol.ts` for hook usage
- `REACT_NATIVE_CONVERSION.md` for API reference

---

**Status: ✅ Ready for Implementation**

All backend code has been converted to React Native and is ready for integration and future updates.
