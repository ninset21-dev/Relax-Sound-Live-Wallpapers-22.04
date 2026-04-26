import React, { useState } from "react";
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "@/theme/theme";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { useApp } from "@/contexts/AppContext";
import { Accessibility } from "@/native";

/**
 * First-launch onboarding (req #12). Walks the user through the key
 * features they need to know about: floating widget, music/radio
 * background, relaxing effects, double-tap-to-lock, plus tips.
 */
export const OnboardingModal: React.FC = () => {
  const { t } = useTranslation();
  const app = useApp();
  const visible = !app.onboardingDone;
  const [page, setPage] = useState(0);

  if (!visible) return null;

  const sections = [
    {
      icon: "apps-outline" as const,
      title: t("onboarding.widgetTitle"),
      body: t("onboarding.widgetBody"),
      action: { label: t("onboarding.openSettings"), onPress: () => Linking.openSettings() }
    },
    {
      icon: "musical-notes-outline" as const,
      title: t("onboarding.musicTitle"),
      body: t("onboarding.musicBody")
    },
    {
      icon: "sparkles-outline" as const,
      title: t("onboarding.effectsTitle"),
      body: t("onboarding.effectsBody")
    },
    {
      icon: "lock-closed-outline" as const,
      title: t("onboarding.doubleTapTitle"),
      body: t("onboarding.doubleTapBody"),
      action: { label: t("settings.openA11y"), onPress: () => Accessibility.openAccessibilitySettings().catch(() => {}) }
    },
    {
      icon: "battery-charging-outline" as const,
      title: t("onboarding.batteryTitle"),
      body: t("onboarding.batteryBody")
    },
    {
      icon: "wifi-outline" as const,
      title: t("onboarding.networkTitle"),
      body: t("onboarding.networkBody")
    }
  ];

  const last = page >= sections.length - 1;
  const cur = sections[page];

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => app.setOnboardingDone(true)}>
      <BackgroundGradient>
        <View style={styles.wrap}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
            <Text style={styles.title}>{t("onboarding.welcome")}</Text>
            <Text style={styles.sub}>{t("onboarding.intro")}</Text>
            <GlassCard>
              <View style={styles.head}>
                <Ionicons name={cur.icon} size={28} color={theme.colors.accentGlow} />
                <Text style={styles.h2}>{cur.title}</Text>
              </View>
              <Text style={styles.body}>{cur.body}</Text>
              {cur.action && (
                <Pressable style={styles.actionBtn} onPress={cur.action.onPress}>
                  <Text style={styles.actionText}>{cur.action.label}</Text>
                </Pressable>
              )}
            </GlassCard>
            <View style={styles.dots}>
              {sections.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
              ))}
            </View>
          </ScrollView>
          <View style={styles.foot}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => app.setOnboardingDone(true)}
            >
              <Text style={styles.btnGhostText}>{t("onboarding.skip")}</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => last ? app.setOnboardingDone(true) : setPage((p) => p + 1)}
            >
              <Text style={styles.btnText}>{last ? t("onboarding.gotIt") : t("onboarding.next")}</Text>
            </Pressable>
          </View>
        </View>
      </BackgroundGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "800", marginBottom: 4 },
  sub: { color: theme.colors.textSecondary, fontSize: 14, marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  h2: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", flex: 1 },
  body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  actionBtn: {
    marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderWidth: 1, borderColor: theme.colors.border
  },
  actionText: { color: theme.colors.accentGlow, fontSize: 13, fontWeight: "700" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  dotActive: { backgroundColor: theme.colors.accentGlow, width: 22 },
  foot: { flexDirection: "row", padding: 16, gap: 12, paddingBottom: 28 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.accent, alignItems: "center" },
  btnText: { color: "#0b1f14", fontWeight: "800" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textSecondary, fontWeight: "600" }
});
