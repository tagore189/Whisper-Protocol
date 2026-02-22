import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import {useRouter} from 'expo-router';

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>

        <Text style={styles.topTitle}>Whisper Protocol</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progress}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.activeBar} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.phone} />

          <View style={styles.wavesOuter}>
            <View style={styles.wavesMid}>
              <View style={styles.wavesInner}>
                <MaterialCommunityIcons
                  name="access-point"
                  size={28}
                  color="#6961ff"
                />
              </View>
            </View>
          </View>

          <View style={styles.phone} />
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={styles.title}>Mesh & Ultrasonic</Text>
          <Text style={styles.body}>
            Stay connected without the internet. Whisper uses BLE mesh and
            high-frequency audio to send encrypted messages directly between
            devices, even in dead zones.
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn}
        onPress={() => router.push("/idgen")}>
          <MaterialIcons name="fingerprint" size={22} color="#fff" />
          <Text style={styles.primaryText}>
            Generate Secure Identity
          </Text>
        </Pressable>

        <Pressable style={styles.linkBtn}>
          <Text style={styles.linkText}>
            Learn more about our encryption
          </Text>
          <MaterialIcons
            name="open-in-new"
            size={14}
            color="#9ca3af"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#100f23",
  },

  /* Top */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  /* Progress */
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#312e6b",
  },
  activeBar: {
    width: 32,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6961ff",
  },

  /* Content */
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  illustration: {
    width: width * 0.9,
    aspectRatio: 4 / 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },

  phone: {
    width: 60,
    height: 120,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    borderWidth: 4,
    borderColor: "#374151",
  },

  wavesOuter: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: "rgba(105,97,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  wavesMid: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: "rgba(105,97,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  wavesInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(105,97,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
  },

  /* Footer */
  footer: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },

  primaryBtn: {
    backgroundColor: "#6961ff",
    paddingVertical: 22,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  linkText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "500",
  },
});
