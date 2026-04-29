import { ackManager } from './ackManager';
import { connectToDevice, disconnectDevice, initCentral, isConnected, monitorCharacteristic, startScanning, stopScanning } from './bleCentral';
import { bleChatStore } from './bleChatStore';
import { cleanupMessageBuffer, handleIncomingBLEData, sendMessageBLE } from './bleMessaging';
import { initPeripheral, isAdvertising, startAdvertising, stopAdvertising } from './blePeripheral';

export interface BLEChatConfig {
  deviceId: string;
  isPeripheral: boolean; // true = advertise, false = scan
}

/**
 * Main BLE Chat Manager
 */
class BLEChatManager {
  private config: BLEChatConfig | null = null;
  private monitorUnsubscribe: (() => void) | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize BLE chat system
   */
  async initialize(config: BLEChatConfig): Promise<boolean> {
    this.config = config;

    try {
      // Initialize BLE components
      let centralInit = true;
      let peripheralInit = true;

      if (!config.isPeripheral) {
        centralInit = await initCentral();
      } else {
        peripheralInit = await initPeripheral();
      }

      if (!centralInit && !peripheralInit) {
        console.error('[BLE Chat] Failed to initialize BLE components');
        return false;
      }

      // Initialize chat store
      await bleChatStore.initialize();

      // Start cleanup interval
      this.cleanupInterval = setInterval(() => {
        cleanupMessageBuffer();
      }, 10000); // Clean up every 10 seconds

      console.log('[BLE Chat] Initialized successfully as', config.isPeripheral ? 'peripheral' : 'central');
      return true;
    } catch (error) {
      console.error('[BLE Chat] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Start BLE discovery (advertising or scanning)
   */
  async startDiscovery(onDeviceFound?: (device: any) => void): Promise<boolean> {
    if (!this.config) {
      console.error('[BLE Chat] Not initialized');
      return false;
    }

    try {
      if (this.config.isPeripheral) {
        // Start advertising
        const success = await startAdvertising();
        if (success) {
          console.log('[BLE Chat] Started advertising as peripheral');
        }
        return success;
      } else {
        // Start scanning
        const success = await startScanning((device) => {
          console.log('[BLE Chat] Found device:', device.id, device.name);
          if (onDeviceFound) {
            onDeviceFound(device);
          } else {
            // Auto-connect to found devices
            this.connectToDevice(device);
          }
        });

        if (success) {
          console.log('[BLE Chat] Started scanning as central');
        }
        return success;
      }
    } catch (error) {
      console.error('[BLE Chat] Failed to start discovery:', error);
      return false;
    }
  }

  /**
   * Stop BLE discovery
   */
  stopDiscovery(): boolean {
    if (!this.config) return false;

    try {
      if (this.config.isPeripheral) {
        return stopAdvertising();
      } else {
        return stopScanning();
      }
    } catch (error) {
      console.error('[BLE Chat] Failed to stop discovery:', error);
      return false;
    }
  }

  /**
   * Connect to a BLE device
   */
  async connectToDevice(device: any): Promise<boolean> {
    if (!this.config || this.config.isPeripheral) {
      console.error('[BLE Chat] Only central mode can connect to devices');
      return false;
    }

    try {
      const success = await connectToDevice(device);
      if (success) {
        // Start monitoring for incoming data
        this.startMonitoring();

        // Save connection status
        await bleChatStore.saveConnectionStatus(true, device.id);
        console.log('[BLE Chat] Connected and monitoring device:', device.id);
      }
      return success;
    } catch (error) {
      console.error('[BLE Chat] Failed to connect to device:', error);
      return false;
    }
  }

  /**
   * Disconnect from BLE device
   */
  async disconnect(): Promise<boolean> {
    try {
      // Stop monitoring
      this.stopMonitoring();

      // Disconnect
      const success = await disconnectDevice();

      // Save connection status
      await bleChatStore.saveConnectionStatus(false);

      console.log('[BLE Chat] Disconnected from device');
      return success;
    } catch (error) {
      console.error('[BLE Chat] Failed to disconnect:', error);
      return false;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(content: string, receiverId: string): Promise<string> {
    if (!this.config) {
      throw new Error('BLE Chat not initialized');
    }

    if (!isConnected() && !isAdvertising()) {
      throw new Error('No BLE connection available');
    }

    return await sendMessageBLE(content, this.config.deviceId, receiverId, this.config.isPeripheral);
  }

  /**
   * Get all messages
   */
  async getMessages() {
    return await bleChatStore.getMessages();
  }

  /**
   * Get messages with a specific peer
   */
  async getMessagesWithPeer(peerId: string) {
    if (!this.config) return [];
    return await bleChatStore.getMessagesWithPeer(this.config.deviceId, peerId);
  }

  /**
   * Start monitoring characteristic for incoming data
   */
  private startMonitoring(): void {
    if (this.monitorUnsubscribe) {
      this.monitorUnsubscribe();
    }

    this.monitorUnsubscribe = monitorCharacteristic((data) => {
      handleIncomingBLEData(data);
    });

    if (this.monitorUnsubscribe) {
      console.log('[BLE Chat] Started monitoring characteristic');
    }
  }

  /**
   * Stop monitoring characteristic
   */
  private stopMonitoring(): void {
    if (this.monitorUnsubscribe) {
      this.monitorUnsubscribe();
      this.monitorUnsubscribe = null;
      console.log('[BLE Chat] Stopped monitoring characteristic');
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus() {
    return await bleChatStore.getConnectionStatus();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return isConnected();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopDiscovery();
    this.stopMonitoring();
    ackManager.clearAll();

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    console.log('[BLE Chat] Cleanup completed');
  }

  /**
   * Get debug stats
   */
  getDebugStats() {
    return {
      isInitialized: this.config !== null,
      isPeripheral: this.config?.isPeripheral || false,
      isConnected: isConnected(),
      isAdvertising: isAdvertising(),
      pendingAcks: ackManager.getPendingCount(),
    };
  }
}

export const bleChatManager = new BLEChatManager();