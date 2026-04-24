import React from "react";
import { ScrollView, View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/theme/theme";
import { useApp } from "@/contexts/AppContext";
import { Accessibility, Floating } from "@/native";

const InstructionBlock: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={{ marginTop: 10 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.accRow}>
        <Ionicons name={open ? "chevron-down" : "chevron-forward"} size={18} color={theme.colors.accent} />
        <Text style={styles.accTitle}>{title}</Text>
      </Pressable>
      {open && <Text style={styles.accBody}>{body}</Text>}
    </View>
  );
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();

  return (
    <BackgroundGradient>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 110 }]}>
        <Text style={styles.h1}>{t("settings.title")}</Text>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.perfMode")}</Text>
          <View style={[styles.row, { marginTop: 6, gap: 8 }]}>
            <PrimaryButton label={t("settings.perfBalanced")} variant={app.perfMode === "balanced" ? "primary" : "secondary"}
              onPress={() => app.setPerfMode("balanced")} style={{ flex: 1 }} />
            <PrimaryButton label={t("settings.perfHigh")} variant={app.perfMode === "high" ? "primary" : "secondary"}
              onPress={() => app.setPerfMode("high")} style={{ flex: 1 }} />
            <PrimaryButton label={t("settings.perfEco")} variant={app.perfMode === "eco" ? "primary" : "secondary"}
              onPress={() => app.setPerfMode("eco")} style={{ flex: 1 }} />
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.doubleTapLock")}</Text>
          <Text style={styles.body}>{t("settings.doubleTapHint")}</Text>
          <View style={[styles.row, { marginTop: 6 }]}>
            <PrimaryButton label={t("settings.openA11y")} icon="finger-print-outline"
              onPress={async () => { await Accessibility.openAccessibilitySettings(); setTimeout(() => app.refreshA11y(), 500); }} />
          </View>
          <Text style={[styles.body, { marginTop: 6 }]}>
            {app.a11yEnabled ? "Статус: разрешено" : "Статус: не разрешено"}
          </Text>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.overlay")}</Text>
          <View style={[styles.row, { marginTop: 6, gap: 8, flexWrap: "wrap" }]}>
            <PrimaryButton label={t("settings.overlayRequest")} icon="phone-portrait-outline" variant="secondary"
              onPress={async () => { await Floating.requestOverlayPermission(); }} />
            <PrimaryButton label={t("settings.overlayShow")} icon="eye-outline"
              onPress={async () => { if (await Floating.hasOverlayPermission()) await Floating.show(); }} />
            <PrimaryButton label={t("settings.overlayHide")} icon="eye-off-outline" variant="ghost"
              onPress={() => Floating.hide()} />
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.instructions")}</Text>
          <InstructionBlock title={t("settings.howWidgets")} body={t("settings.howWidgetsBody")} />
          <InstructionBlock title={t("settings.howMusic")} body={t("settings.howMusicBody")} />
          <InstructionBlock title={t("settings.howAutoChange")} body={t("settings.howAutoChangeBody")} />
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.links")}</Text>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://www.instagram.com/konon_photographer?igsh=MXJwdGduNXV2aGIzcg==")}>
            <Ionicons name="logo-instagram" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.instagram")}</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL("mailto:ninset8@gmail.com")}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.email")}: ninset8@gmail.com</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://NINSET8.wixsite.com/rare")}>
            <Ionicons name="globe-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.website")}</Text>
          </Pressable>
        </GlassCard>

        <Text style={styles.footer}>Relax Sound Live Wallpapers v1.0</Text>
      </ScrollView>
    </BackgroundGradient>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  h1: { color: theme.colors.textPrimary, fontSize: theme.font.size.xxl, fontWeight: "700", marginBottom: 8 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.lg, fontWeight: "600" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
  row: { flexDirection: "row" },
  accRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  accTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.sm, fontWeight: "600" },
  accBody: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4, marginLeft: 26, lineHeight: 17 },
  linkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  link: { color: theme.colors.accent, fontSize: theme.font.size.sm, flex: 1 },
  footer: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, textAlign: "center", marginTop: 16 }
});
