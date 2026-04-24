import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

interface Props {
  label: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
}
export const PrimaryButton: React.FC<Props> = ({ label, onPress, icon, variant = "primary", style, disabled }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.base,
      variant === "primary" && styles.primary,
      variant === "secondary" && styles.secondary,
      variant === "ghost" && styles.ghost,
      pressed && { opacity: 0.7 },
      disabled && { opacity: 0.4 },
      style
    ]}
  >
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={18} color={variant === "primary" ? "#0b1f14" : theme.colors.accent} />}
      <Text style={[styles.text, variant === "primary" ? styles.textPrimary : styles.textAlt, icon && { marginLeft: 8 }]}>
        {label}
      </Text>
    </View>
  </Pressable>
);
const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  primary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  secondary: { backgroundColor: "rgba(17,227,161,0.12)" },
  ghost: { backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontSize: theme.font.size.md, fontWeight: "600" },
  textPrimary: { color: "#0b1f14" },
  textAlt: { color: theme.colors.accent }
});
