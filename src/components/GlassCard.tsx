import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "@/theme/theme";

// Lazy import to avoid circular dependency (AppContext imports everything)
import { useApp } from "@/contexts/AppContext";

export const GlassCard: React.FC<{ children: React.ReactNode; style?: ViewStyle; padding?: number }> = ({
  children, style, padding = 16
}) => {
  // uiOpacity controls the visual transparency of the card as a whole so
  // the slider has an obvious effect. Below 0.05 the card disappears
  // entirely (req #3 — slider must visibly affect the UI from 0 to 100%).
  let cardOpacity = 1;
  try { cardOpacity = useApp().uiOpacity; } catch {}
  return (
    <View style={[styles.wrap, style, { opacity: cardOpacity }]}>
      <BlurView intensity={Math.max(10, 40 * cardOpacity)} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.bg} />
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
