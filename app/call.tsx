import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function UltrasonicTransferScreen() {
  return (
    <View style={styles.root}>
      {/* Concentric Pulse Rings */}
      <View style={styles.ringOuter} />
      <View style={styles.ringMid} />
      <View style={styles.ringInner} />
      <View style={styles.ringCore} />

      {/* Top Status */}
      <View style={styles.statusBar}>
        <View style={styles.statusPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusText}>
            BROADCASTING
          </Text>
        </View>
      </View>

      {/* Center Content */}
      <View style={styles.center}>
        <View style={styles.iconGlow}>
          <MaterialIcons
            name="graphic-eq"
            size={64}
            color="#00f5ff"
          />
        </View>

        <Text style={styles.title}>
          Transmitting encrypted payload via sound
        </Text>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <MaterialIcons
              name="lock"
              size={14}
              color="#00f5ff"
            />
            <Text style={styles.metaText}>
              AES-256 ENCRYPTED
            </Text>
          </View>
          <Text style={styles.subMeta}>
            BLE Mesh Network Active
          </Text>
        </View>
      </View>

      {/* Bottom Visualizer */}
      <View style={styles.bottom}>
        {/* Frequency / Signal */}
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statLabel}>
              FREQUENCY
            </Text>
            <Text style={styles.freq}>
              18.52{" "}
              <Text style={styles.khz}>kHz</Text>
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.statLabel}>
              SIGNAL
            </Text>
            <Text style={styles.signal}>
              98.4% Stable
            </Text>
          </View>
        </View>

        {/* Fake Waveform */}
        <View style={styles.waveform}>
          {Array.from({ length: 28 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height:
                    8 + Math.abs(14 - i) * 2,
                  opacity:
                    i % 2 === 0 ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.progressMeta}>
          <Text style={styles.progressText}>
            Transferred 2.4 MB
          </Text>
          <Text style={styles.progressPct}>
            64% COMPLETE
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn}>
            <Text style={styles.cancelText}>
              Cancel Transfer
            </Text>
          </TouchableOpacity>

          <View style={styles.protocolRow}>
            <MaterialIcons
              name="sensors"
              size={14}
              color="rgba(255,255,255,0.3)"
            />
            <Text style={styles.protocolText}>
              Variant 8.0 // Protocol 1.4
            </Text>
          </View>
        </View>
      </View>

      {/* Corner Lines */}
      <View style={styles.cornerTL} />
      <View style={styles.cornerTR} />
      <View style={styles.cornerBL} />
      <View style={styles.cornerBR} />
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0a14",
    padding: 24,
    justifyContent: "space-between",
  },

  /* Rings */
  ringOuter: {
    position: "absolute",
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.1)",
    alignSelf: "center",
    top: "15%",
  },
  ringMid: {
    position: "absolute",
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.2)",
    alignSelf: "center",
    top: "20%",
  },
  ringInner: {
    position: "absolute",
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width,
    borderWidth: 1,
    borderColor: "rgba(0,245,255,0.3)",
    alignSelf: "center",
    top: "25%",
  },
  ringCore: {
    position: "absolute",
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width,
    borderWidth: 2,
    borderColor: "rgba(0,245,255,0.4)",
    alignSelf: "center",
    top: "30%",
  },

  /* Status */
  statusBar: {
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00f5ff",
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 3,
    color: "rgba(0,245,255,0.8)",
    fontWeight: "700",
  },

  /* Center */
  center: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
  },
  iconGlow: {
    padding: 24,
    borderRadius: 999,
    backgroundColor: "rgba(0,245,255,0.15)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  meta: {
    alignItems: "center",
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    letterSpacing: 2,
    color: "rgba(0,245,255,0.6)",
    fontWeight: "600",
  },
  subMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },

  /* Bottom */
  bottom: {
    gap: 20,
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "700",
  },
  freq: {
    fontSize: 28,
    fontWeight: "800",
    color: "#00f5ff",
  },
  khz: {
    fontSize: 14,
    fontWeight: "400",
    opacity: 0.7,
  },
  signal: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },

  waveform: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 80,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "#00f5ff",
  },

  progressTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    width: "64%",
    height: "100%",
    backgroundColor: "#6961ff",
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  progressPct: {
    fontSize: 11,
    color: "#6961ff",
    fontWeight: "700",
  },

  actions: {
    alignItems: "center",
    gap: 12,
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelText: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
  },
  protocolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  protocolText: {
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.3)",
  },

  /* Corners */
  cornerTL: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 24,
    height: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cornerTR: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 24,
    height: 24,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cornerBL: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cornerBR: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 24,
    height: 24,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
});
