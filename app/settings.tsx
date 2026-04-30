import { MaterialIcons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppSettings } from '../src/core/AppSettingsContext';
// Supabase has been removed in favor of fully offline BLE.
import { localDatabase } from '../src/storage/localDatabase';

export default function SettingsScreen() {

  const { settings: appSettings, updateSettings } = useAppSettings();

  const handleClearChatHistory = () => {
    Alert.alert("Clear Chat History", "Are you sure you want to delete all messages from the Supabase db?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await localDatabase.clearAll();
          Alert.alert("Success", "Local chat history cleared.");
        } catch (e) {
          Alert.alert("Error", "Failed to clear local chat history.");
        }
      }},
    ]);
  };


  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn}>
          <MaterialIcons
            name="arrow-back-ios-new"
            size={20}
            color="#fff"
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Settings & About
        </Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Protocol Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <MaterialIcons
              name="security"
              size={22}
              color="#6961ff"
            />
            <View>
              <Text style={styles.statusLabel}>
                PROTOCOL STATUS
              </Text>
              <Text style={styles.statusSub}>
                Mesh Active & Scanning
              </Text>
            </View>
          </View>

          <View style={styles.cryptoBadge}>
            <Text style={styles.cryptoText}>
              AES-256-GCM
            </Text>
          </View>
        </View>

        {/* Device Info */}
        <Section title="Device Identity">
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="perm-identity" size={22} color="#6961ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Device ID</Text>
                <Text style={styles.rowDesc} selectable>{appSettings.deviceId}</Text>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <MaterialIcons name="badge" size={22} color="#6961ff" />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.rowLabel}>Device Name</Text>
                <TextInput
                  style={[styles.rowDesc, styles.inputField]}
                  value={appSettings.deviceName}
                  onChangeText={(val) => updateSettings({ deviceName: val })}
                  placeholder="Enter Device Name"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>
          </View>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Row
            icon="dark-mode"
            label="Dark Mode"
            description="Toggle Dark/Light theme"
            value={appSettings.theme === "dark"}
            onValueChange={(val) => updateSettings({ theme: val ? "dark" : "light" })}
          />
        </Section>

        {/* Transport Toggles */}
        <Section title="Transport Toggles">
          <Row
            icon="bluetooth"
            label="BLE Mesh"
            description="Peer-to-peer discovery using Low Energy radio."
            value
          />

        </Section>

        {/* Notifications & Security */}
        <Section title="Notifications">
          <Row
            icon="notifications"
            label="Connection Requests"
            description="Alerts for incoming mesh pairing requests"
            value={appSettings.connectionRequestsEnabled}
            onValueChange={(val) => updateSettings({ connectionRequestsEnabled: val })}
          />
          <Row
            icon="notifications-active"
            label="New Messages"
            description="Alerts for incoming mesh chat messages"
            value={appSettings.notificationsEnabled}
            onValueChange={(val) => updateSettings({ notificationsEnabled: val })}
          />
        </Section>

        <Section title="Privacy & Security">
          <Row
            icon="security"
            label="Require Confirmation"
            description="Ask before accepting connection requests"
            value={appSettings.requireConfirmation}
            onValueChange={(val) => updateSettings({ requireConfirmation: val })}
          />
          
          <Pressable style={styles.dangerRow} onPress={handleClearChatHistory}>
            <View style={styles.rowLeft}>
              <View style={styles.dangerIcon}>
                <MaterialIcons
                  name="delete-forever"
                  size={22}
                  color="#ef4444"
                />
              </View>
              <Text style={styles.dangerText}>
                Clear Chat History
              </Text>
            </View>

            <MaterialIcons
              name="chevron-right"
              size={18}
              color="#9ca3af"
            />
          </Pressable>
        </Section>

        {/* About */}
        <View style={styles.about}>
          <View style={styles.appIcon}>
            <MaterialIcons
              name="record-voice-over"
              size={36}
              color="#fff"
            />
          </View>

          <Text style={styles.appName}>
            FortiLink
          </Text>
          <Text style={styles.version}>
            v1.0.10.rev-24
          </Text>

          <View style={styles.aboutLinks}>
            <AboutRow label="Open Source Notice" value="GitHub" />
            <AboutRow label="Cryptographic Audit" value="Report" />
            <AboutRow label="Developer" value="Silent Labs" />
          </View>

          <Text style={styles.disclaimer}>
            This communication tool utilizes the Double Ratchet
            Algorithm and X3DH for end-to-end encryption over
            non-traditional vectors. Use with discretion.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ---------- Reusable Components ---------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  description,
  value,
  disabled,
  onValueChange,
}: {
  icon: any;
  label: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <MaterialIcons
            name={icon}
            size={22}
            color="#6961ff"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>
            {label}
          </Text>
          {description && (
            <Text style={styles.rowDesc}>
              {description}
            </Text>
          )}
        </View>
      </View>

      <Switch
        value={!!value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{
          false: "#374151",
          true: "#6961ff",
        }}
        thumbColor="#fff"
      />
    </View>
  );
}

function AboutRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
  },

  header: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },

  content: {
    paddingBottom: 40,
  },

  statusCard: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(105,97,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.25)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLeft: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#6961ff",
    fontWeight: "700",
  },
  statusSub: {
    fontSize: 12,
    color: "#9ca3af",
  },
  cryptoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(105,97,255,0.2)",
  },
  cryptoText: {
    fontSize: 10,
    color: "#6961ff",
    fontWeight: "700",
  },

  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#9ca3af",
    paddingHorizontal: 20,
    marginBottom: 6,
    fontWeight: "700",
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#1a1935",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowLeft: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flex: 1,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(105,97,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  rowDesc: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  inputField: {
    color: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(105,97,255,0.4)",
    paddingVertical: 2,
  },

  dangerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },

  about: {
    alignItems: "center",
    padding: 24,
    marginTop: 32,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
  },
  version: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },

  aboutLinks: {
    width: "100%",
    marginTop: 24,
    gap: 12,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aboutLabel: {
    color: "#9ca3af",
  },
  aboutValue: {
    color: "#6961ff",
    fontWeight: "600",
  },

  disclaimer: {
    marginTop: 32,
    fontSize: 10,
    letterSpacing: 2,
    color: "#6b7280",
    textAlign: "center",
  },
});
