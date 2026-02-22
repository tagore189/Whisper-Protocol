import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getOrCreateIdentity } from '../../src/backend/identity/identity';
import { Node, startScanning, stopScanning } from '../../src/backend/ble/scan';

function formatNodeLabel(nodeId: string): string {
  if (nodeId.length <= 12) {
    return nodeId;
  }
  return `${nodeId.slice(0, 6)}...${nodeId.slice(-4)}`;
}

export default function MeshVisualizationScreen() {
  const router = useRouter();
  const [myId, setMyId] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string>('');

  const startScan = useCallback(async () => {
    setScanError('');
    const started = await startScanning((discoveredNodes) => {
      setNodes(discoveredNodes);
    });
    setScanning(started);
    if (!started) {
      setScanError('Scanning could not start. Check BLE permissions and adapter state.');
    }
  }, []);

  const stopScan = useCallback(() => {
    stopScanning();
    setScanning(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    getOrCreateIdentity()
      .then((identity) => {
        if (mounted) {
          setMyId(identity.nodeId);
        }
      })
      .catch((error) => {
        console.error('Failed to load identity:', error);
      });

    startScan().catch((error) => {
      console.error('Failed to start scan:', error);
      setScanning(false);
      setScanError('Failed to start scanning.');
    });

    return () => {
      mounted = false;
      stopScan();
    };
  }, [startScan, stopScan]);

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)),
    [nodes]
  );

  const onConnect = useCallback(
    (peerId: string) => {
      router.push({ pathname: '/chatroom', params: { peerId } });
    },
    [router]
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Mesh Scanner</Text>
        <View style={styles.statusWrap}>
          <View style={[styles.dot, scanning ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.statusText}>{scanning ? 'Scanning' : 'Stopped'}</Text>
        </View>
      </View>

      <View style={styles.identityCard}>
        <Text style={styles.identityLabel}>Your Identity</Text>
        <Text selectable style={styles.identityValue}>
          {myId || 'Loading...'}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable style={[styles.controlBtn, styles.controlPrimary]} onPress={startScan}>
          <MaterialIcons name="radar" size={18} color="#fff" />
          <Text style={styles.controlPrimaryText}>Start Scan</Text>
        </Pressable>
        <Pressable style={[styles.controlBtn, styles.controlSecondary]} onPress={stopScan}>
          <MaterialIcons name="stop-circle" size={18} color="#9ca3af" />
          <Text style={styles.controlSecondaryText}>Stop</Text>
        </Pressable>
      </View>

      {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nearby Devices</Text>
        <Text style={styles.count}>{sortedNodes.length}</Text>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {sortedNodes.map((node) => (
          <View key={node.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="devices" size={18} color="#6961ff" />
              <View>
                <Text style={styles.nodeId}>{formatNodeLabel(node.id)}</Text>
                <Text style={styles.nodeMeta}>
                  RSSI {node.rssi ?? 'N/A'} | seen {new Date(node.lastSeen).toLocaleTimeString()}
                </Text>
              </View>
            </View>
            <Pressable style={styles.connectBtn} onPress={() => onConnect(node.id)}>
              <Text style={styles.connectText}>Chat</Text>
            </Pressable>
          </View>
        ))}
        {!sortedNodes.length ? (
          <Text style={styles.emptyText}>No nearby devices found yet.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#100f23',
    paddingTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: '#22c55e',
  },
  dotOff: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  identityCard: {
    margin: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  identityLabel: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 6,
  },
  identityValue: {
    color: '#fff',
    fontSize: 13,
  },
  controls: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  controlPrimary: {
    backgroundColor: '#6961ff',
  },
  controlSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  controlPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  controlSecondaryText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#fca5a5',
    paddingHorizontal: 16,
    paddingTop: 10,
    fontSize: 12,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  count: {
    color: '#6961ff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  row: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  nodeId: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  nodeMeta: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  connectBtn: {
    backgroundColor: 'rgba(105,97,255,0.2)',
    borderColor: '#6961ff',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  connectText: {
    color: '#6961ff',
    fontWeight: '700',
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
  },
});
