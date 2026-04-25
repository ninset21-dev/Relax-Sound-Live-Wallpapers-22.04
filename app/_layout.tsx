import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import i18n from "i18next";
import { AppProvider, useApp } from "@/contexts/AppContext";
import "@/i18n";
import { theme } from "@/theme/theme";

const LanguageBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const app = useApp();
  useEffect(() => {
    if (app.language === "ru" || app.language === "en") {
      i18n.changeLanguage(app.language).catch(() => {});
    }
  }, [app.language]);
  return <>{children}</>;
};

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bg).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <SafeAreaProvider>
        <AppProvider>
          <LanguageBridge>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LanguageBridge>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
