import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function SettingsScreen() {
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

        {/* Appearance */}
        <Section title="Appearance">
          <Row
            icon="dark-mode"
            label="Dark Mode"
            description="High-contrast dark theme is enforced for field operations."
            disabled
            value
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
          <Row
            icon="surround-sound"
            label="Ultrasonic Audio"
            description="Encrypted transmission via 18kHz+ audio."
            value
          />
        </Section>

        {/* Advanced */}
        <Section title="Advanced">
          <Row
            icon="terminal"
            label="Debug Mode"
          />

          <Pressable style={styles.dangerRow}>
            <View style={styles.rowLeft}>
              <View style={styles.dangerIcon}>
                <MaterialIcons
                  name="delete-forever"
                  size={22}
                  color="#ef4444"
                />
              </View>
              <Text style={styles.dangerText}>
                Purge Message Cache
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
            Whisper Protocol
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
}: {
  icon: any;
  label: string;
  description?: string;
  value?: boolean;
  disabled?: boolean;
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
