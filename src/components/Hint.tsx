import React, { useState } from "react";
import { Text, Pressable, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

export const Hint: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.row} hitSlop={8}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.accent} />
        <Text style={styles.label}>Пояснение</Text>
      </Pressable>
      {open && <Text style={styles.body}>{text}</Text>}
    </View>
  );
};
const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { color: theme.colors.accent, fontSize: theme.font.size.xs, marginLeft: 6 },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4, lineHeight: 16 }
});
