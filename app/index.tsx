import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();

  // Simulate boot → navigate next
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/onboarding");
    }, 2200);

    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.root}>
      {/* Ambient blobs */}
      <BlurView intensity={120} tint="dark" style={styles.blobTop} />
      <BlurView intensity={120} tint="dark" style={styles.blobBottom} />

      {/* Main Content */}
      <View style={styles.center}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.ringOuter} />
          <View style={styles.ringInner} />

          <View style={styles.logo}>
            <BlurView intensity={20} tint="dark" style={styles.logoInner}>
              <MaterialIcons
                name="waves"
                size={64}
                color="#6961ff"
              />
              <MaterialIcons
                name="lock"
                size={32}
                color="#ffffff"
                style={styles.lock}
              />
            </BlurView>
          </View>
        </View>

        {/* Text */}
        <Text style={styles.title}>Whisper Protocol</Text>
        <Text style={styles.subtitle}>
          SECURE • OFFLINE • UNTRACEABLE
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.loaderTrack}>
          <View style={styles.loaderBar} />
        </View>

        <Text style={styles.bootText}>
          Initializing Secure Mesh
        </Text>
        <Text style={styles.version}>
          v1.0.0 · Encrypted Mesh Network
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B0F1A",
    alignItems: "center",
    justifyContent: "center",
  },

  blobTop: {
    position: "absolute",
    top: -80,
    left: -80,
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: "rgba(105,97,255,0.12)",
    borderRadius: 999
  },

  blobBottom: {
    position: "absolute",
    bottom: -80,
    right: -80,
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: "rgba(105,97,255,0.06)",
    borderRadius: 999
  },

  center: {
    alignItems: "center",
    gap: 24,
  },

  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  ringOuter: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.2)",
    opacity: 0.3,
  },

  ringInner: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: "rgba(105,97,255,0.3)",
    opacity: 0.5,
  },

  logo: {
    width: 128,
    height: 128,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#6961ff",
    shadowOpacity: 0.2,
    shadowRadius: 40,
  },

  logoInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  lock: {
    position: "absolute",
    marginTop: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 12,
    letterSpacing: 3,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    bottom: 56,
    alignItems: "center",
    gap: 12,
  },

  loaderTrack: {
    width: 180,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },

  loaderBar: {
    width: "35%",
    height: "100%",
    backgroundColor: "#6961ff",
    borderRadius: 4,
  },

  bootText: {
    fontSize: 12,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.35)",
  },

  version: {
    fontSize: 10,
    color: "rgba(144,141,206,0.4)",
  },
});
