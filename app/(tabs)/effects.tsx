import React from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Hint } from "@/components/Hint";
import { theme } from "@/theme/theme";
import { useApp, EffectKind } from "@/contexts/AppContext";

const EFFECTS: { key: EffectKind; icon: React.ComponentProps<typeof Ionicons>["name"]; i18nKey: string }[] = [
  { key: "none", icon: "ban-outline", i18nKey: "effects.none" },
  { key: "snow", icon: "snow-outline", i18nKey: "effects.snow" },
  { key: "rain", icon: "rainy-outline", i18nKey: "effects.rain" },
  { key: "bubbles", icon: "ellipse-outline", i18nKey: "effects.bubbles" },
  { key: "leaves", icon: "leaf-outline", i18nKey: "effects.leaves" },
  { key: "flowers", icon: "flower-outline", i18nKey: "effects.flowers" },
  { key: "particles", icon: "sparkles-outline", i18nKey: "effects.particles" },
  { key: "fireflies", icon: "bulb-outline", i18nKey: "effects.fireflies" },
  { key: "fog", icon: "cloudy-outline", i18nKey: "effects.fog" },
  { key: "frost", icon: "snow-outline", i18nKey: "effects.frost" },
  { key: "stars", icon: "star-outline", i18nKey: "effects.stars" },
  { key: "aurora", icon: "color-wand-outline", i18nKey: "effects.aurora" },
  { key: "meteor", icon: "flash-outline", i18nKey: "effects.meteor" },
  { key: "cherryblossom", icon: "flower-outline", i18nKey: "effects.cherryblossom" },
  { key: "plasma", icon: "color-filter-outline", i18nKey: "effects.plasma" },
];

