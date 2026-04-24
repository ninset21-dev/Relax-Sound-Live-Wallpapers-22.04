import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { StyleSheet, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { theme } from "@/theme/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: bottomPad,
          borderRadius: theme.radii.xl,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: "transparent",
          elevation: 12
        },
        tabBarBackground: () => (
          <View style={styles.tabBg}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surfaceStrong, borderRadius: theme.radii.xl }]} />
          </View>
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          title: t("tabs.music"),
          tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="effects"
        options={{
          title: t("tabs.effects"),
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBg: { ...StyleSheet.absoluteFillObject, borderRadius: theme.radii.xl, overflow: "hidden" }
});
