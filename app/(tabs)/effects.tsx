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

const EFFECTS: { key: EffectKind; icon: React.ComponentProps<typeof Ionicons>["name"]; tkey: string }[] = [
  { key: "none",     icon: "ban-outline",           tkey: "effects.none" },
  { key: "snow",     icon: "snow-outline",          tkey: "effects.snow" },
  { key: "rain",     icon: "rainy-outline",         tkey: "effects.rain" },
  { key: "bubbles",  icon: "ellipse-outline",       tkey: "effects.bubbles" },
  { key: "leaves",   icon: "leaf-outline",          tkey: "effects.leaves" },
  { key: "flowers",  icon: "flower-outline",        tkey: "effects.flowers" },
  { key: "particles",icon: "sparkles-outline",      tkey: "effects.particles" },
  { key: "fireflies",icon: "bulb-outline",          tkey: "effects.fireflies" }
];

export default function EffectsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();

  return (
    <BackgroundGradient>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 110 }]}>
        <Text style={styles.h1}>{t("effects.title")}</Text>
        <Text style={styles.sub}>{t("effects.intro")}</Text>

        <GlassCard>
          <View style={styles.grid}>
            {EFFECTS.map((e) => (
              <Pressable
                key={e.key}
                onPress={() => app.setEffect(e.key)}
                style={[styles.cell, app.effect === e.key && styles.cellActive]}
              >
                <Ionicons name={e.icon} size={28} color={app.effect === e.key ? "#0b1f14" : theme.colors.accent} />
                <Text style={[styles.cellLabel, app.effect === e.key && styles.cellLabelActive]}>{t(e.tkey)}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("effects.intensity")}: {Math.round(app.intensity * 100)}%</Text>
          <Slider minimumValue={0} maximumValue={1} value={app.intensity} step={0.01}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setIntensity(v)} />
          <Text style={styles.sectionTitle}>{t("effects.speed")}: {app.speed.toFixed(2)}×</Text>
          <Slider minimumValue={0.2} maximumValue={3} value={app.speed} step={0.05}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setSpeed(v)} />
          <Text style={styles.sectionTitle}>{t("effects.fps")}: {app.fps}</Text>
          <Slider minimumValue={10} maximumValue={60} value={app.fps} step={1}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setFps(Math.round(v))} />
          <Hint text="Меньше FPS — меньше нагрузка на батарею. В режиме «Экономия» FPS автоматически снижен." />
        </GlassCard>

        <PrimaryButton label={t("effects.apply")} icon="sparkles" onPress={() => app.applyLiveWallpaper("home")} style={{ marginTop: 8 }} />
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  h1: { color: theme.colors.textPrimary, fontSize: theme.font.size.xxl, fontWeight: "700" },
  sub: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm, marginTop: 4, marginBottom: 10 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.md, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "23%", marginRight: "2%", marginTop: 6,
    backgroundColor: "rgba(17,227,161,0.08)",
    paddingVertical: 14, alignItems: "center", borderRadius: theme.radii.md,
    borderWidth: 1, borderColor: theme.colors.border
  },
  cellActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  cellLabel: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 6, textAlign: "center" },
  cellLabelActive: { color: "#0b1f14", fontWeight: "700" }
});