export default function EffectsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();

  return (
    <BackgroundGradient>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 120 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>{t("effects.title")}</Text>
            <Text style={styles.hSub}>{t("effects.heroSubtitle")}</Text>
          </View>
          <View style={styles.badgeOk}>
            <Text style={styles.badgeOkText}>{t("effects.badgeLive")}</Text>
          </View>
        </View>

        {/* The effect already renders across the whole app via
            GlobalEffectLayer (in BackgroundGradient). Instead of showing a
            boxed mini-preview here, give a short status card — the visible
            effect IS the preview. */}
        <GlassCard>
          <View style={[styles.rowBetween]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHead}>
                {t("effects.title")}
              </Text>
              <Text style={[styles.label, { marginTop: 4 }]}>
                {app.effect === "none"
                  ? t("effects.noneDesc")
                  : t("effects.liveAround")}
              </Text>
            </View>
            <View style={[styles.badgeOk, { marginLeft: 10 }]}>
              <Ionicons
                name={app.effect === "none" ? "ban-outline" : "sparkles"}
                size={12}
                color="#0b1f14"
              />
              <Text style={[styles.badgeOkText, { marginLeft: 4 }]}>
                {app.effect === "none" ? t("common.off") : t("common.on")}
              </Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.cardHead}>{t("effects.enginePerf")}</Text>
          <View style={[styles.row, { marginTop: 8, gap: 10 }]}>
            <Pressable onPress={() => app.setPerfMode("eco")} style={[styles.perfChip, app.perfMode === "eco" && styles.perfChipActive]}>
              <Ionicons name="flash-outline" size={16} color={app.perfMode === "eco" ? "#0b1f14" : theme.colors.accent} />
              <Text style={[styles.perfLabel, app.perfMode === "eco" && styles.perfLabelActive]}>{t("effects.ecoMode")}</Text>
            </Pressable>
            <Pressable onPress={() => app.setPerfMode("balanced")} style={[styles.perfChip, app.perfMode === "balanced" && styles.perfChipActive]}>
              <Ionicons name="sync-outline" size={16} color={app.perfMode === "balanced" ? "#0b1f14" : theme.colors.accent} />
              <Text style={[styles.perfLabel, app.perfMode === "balanced" && styles.perfLabelActive]}>{t("effects.balanced")}</Text>
            </Pressable>
            <Pressable onPress={() => app.setPerfMode("high")} style={[styles.perfChip, app.perfMode === "high" && styles.perfChipActive]}>
              <Ionicons name="speedometer-outline" size={16} color={app.perfMode === "high" ? "#0b1f14" : theme.colors.accent} />
              <Text style={[styles.perfLabel, app.perfMode === "high" && styles.perfLabelActive]}>{t("effects.highPerf")}</Text>
            </Pressable>
          </View>

          <View style={[styles.rowBetween, { marginTop: 14 }]}>
            <Text style={styles.label}>{t("effects.fpsLabel")}</Text>
            <Text style={styles.value}>{app.fps} FPS</Text>
          </View>
          <Slider minimumValue={10} maximumValue={60} value={app.fps} step={1}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setFps(Math.round(v))} />

          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Text style={styles.label}>{t("effects.intensity")}</Text>
            <Text style={styles.value}>{Math.round(app.intensity * 100)}%</Text>
          </View>
          <Slider minimumValue={0} maximumValue={1} value={app.intensity} step={0.01}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setIntensity(v)} />

          <View style={[styles.rowBetween, { marginTop: 10 }]}>
            <Text style={styles.label}>{t("effects.speed")}</Text>
            <Text style={styles.value}>{app.speed.toFixed(2)}×</Text>
          </View>
          <Slider minimumValue={0.2} maximumValue={3} value={app.speed} step={0.05}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setSpeed(v)} />
        </GlassCard>

        <View style={styles.rowBetween}>
          <Text style={styles.cardHead}>{t("effects.atmosphericLayers")}</Text>
          <Pressable onPress={() => app.setEffect("none")} style={styles.resetBtn}>
            <Text style={styles.resetText}>{t("effects.reset")}</Text>
          </Pressable>
        </View>

        <View style={styles.layerGrid}>
          {EFFECTS.map((e) => {
            const isSelected = app.effect === e.key;
            return (
              <Pressable key={e.key} onPress={() => app.setEffect(e.key)} style={[styles.layerCell, isSelected && styles.layerCellActive]}>
                <Ionicons name={e.icon} size={24} color={isSelected ? "#0b1f14" : theme.colors.accent} />
                <Text style={[styles.layerLabel, isSelected && styles.layerLabelActive]}>{t(e.i18nKey)}</Text>
                <View style={[styles.switchDot, isSelected && styles.switchDotOn]}>
                  <View style={[styles.switchKnob, isSelected && styles.switchKnobOn]} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton
          label={t("home.setLock")}
          icon="lock-closed-outline"
          onPress={() => app.applyLiveWallpaper("lock")}
          style={{ marginTop: 12 }}
        />
        <PrimaryButton
          label={t("home.setHome")}
          icon="home-outline"
          variant="secondary"
          onPress={() => app.applyLiveWallpaper("home")}
          style={{ marginTop: 8 }}
        />

        <Hint text={t("effects.syncHint")} />
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 },
  h1: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "800" },
  hSub: { color: theme.colors.accent, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  badgeOk: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(17,227,161,0.15)", borderWidth: 1, borderColor: theme.colors.border },
  badgeOkText: { color: theme.colors.accent, fontSize: 11, fontWeight: "600" },
  previewTag: { position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.45)" },
  previewTagText: { color: theme.colors.textPrimary, fontSize: 11, fontWeight: "600" },
  cardHead: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  perfChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: theme.radii.pill, backgroundColor: "rgba(17,227,161,0.1)", borderWidth: 1, borderColor: theme.colors.border },
  perfChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  perfLabel: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  perfLabelActive: { color: "#0b1f14" },
  label: { color: theme.colors.textSecondary, fontSize: 13 },
  value: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: "rgba(17,227,161,0.08)", borderWidth: 1, borderColor: theme.colors.border },
  resetText: { color: theme.colors.accent, fontSize: 12, fontWeight: "600" },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 6 },
  layerCell: { width: "48%", aspectRatio: 1.3, marginBottom: 10, borderRadius: 22, padding: 14, backgroundColor: "rgba(10,28,20,0.7)", borderWidth: 1, borderColor: theme.colors.border, justifyContent: "space-between" },
  layerCellActive: { backgroundColor: "rgba(17,227,161,0.22)", borderColor: theme.colors.accent },
  layerLabel: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" },
  layerLabelActive: { color: theme.colors.textPrimary },
  switchDot: { alignSelf: "flex-end", width: 36, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: theme.colors.border, padding: 2 },
  switchDotOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  switchKnob: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff" },
  switchKnobOn: { marginLeft: 16 },
});
