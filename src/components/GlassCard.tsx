import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { theme } from "@/theme/theme";

export const GlassCard: React.FC<{ children: React.ReactNode; style?: ViewStyle; padding?: number }> = ({
  children, style, padding = 16
}) => (
  <View style={[styles.wrap, style]}>
    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[styles.bg]} />
    <View style={[styles.inner, { padding }]}>{children}</View>
  </View>
);

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
