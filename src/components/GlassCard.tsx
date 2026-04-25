import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "@/theme/theme";

// Lazy import to avoid circular dependency (AppContext imports everything)
import { useApp } from "@/contexts/AppContext";

export const GlassCard: React.FC<{ children: React.ReactNode; style?: ViewStyle; padding?: number }> = ({
  children, style, padding = 16
}) => {
  // Card surface alpha tracks uiOpacity but only between 0.25 and 1 — fully
  // transparent cards would be unusable (text floating on the bare home
  // screen), so we cap the lower bound. The wallpaper-fade behaviour the
  // user asked about lives in BackgroundGradient, not here.
  let alpha = 1;
  try { alpha = useApp().uiOpacity; } catch {}
  const surfaceAlpha = 0.25 + alpha * 0.75;
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={Math.max(10, 40 * surfaceAlpha)} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.bg, { opacity: surfaceAlpha }]} />
      <View style={[styles.inner, { padding }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginVertical: 6,
    ...theme.shadow.soft
  },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.surface },
  inner: { backgroundColor: "transparent" }
});
