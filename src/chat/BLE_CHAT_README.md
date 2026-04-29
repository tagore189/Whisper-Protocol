# FortiLink BLE Chat System

A complete offline BLE chat system for React Native using `react-native-ble-plx` and `react-native-ble-peripheral`.

## Features

- ✅ **Offline-first**: Works completely offline between devices
- ✅ **Message chunking**: Handles messages larger than BLE's 20-byte limit
- ✅ **ACK + retry**: Reliable delivery with automatic retries
- ✅ **Local storage**: Messages persist using AsyncStorage
- ✅ **Dual mode**: Device can act as peripheral (advertising) or central (scanning)
- ✅ **Android permissions**: Handles all required BLE permissions

## Architecture

```
bleChatManager.js     # Main interface
├── bleCentral.js      # Scanning + connecting (react-native-ble-plx)
├── blePeripheral.js   # Advertising + notifying (react-native-ble-peripheral)
├── bleMessaging.js    # Send/receive logic with chunking
├── chunker.js         # Message chunking utilities
├── ackManager.js      # ACK and retry logic
├── bleChatStore.js    # AsyncStorage operations
├── bleConstants.js    # UUIDs and constants
└── blePermissions.js  # Android permissions
```

## Quick Start

### 1. Initialize

```javascript
import { bleChatManager } from './src/chat/bleChatManager';
import { requestBLEPermissions } from './src/chat/blePermissions';

// Request permissions first
const hasPermissions = await requestBLEPermissions();
if (!hasPermissions) return;

// Initialize as peripheral (advertising) or central (scanning)
const config = {
  deviceId: 'your-device-id',
  isPeripheral: true, // or false for central mode
};

const success = await bleChatManager.initialize(config);
```

### 2. Start Discovery

```javascript
// Start advertising or scanning
await bleChatManager.startDiscovery();

// For central mode, you can pass a callback to handle found devices
await bleChatManager.startDiscovery((device) => {
  console.log('Found device:', device.id);
  // Auto-connect or show in UI
});
```

### 3. Send Messages

```javascript
// Send a message (handles chunking, ACK, and local storage automatically)
const messageId = await bleChatManager.sendMessage('Hello World!', 'peer-device-id');
```

### 4. Receive Messages

Messages are automatically received and stored locally. Get them like this:

```javascript
// Get all messages
const allMessages = await bleChatManager.getMessages();

// Get messages with specific peer
const peerMessages = await bleChatManager.getMessagesWithPeer('peer-device-id');
```

## Usage Patterns

### Device A (Peripheral - Advertising)
```javascript
// Initialize as peripheral
await bleChatManager.initialize({ deviceId: 'device-a', isPeripheral: true });

// Start advertising
await bleChatManager.startDiscovery();

// Send messages
await bleChatManager.sendMessage('Hello from A!', 'device-b');
```

### Device B (Central - Scanning)
```javascript
// Initialize as central
await bleChatManager.initialize({ deviceId: 'device-b', isPeripheral: false });

// Start scanning and auto-connect
await bleChatManager.startDiscovery();

// Send messages
await bleChatManager.sendMessage('Hello from B!', 'device-a');
```

## Message Flow

1. **Send**: Message → Chunk → BLE → ACK wait → Retry on timeout
2. **Receive**: BLE data → Parse → Buffer chunks → Reassemble → Save locally → Send ACK
3. **Storage**: All messages saved immediately with status updates

## Android Permissions

The system automatically requests these permissions:
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

## Dependencies

Add to your `package.json`:

```json
{
  "dependencies": {
    "react-native-ble-plx": "^3.1.1",
    "react-native-ble-peripheral": "^0.3.1",
    "@react-native-async-storage/async-storage": "^1.19.3"
  }
}
```

## Integration Notes

- **One device advertises, one scans** - Don't run both modes on the same device
- **Messages persist locally** - No dependency on external services
- **Automatic cleanup** - Old incomplete messages are cleaned up
- **Debug logging** - All operations are logged with `[BLE *]` prefixes

## Troubleshooting

### Messages not appearing
- Check permissions are granted
- Ensure one device is advertising, one is scanning
- Check device Bluetooth is enabled

### Connection issues
- Try restarting both devices
- Check Bluetooth range (should be within ~10 meters)
- Verify no other BLE apps are interfering

### Messages stuck as "sending"
- Check BLE connection status
- Wait for ACK timeout (3 seconds) then retry
- Check debug logs for errors

## Debug Info

Get system status:

```javascript
const stats = bleChatManager.getDebugStats();
console.log('BLE Status:', stats);
```

## Cleanup

When done:

```javascript
bleChatManager.cleanup();
```