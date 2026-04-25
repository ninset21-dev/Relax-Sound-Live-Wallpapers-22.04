import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import { AppProvider, useApp } from "@/contexts/AppContext";
import "@/i18n";
import { applyLanguage } from "@/i18n";
import { theme } from "@/theme/theme";

const LanguageBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useApp();
  useEffect(() => {
    // Hydrated language → i18next. Covers all 11 supported codes plus the
    // "system" pseudo-code which falls back to the device locale.
    if (app.language) {
      try { applyLanguage(app.language); } catch {}
    }
  }, [app.language]);
  return <>{children}</>;
};

export default function RootLayout() {
  useEffect(() => {
    // Activity is translucent (see plugins/withTransparentActivity.js) — keep
    // the system-UI window background fully transparent so the launcher
    // shines through whenever BackgroundGradient fades to 0 uiOpacity.
    SystemUI.setBackgroundColorAsync("transparent").catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "transparent" }}>
      <SafeAreaProvider>
        <AppProvider>
          <LanguageBridge>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LanguageBridge>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
