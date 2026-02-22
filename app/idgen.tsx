import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getOrCreateIdentity } from "../backend/identity/identity";

const { width } = Dimensions.get("window");

export default function IdentityGenerationScreen() {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      const identity = await getOrCreateIdentity();
      console.log("IDENTITY:", identity);
    };

    run();
  }, []);

  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#fff" />
        </View>

        <Text style={styles.headerTitle}>SECURE SETUP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Generating Your Identity</Text>
          <Text style={styles.subtitle}>X3DH Protocol • Curve25519</Text>
        </View>

        {/* Visualizer */}
        <View style={styles.visualWrap}>
          <View style={styles.outerRing} />
          <View style={styles.middleRing} />

          <View style={styles.core}>
            <MaterialCommunityIcons name="shield-lock" size={64} color="#fff" />
          </View>

          {/* Particles */}
          <View style={styles.p1} />
          <View style={styles.p2} />
          <View style={styles.p3} />
        </View>

        {/* Checklist */}
        <View style={styles.card}>
          <CheckItem title="Identity Key" subtitle="0x7F...8E21 Verified" />
          <CheckItem
            title="Signed Pre-Key"
            subtitle="ED25519 Signature Active"
          />
          <CheckItem
            title="One-Time Keys"
            subtitle="100/100 Batch Generated"
            progress
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <MaterialIcons name="info" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.infoText}>
            Your cryptographic identity is stored locally in the secure enclave
            and never leaves this device.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push("/radar")}
        >
          <Text style={styles.primaryText}>Continue Securely</Text>
        </Pressable>

        <Text style={styles.footerNote}>
          OFFLINE MESH NETWORK • ULTRASONIC SYNC READY
        </Text>
      </View>
    </View>
  );
}

/* --- Subcomponent --- */

function CheckItem({
  title,
  subtitle,
  progress,
}: {
  title: string;
  subtitle: string;
  progress?: boolean;
}) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkIcon}>
        <MaterialIcons name="check" size={14} color="#fff" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.checkTitle}>{title}</Text>
        <View style={styles.checkSubRow}>
          <Text style={styles.checkSub}>{subtitle}</Text>
          {progress && (
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  titleBlock: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginTop: 6,
  },

  visualWrap: {
    width: 256,
    height: 256,
    alignSelf: "center",
    marginBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 2,
    borderColor: "rgba(105,97,255,0.25)",
  },
  middleRing: {
    position: "absolute",
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.4)",
  },
  core: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6961ff",
    shadowOpacity: 0.5,
    shadowRadius: 25,
  },

  p1: {
    position: "absolute",
    top: 8,
    left: "50%",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6961ff",
  },
  p2: {
    position: "absolute",
    bottom: 20,
    right: 40,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(105,97,255,0.6)",
  },
  p3: {
    position: "absolute",
    bottom: 40,
    left: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(105,97,255,0.4)",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  checkRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#6961ff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  checkSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  checkSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  progressTrack: {
    width: 60,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    backgroundColor: "#6961ff",
  },

  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 32,
    paddingHorizontal: 8,
  },
  infoText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  footer: {
    padding: 24,
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: "#6961ff",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#6961ff",
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footerNote: {
    marginTop: 16,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: "center",
    color: "rgba(255,255,255,0.2)",
  },
});
