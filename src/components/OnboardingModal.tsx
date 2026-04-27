import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "@/theme/theme";
import { Floating, Accessibility } from "@/native";

const ONBOARDING_KEY = "relax.onboarding.shown.v2";

type Slide = {
  iconName: any;
  titleKey: string;
  bodyKey: string;
  cta?: { labelKey: string; onPress: () => Promise<unknown> | unknown };
};

/**
 * First-launch help dialog (req #10). Shows 6 slides covering the main app
 * features. Each slide can have an optional "Open Android settings" button so
 * the user can grant the permission referenced in that slide directly without
 * hunting for it. The dialog is shown once — completion is persisted under
 * `relax.onboarding.shown.v2` so subsequent launches skip it.
 */
export const OnboardingModal: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!seen) setVisible(true);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start();
    } else {
      fade.setValue(0);
    }
  }, [visible, fade]);

  const dismiss = async () => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    setVisible(false);
  };

  const slides: Slide[] = [
    {
      iconName: "apps",
      titleKey: "onboarding.widgetsTitle",
      bodyKey: "onboarding.widgetsBody",
      cta: {
        labelKey: "onboarding.openOverlayPerm",
        onPress: () => Floating.requestOverlayPermission().catch(() => {})
      }
    },
    {
      iconName: "musical-notes",
      titleKey: "onboarding.musicTitle",
      bodyKey: "onboarding.musicBody"
    },
    {
      iconName: "sparkles",
      titleKey: "onboarding.effectsTitle",
      bodyKey: "onboarding.effectsBody"
    },
    {
      iconName: "finger-print",
      titleKey: "onboarding.doubleTapTitle",
      bodyKey: "onboarding.doubleTapBody",
      cta: {
        labelKey: "onboarding.openA11yPerm",
        onPress: () => Accessibility.openAccessibilitySettings().catch(() => {})
      }
    },
    {
      iconName: "battery-charging",
      titleKey: "onboarding.batteryTitle",
      bodyKey: "onboarding.batteryBody",
      cta: {
        labelKey: "onboarding.openBatteryPerm",
        onPress: () => Linking.openSettings().catch(() => {})
      }
    },
    {
      iconName: "wifi",
      titleKey: "onboarding.networkTitle",
      bodyKey: "onboarding.networkBody"
    }
  ];

  const slide = slides[idx];
  const isLast = idx === slides.length - 1;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.bg, { opacity: fade }]}>
        <Animated.View style={[styles.box, { transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
          <View style={styles.iconWrap}>
            <Ionicons name={slide.iconName} size={36} color={theme.colors.accentGlow} />
          </View>
          <Text style={styles.title}>{t(slide.titleKey)}</Text>
          <ScrollView style={styles.bodyScroll}>
            <Text style={styles.body}>{t(slide.bodyKey)}</Text>
          </ScrollView>
          {slide.cta && (
            <Pressable style={styles.ctaBtn} onPress={() => slide.cta!.onPress()}>
              <Ionicons name="settings-outline" size={16} color="#0b1f14" />
              <Text style={styles.ctaText}>{t(slide.cta.labelKey)}</Text>
            </Pressable>
          )}
          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.btnRow}>
            <Pressable style={[styles.navBtn, idx === 0 && { opacity: 0.4 }]} onPress={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0}>
              <Ionicons name="chevron-back" size={18} color={theme.colors.accent} />
              <Text style={styles.navText}>{t("common.back")}</Text>
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={dismiss}>
              <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => isLast ? dismiss() : setIdx(idx + 1)}>
              <Text style={styles.primaryText}>{isLast ? t("onboarding.done") : t("common.next")}</Text>
              <Ionicons name="chevron-forward" size={18} color="#0b1f14" />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  box: { width: "100%", maxWidth: 460, backgroundColor: "#0e2418", borderRadius: 22, padding: 22, borderWidth: 1, borderColor: theme.colors.border },
  iconWrap: { alignSelf: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(34,197,94,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  bodyScroll: { maxHeight: 220 },
  body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: theme.colors.accent, borderRadius: 12 },
  ctaText: { color: "#0b1f14", fontWeight: "700", fontSize: 13 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(34,197,94,0.25)" },
  dotActive: { backgroundColor: theme.colors.accentGlow, width: 18 },
  btnRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 10 },
  navText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  skipText: { color: theme.colors.textMuted, fontSize: 12 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: theme.colors.accentGlow, borderRadius: 12 },
  primaryText: { color: "#0b1f14", fontSize: 14, fontWeight: "700" }
});
