import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable, Linking, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { SUPPORTED_LANGUAGES, applyLanguage } from "@/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/theme/theme";
import { useApp } from "@/contexts/AppContext";
import { Accessibility, Floating } from "@/native";
import Constants from "expo-constants";

// Single source of truth: read the version from app.json via expo-constants
// so the displayed version is always in sync with the build.
const APP_VERSION = (Constants.expoConfig?.version as string | undefined) ?? "";

const PRIVACY_URL =
  "https://sites.google.com/view/relax-sound-live-wallpapers/%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F-%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0";

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
  const [a11yRationale, setA11yRationale] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  // req #8: Language menu collapsed by default — expand on tap.
  const [langOpen, setLangOpen] = useState(false);

  const pickLanguage = async (l: string) => {
    // persist choice (system | en | ru | es | pt | de | fr | it | tr | ja | zh | ar)
    app.setLanguage(l as any);
    try { applyLanguage(l); } catch {}
  };

  const openA11yFlow = async () => {
    setA11yRationale(false);
    try {
      await Accessibility.openAccessibilitySettings();
    } catch {}
    setTimeout(() => app.refreshA11y(), 800);
  };

  return (
    <BackgroundGradient>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 130 }]}>
        <Text style={styles.h1}>{t("settings.title")}</Text>

        <GlassCard>
          {/* req #8: collapsible language picker — collapsed by default. */}
          <Pressable onPress={() => setLangOpen((v) => !v)} style={styles.collapseHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t("settings.language")}</Text>
              <Text style={styles.body}>
                {(SUPPORTED_LANGUAGES.find((l) => l.code === app.language)?.label) ?? t("settings.language")}
              </Text>
            </View>
            <Ionicons name={langOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.accent} />
          </Pressable>
          {langOpen && (
            <View style={[styles.row, { marginTop: 8, flexWrap: "wrap", gap: 6 }]}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => pickLanguage(lang.code)}
                  style={[styles.langChip, app.language === lang.code && styles.langChipActive]}
                >
                  <Text style={[styles.langChipText, app.language === lang.code && styles.langChipTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </GlassCard>

        {/* req #9: removed standalone "UI/widget transparency" tile.
            Transparency is still controlled via the Effects screen
            (uiOpacity slider on the live wallpaper card). */}

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("settings.doubleTapLock")}</Text>
          <Text style={styles.body}>{t("settings.doubleTapHint")}</Text>
          <View style={[styles.row, { marginTop: 6 }]}>
            <PrimaryButton label={t("settings.openA11y")} icon="finger-print-outline"
              onPress={() => setA11yRationale(true)} />
          </View>
          <Text style={[styles.body, { marginTop: 6 }]}>
            {app.a11yEnabled ? t("settings.a11yStatusEnabled") : t("settings.a11yStatusDisabled")}
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
          <Text style={styles.sectionTitle}>{t("settings.legal")}</Text>
          <Pressable style={styles.linkRow} onPress={() => setAboutOpen(true)}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.about")}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.privacy")}</Text>
            <Ionicons name="open-outline" size={18} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => setTermsOpen(true)}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.accent} />
            <Text style={styles.link}>{t("settings.terms")}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
          </Pressable>
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

        <Text style={styles.footer}>Relax Sound Live Wallpapers v{APP_VERSION}</Text>
      </ScrollView>

      {/* Accessibility rationale modal — Google Play requires apps to
          explain why ACCESSIBILITY_SERVICE is needed before the user is
          sent into Settings. */}
      <Modal visible={a11yRationale} transparent animationType="fade" onRequestClose={() => setA11yRationale(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalH}>{t("settings.a11yRationaleTitle")}</Text>
            <Text style={styles.modalBody}>{t("settings.a11yRationaleBody")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              <PrimaryButton label={t("common.cancel")} variant="secondary" onPress={() => setA11yRationale(false)} style={{ flex: 1 }} />
              <PrimaryButton label={t("settings.continue")} onPress={openA11yFlow} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Terms of use */}
      <Modal visible={termsOpen} animationType="slide" onRequestClose={() => setTermsOpen(false)}>
        <BackgroundGradient>
          <View style={{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>{t("settings.terms")}</Text>
              <Pressable onPress={() => setTermsOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, marginTop: 14 }}>
              <Text style={styles.modalBody}>{t("settings.termsBody")}</Text>
            </ScrollView>
          </View>
        </BackgroundGradient>
      </Modal>

      {/* About */}
      <Modal visible={aboutOpen} animationType="slide" onRequestClose={() => setAboutOpen(false)}>
        <BackgroundGradient>
          <View style={{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>{t("settings.about")}</Text>
              <Pressable onPress={() => setAboutOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, marginTop: 14 }}>
              <Text style={styles.aboutBig}>Relax Sound Live Wallpapers</Text>
              <Text style={styles.body}>Version {APP_VERSION} • Nature Engine</Text>
              <View style={{ height: 14 }} />
              <Text style={styles.modalBody}>{t("settings.aboutBody")}</Text>
              <View style={{ height: 14 }} />
              <Text style={[styles.modalBody, { fontStyle: "italic", color: theme.colors.accent }]}>
                {t("settings.aboutCopyright")}
              </Text>
              <View style={{ height: 20 }} />
              <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://www.instagram.com/konon_photographer?igsh=MXJwdGduNXV2aGIzcg==")}>
                <Ionicons name="logo-instagram" size={20} color={theme.colors.accent} />
                <Text style={styles.link}>Instagram: konon_photographer</Text>
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => Linking.openURL("https://NINSET8.wixsite.com/rare")}>
                <Ionicons name="globe-outline" size={20} color={theme.colors.accent} />
                <Text style={styles.link}>Portfolio: NINSET8.wixsite.com/rare</Text>
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => Linking.openURL("mailto:ninset8@gmail.com")}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
                <Text style={styles.link}>ninset8@gmail.com</Text>
              </Pressable>
            </ScrollView>
          </View>
        </BackgroundGradient>
      </Modal>
    </BackgroundGradient>
  );
}
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  h1: { color: theme.colors.textPrimary, fontSize: theme.font.size.xxl, fontWeight: "700", marginBottom: 8 },
  h2: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.lg, fontWeight: "600" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  accTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.sm, fontWeight: "600" },
  accBody: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4, marginLeft: 26, lineHeight: 17 },
  linkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  link: { color: theme.colors.accent, fontSize: theme.font.size.sm, flex: 1 },
  footer: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, textAlign: "center", marginTop: 16 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox: { width: "100%", maxWidth: 480, backgroundColor: "#112a1d", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.colors.border },
  modalH: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalBody: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  aboutBig: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 6, marginBottom: 6
  },
  langChipActive: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderColor: theme.colors.accentGlow
  },
  langChipText: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm, fontWeight: "600" },
  langChipTextActive: { color: theme.colors.textPrimary },
  collapseHead: { flexDirection: "row", alignItems: "center", gap: 8 }
});
