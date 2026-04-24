import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, StyleSheet, View, Pressable, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Hint } from "@/components/Hint";
import { theme } from "@/theme/theme";
import { useApp, MediaItem } from "@/contexts/AppContext";
import { fetchGooglePhotosAlbum } from "@/services/googlePhotos";

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [gpCollapsed, setGpCollapsed] = useState(false);
  const [gpPhotos, setGpPhotos] = useState<string[]>([]);
  const [gpLoading, setGpLoading] = useState(false);

  const loadGP = useCallback(async () => {
    setGpLoading(true);
    try {
      const urls = await fetchGooglePhotosAlbum();
      setGpPhotos(urls);
    } finally { setGpLoading(false); }
  }, []);

  useEffect(() => { loadGP(); }, [loadGP]);

  const pickMedia = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 40
    });
    if (!res.canceled) {
      const items: MediaItem[] = res.assets.map((a) => ({
        uri: a.uri,
        type: (a.type === "video" ? "video" : "image") as "image" | "video",
        name: a.fileName ?? undefined
      }));
      app.addMedia(items);
    }
  }, [app]);

  const pickFolder = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "video/*"],
      multiple: true,
      copyToCacheDirectory: false
    });
    if (!res.canceled) {
      const items: MediaItem[] = res.assets.map((a) => ({
        uri: a.uri,
        type: (a.mimeType ?? "").startsWith("video") ? "video" : "image",
        name: a.name
      }));
      app.addMedia(items);
    }
  }, [app]);

  const importGP = useCallback(() => {
    if (!gpPhotos.length) return Alert.alert("Google Photos", "Список пуст или недоступен.");
    const items: MediaItem[] = gpPhotos.map((u) => ({ uri: u, type: "image" }));
    app.addMedia(items);
    Alert.alert("Google Photos", `Добавлено ${items.length}.`);
  }, [gpPhotos, app]);

  const intervalPreset = [10, 30, 60, 300, 900, 3600];

  return (
    <BackgroundGradient>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t("home.title")}</Text>
        <Text style={styles.sub}>{t("home.intro")}</Text>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("home.addPhotos")}</Text>
          <Text style={styles.sectionBody}>{t("home.addPhotosHint")}</Text>
          <View style={styles.row}>
            <PrimaryButton label={t("common.chooseAll")} icon="images-outline" onPress={pickMedia} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton label={t("home.pickFolder")} icon="folder-outline" variant="secondary" onPress={pickFolder} style={{ flex: 1 }} />
          </View>
          <Hint text={t("home.addPhotosHint")} />
          <View style={[styles.row, { marginTop: 10, flexWrap: "wrap" }]}>
            {app.mediaLibrary.slice(0, 12).map((m, i) => (
              <View key={i} style={styles.thumb}>
                {m.type === "image"
                  ? <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFillObject} />
                  : <View style={[StyleSheet.absoluteFillObject, styles.videoBadge]}>
                      <Ionicons name="videocam" size={22} color={theme.colors.accent} />
                    </View>}
              </View>
            ))}
            {app.mediaLibrary.length === 0 && <Text style={styles.emptyText}>{t("home.empty")}</Text>}
          </View>
        </GlassCard>

        <GlassCard>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{t("home.googlePhotos")}</Text>
            <Pressable onPress={() => setGpCollapsed((v) => !v)} hitSlop={10}>
              <Ionicons name={gpCollapsed ? "chevron-down" : "chevron-up"} size={22} color={theme.colors.accent} />
            </Pressable>
          </View>
          <Text style={styles.sectionBody}>{t("home.googlePhotosHint")}</Text>
          {!gpCollapsed && (
            <>
              <View style={[styles.row, { marginTop: 8, flexWrap: "wrap" }]}>
                {gpLoading && <Text style={styles.emptyText}>…</Text>}
                {!gpLoading && gpPhotos.slice(0, 12).map((u, i) => (
                  <View key={i} style={styles.thumb}><Image source={{ uri: u }} style={StyleSheet.absoluteFillObject} /></View>
                ))}
                {!gpLoading && gpPhotos.length === 0 && <Text style={styles.emptyText}>Пусто / недоступно.</Text>}
              </View>
              <View style={[styles.row, { marginTop: 10 }]}>
                <PrimaryButton label="Импортировать в библиотеку" icon="cloud-download-outline" variant="secondary" onPress={importGP} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("home.autoChange")}</Text>
          <Text style={styles.sectionBody}>{t("home.autoChangeHint")}</Text>
          <View style={[styles.row, { marginTop: 6 }]}>
            <PrimaryButton
              label={app.autoChangeEnabled ? t("common.on") : t("common.off")}
              icon={app.autoChangeEnabled ? "toggle" : "toggle-outline"}
              variant={app.autoChangeEnabled ? "primary" : "secondary"}
              onPress={() => app.setAutoChangeEnabled(!app.autoChangeEnabled)}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>{t("home.interval")}: {app.autoChangeSec} {t("common.seconds")}</Text>
            <Slider
              value={app.autoChangeSec}
              minimumValue={10}
              maximumValue={3600}
              step={10}
              minimumTrackTintColor={theme.colors.accent}
              maximumTrackTintColor={theme.colors.border}
              thumbTintColor={theme.colors.accent}
              onValueChange={(v) => app.setAutoChangeSec(Math.round(v))}
            />
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              {intervalPreset.map((s) => (
                <Pressable key={s} onPress={() => app.setAutoChangeSec(s)} style={styles.chip}>
                  <Text style={styles.chipText}>{s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s/60)}m` : `${Math.round(s/3600)}h`}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("home.setWallpaper")}</Text>
          <View style={[styles.row, { marginTop: 6, gap: 8 }]}>
            <PrimaryButton label={t("home.setHome")} icon="home-outline" onPress={() => app.applyLiveWallpaper("home")} style={{ flex: 1 }} />
            <PrimaryButton label={t("home.setLock")} icon="lock-closed-outline" variant="secondary" onPress={() => app.applyLiveWallpaper("lock")} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton label={t("home.setBoth")} icon="phone-portrait-outline" variant="secondary" onPress={() => app.applyLiveWallpaper("both")} style={{ flex: 1 }} />
          </View>
          <Hint text="Android позволяет одновременно иметь живые обои только на одном слое. Выбор HOME оставляет экран блокировки отдельным и наоборот." />
        </GlassCard>

        <Text style={styles.hintDisabled}>{t("home.previewDisabled")}</Text>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  h1: { color: theme.colors.textPrimary, fontSize: theme.font.size.xxl, fontWeight: "700" },
  sub: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm, marginTop: 4, marginBottom: 10 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.lg, fontWeight: "600" },
  sectionBody: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  thumb: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: theme.colors.surface,
    marginRight: 8, marginTop: 8, overflow: "hidden"
  },
  videoBadge: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,227,161,0.1)" },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 8 },
  label: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(17,227,161,0.12)", borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 6, marginTop: 6
  },
  chipText: { color: theme.colors.accent, fontSize: theme.font.size.xs },
  hintDisabled: { color: theme.colors.textMuted, fontSize: theme.font.size.xs, textAlign: "center", marginTop: 14 }
});
