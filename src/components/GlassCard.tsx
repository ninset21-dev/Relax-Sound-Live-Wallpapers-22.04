import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "@/theme/theme";

// Lazy import to avoid circular dependency (AppContext imports everything)
import { useApp } from "@/contexts/AppContext";

export const GlassCard: React.FC<{ children: React.ReactNode; style?: ViewStyle; padding?: number }> = ({
  children, style, padding = 16
}) => {
  // uiOpacity is only applied to the card background — content stays fully
  // legible so the slider acts as a background transparency dial.
  let bgOpacity = 1;
  try { bgOpacity = useApp().uiOpacity; } catch {}
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={40 * bgOpacity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.bg, { opacity: bgOpacity }]} />
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
