import React from 'react';
import { Modal, StyleSheet, Text, View, Pressable } from 'react-native';

export type ConnectionRequestData = {
  fromDeviceId: string;
  fromDeviceName: string;
};

type Props = {
  request: ConnectionRequestData | null;
  onAccept: () => void;
  onReject: () => void;
};

export function ConnectionRequestModal({ request, onAccept, onReject }: Props) {
  if (!request) return null;

  return (
    <Modal transparent animationType="fade" visible={!!request}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Connection Request</Text>
          <Text style={styles.bodyText}>
            <Text style={styles.highlight}>{request.fromDeviceName || 'Unknown Device'}</Text> wants to connect.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.rejectButton]} onPress={onReject}>
              <Text style={styles.buttonText}>Reject</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.acceptButton]} onPress={onAccept}>
              <Text style={styles.buttonText}>Accept</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1935',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  bodyText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  highlight: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  acceptButton: {
    backgroundColor: '#6961ff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
