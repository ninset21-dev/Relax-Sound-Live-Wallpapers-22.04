import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/theme/theme";

export const BackgroundGradient: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.wrap}>
    <LinearGradient
      colors={[theme.colors.bg, "#081711", "#0d2a1d", theme.colors.bg]}
      locations={[0, 0.35, 0.7, 1]}
      style={StyleSheet.absoluteFillObject}
    />
    {children}
  </View>
);
const styles = StyleSheet.create({ wrap: { flex: 1 } });
