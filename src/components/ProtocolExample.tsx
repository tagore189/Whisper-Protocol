/**
 * Example Integration Component
 * Demonstrates how to use the converted React Native backend
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useProtocol } from '../hooks/useProtocol';

interface ExampleComponentProps {
  // Optional props
}

export function ProtocolExampleComponent() {
  const {
    identity,
    loading,
    error,
    ble,
    encryption,
    messages,
    mesh,
  } = useProtocol();

  const [messageText, setMessageText] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [encryptionStatus, setEncryptionStatus] = useState<string>('Not initialized');

  // Initialize encryption when identity is ready
  useEffect(() => {
    if (identity) {
      setEncryptionStatus('Ready');
    }
  }, [identity]);

  // Auto-start scanning on mount
  useEffect(() => {
    if (ble && !ble.scanning) {
      ble.startScan();
    }
  }, [ble]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !identity || !selectedPeer) {
      alert('Please enter a message and select a peer');
      return;
    }

    try {
      // Add message to store
      await messages.addMessage(
        identity.nodeId,
        selectedPeer,
        { text: messageText, timestamp: Date.now() }
      );

      // Encrypt the message
      const encrypted = await encryption.encrypt(
        messageText,
        selectedPeer + '_public_key' // In real app, get actual public key
      );

      if (encrypted) {
        // Create and send packet through mesh
        const packet = await mesh.createAndSendPacket(
          identity.nodeId,
          selectedPeer,
          encrypted
        );

        if (packet) {
          setMessageText('');
          alert('Message sent!');
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Initializing Protocol...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Retry" onPress={() => window.location.reload()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Identity Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identity</Text>
        <Text style={styles.label}>Node ID:</Text>
        <Text style={styles.value}>
          {identity?.nodeId?.substring(0, 16)}...
        </Text>
        <Text style={styles.label}>Encryption Status:</Text>
        <Text style={[styles.value, { color: '#00AA00' }]}>
          {encryptionStatus}
        </Text>
      </View>

      {/* BLE Status Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BLE Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Scanning:</Text>
          <Text style={styles.value}>
            {ble.scanning ? '✓ Active' : '✗ Inactive'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Advertising:</Text>
          <Text style={styles.value}>
            {ble.advertising ? '✓ Active' : '✗ Inactive'}
          </Text>
        </View>

        {ble.error && (
          <Text style={styles.errorText}>BLE Error: {ble.error}</Text>
        )}

        <Button
          title={ble.scanning ? 'Stop Scanning' : 'Start Scanning'}
          onPress={ble.startScan}
        />
      </View>

      {/* Discovered Nodes Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Discovered Nodes ({ble.nodes.length})
        </Text>
        <FlatList
          scrollEnabled={false}
          data={ble.nodes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.nodeItem}>
              <Text style={styles.nodeId}>{item.id.substring(0, 12)}...</Text>
              <Text style={styles.nodeInfo}>RSSI: {item.rssi || 'N/A'}</Text>
              <Text style={styles.nodeInfo}>
                Last Seen: {new Date(item.lastSeen).toLocaleTimeString()}
              </Text>
              <Button
                title="Select"
                onPress={() => setSelectedPeer(item.id)}
                color={selectedPeer === item.id ? '#00AA00' : '#0066FF'}
              />
            </View>
          )}
        />
      </View>

      {/* Messages Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversations</Text>

        {messages.conversations.length === 0 ? (
          <Text style={styles.placeholderText}>No conversations yet</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={messages.conversations}
            keyExtractor={(item) => item.peerId}
            renderItem={({ item }) => (
              <View style={styles.conversationItem}>
                <Text style={styles.label}>Peer: {item.peerId.substring(0, 12)}...</Text>
                <Text style={styles.value}>Messages: {item.messages.length}</Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Send Message Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Send Message</Text>

        {selectedPeer ? (
          <>
            <Text style={styles.label}>
              Recipient: {selectedPeer.substring(0, 12)}...
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter message"
              value={messageText}
              onChangeText={setMessageText}
              multiline
            />
            <Button
              title="Send Message"
              onPress={handleSendMessage}
              color="#00AA00"
            />
          </>
        ) : (
          <Text style={styles.placeholderText}>
            Please select a peer from the nodes list
          </Text>
        )}
      </View>

      {/* Pending Messages Section */}
      {messages.pendingMessages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pending Messages ({messages.pendingMessages.length})
          </Text>
          <FlatList
            scrollEnabled={false}
            data={messages.pendingMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.messageItem}>
                <Text style={styles.label}>ID: {item.id.substring(0, 8)}...</Text>
                <Text style={styles.value}>To: {item.to.substring(0, 8)}...</Text>
              </View>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  errorText: {
    color: '#d32f2f',
    marginVertical: 8,
    fontSize: 14,
  },
  nodeItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0066FF',
  },
  nodeId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  nodeInfo: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  conversationItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
  },
  messageItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 10,
    marginVertical: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    marginVertical: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default ProtocolExampleComponent;
