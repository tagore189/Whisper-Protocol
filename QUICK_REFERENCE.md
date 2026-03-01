# Quick Reference Card - APP SIGNAL PROTOCOL

## Installation (30 seconds)
```bash
cd hackathonWoxsen
npm install
```

## Basic Usage (1 minute)
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

## Common Tasks

### Initialize Backend
```typescript
const { identity, loading, error } = useBackendInitialization();
```

### Scan for Devices
```typescript
const { nodes, startScan } = useBLEScanning();
<Button title="Scan" onPress={startScan} />
```

### Start Advertising
```typescript
const { advertising, start, stop } = useBLEAdvertising();
<Button title="Start" onPress={start} />
```

### Encrypt Message
```typescript
const { encrypt } = useEncryption();
const encrypted = await encrypt(message, publicKey);
```

### Decrypt Message
```typescript
const { decrypt } = useEncryption();
const decrypted = await decrypt(encrypted, senderPublicKey);
```

### Store Message
```typescript
const { addMessage, conversations } = useMessageStore();
await addMessage(fromId, toId, payload);
```

### Send Through Mesh
```typescript
const { createAndSendPacket } = useMeshNetworking();
const packet = await createAndSendPacket(from, to, data);
```

---

## Hooks Reference

| Hook | Purpose |
|------|---------|
| `useProtocol()` | All-in-one (recommended) |
| `useBackendInitialization()` | Initialize system |
| `useBLEScanning()` | Discover devices |
| `useBLEAdvertising()` | Broadcast device |
| `useCryptoKeys()` | Manage keys |
| `useEncryption()` | Encrypt/decrypt |
| `useMessageStore()` | Store messages |
| `useMeshNetworking()` | Create packets |

---

## Direct Function Imports

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

// Packets
import { createPacket } from '@/src/backend/mesh/packet';
```

---

## Key Constants

```typescript
// Default TTL for packets
const TTL = 4;

// BLE Service UUID
const SERVICE_ID = '0000abcd-0000-1000-8000-00805f9b34fb';

// BLE Characteristic UUID
const CHAR_ID = '0000dcba-0000-1000-8000-00805f9b34fb';

// Encryption algorithm
const ALGORITHM = 'sha256';
```

---

## Error Handling

```typescript
const { encrypt, error } = useEncryption();
if (error) {
  console.error('Encryption failed:', error);
}

try {
  const encrypted = await encrypt(message, key);
} catch (err) {
  console.error('Error:', err);
}
```

---

## Types

```typescript
interface Identity { nodeId: string; }
interface Node { id: string; rssi: number | null; lastSeen: number; }
interface KeyPair { publicKey: string; privateKey: string; }
interface Message { id: string; from: string; to: string; payload: any; timestamp: number; ttl: number; }
interface Packet extends Message { }
interface ConversationThread { peerId: string; messages: Message[]; lastUpdated: number; }
```

---

## Android Permissions

Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## iOS Configuration

Add to `Info.plist`:
```xml
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Needed for Bluetooth communication</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Needed to discover nearby devices</string>
```

---

## Storage Keys

```typescript
'@app_signal_protocol:identity'      // Node identity
'@app_signal_protocol:keys'           // Encryption keys
'@app_signal_protocol:conversations'  // Message conversations
'@app_signal_protocol:messages'       // Delivered messages
```

---

## Performance Tips

- ✅ Use `useProtocol()` hook once per app
- ✅ Cache encryption keys
- ✅ Batch message operations
- ✅ Limit concurrent BLE scans
- ✅ Monitor AsyncStorage usage
- ✅ Implement message cleanup

---

## Debugging

```typescript
// Enable verbose logging
console.log('Identity:', identity?.nodeId);
console.log('Nodes found:', ble.nodes.length);
console.log('Conversations:', messages.conversations.length);
console.log('Errors:', encryption.error, ble.error);
```

---

## Common Patterns

### Initialize on App Start
```typescript
useEffect(() => {
  const init = async () => {
    const { identity } = await useBackendInitialization();
    console.log('Ready:', identity?.nodeId);
  };
  init();
}, []);
```

### Auto Scan
```typescript
useEffect(() => {
  ble.startScan?.();
}, []);
```

### Handle Node Discovery
```typescript
useEffect(() => {
  ble.nodes?.forEach(node => {
    console.log(`Found: ${node.id}`);
  });
}, [ble.nodes]);
```

### Send Message
```typescript
const handleSendMessage = async () => {
  const encrypted = await encryption.encrypt?.(message, key);
  const packet = await mesh.createAndSendPacket?.(from, to, encrypted);
  await messages.markDelivered?.(packet.id);
};
```

---

## Useful Resources

- **API Docs**: `REACT_NATIVE_CONVERSION.md`
- **Quick Start**: `IMPLEMENTATION_GUIDE.md`
- **Types**: `src/types/protocol.ts`
- **Example**: `src/components/ProtocolExample.tsx`
- **Inline Docs**: JSDoc comments in source files

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| BLE not working | Check permissions in manifest/plist |
| Keys not persisting | Check AsyncStorage permissions |
| Encryption fails | Verify AsyncStorage initialization |
| Node not found | Check BLE scan is running |
| Type errors | Update `src/types/protocol.ts` |

---

## Version Info

- **Status**: ✅ Production Ready
- **Version**: 1.0.0
- **React Native**: 0.81.5+
- **Expo**: ~54.0.33+
- **TypeScript**: ~5.9.2+

---

**Ready to build? Start with IMPLEMENTATION_GUIDE.md**
