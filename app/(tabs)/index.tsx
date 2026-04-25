import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, StyleSheet, View, Pressable, Image, Alert, Modal, FlatList, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
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
  const [gpPhotos, setGpPhotos] = useState<string[]>([]);
  const [gpLoading, setGpLoading] = useState(false);
  const [gpSelected, setGpSelected] = useState<Set<string>>(new Set());
  const [libSelected, setLibSelected] = useState<Set<string>>(new Set());
  const [gpFullscreen, setGpFullscreen] = useState(false);
  const [albumList, setAlbumList] = useState<MediaLibrary.Album[] | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);

  const loadGP = useCallback(async () => {
    setGpLoading(true);
    try {
      const urls = await fetchGooglePhotosAlbum();
      setGpPhotos(urls);
    } finally {
      setGpLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGP();
  }, [loadGP]);

  const pickMedia = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Нужен доступ", "Разрешите приложению доступ к галерее.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 60,
    });
    if (!res.canceled) {
      const items: MediaItem[] = res.assets.map((a) => ({
        uri: a.uri,
        type: (a.type === "video" ? "video" : "image") as "image" | "video",
        name: a.fileName ?? undefined,
      }));
      app.addMedia(items);
    }
  }, [app]);

  /**
   * Android: first try the real Storage Access Framework picker
   * (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync)
   * which opens the native DocumentsUI — the same UI the user expects from
   * Android's file manager. We then enumerate files inside the chosen tree
   * and import all images/videos.
   *
   * Fallback to expo-media-library albums list (useful on devices where
   * SAF isn't available / permission denied), rendered in a full Modal so
   * there's no 3-button Alert.alert cap.
   */
  const pickFolder = useCallback(async () => {
    try {
      const saf = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (saf.granted) {
        const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(saf.directoryUri);
        const items: MediaItem[] = entries
          .map((uri) => {
            const low = uri.toLowerCase();
            if (low.match(/\.(jpe?g|png|webp|heic|bmp|gif)(\?|$)/)) return { uri, type: "image" as const };
            if (low.match(/\.(mp4|webm|mov|mkv)(\?|$)/)) return { uri, type: "video" as const };
            return null;
          })
          .filter(Boolean) as MediaItem[];
        if (items.length) {
          app.addMedia(items);
          Alert.alert("Добавлено", `${items.length} файлов добавлены в библиотеку.`);
          return;
        }
      }
    } catch {}

    // Fallback: MediaLibrary albums (no SAF, or user cancelled)
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Нужен доступ", "Разрешите приложению доступ к медиа-библиотеке.");
      return;
    }
    setAlbumLoading(true);
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      if (!albums.length) {
        Alert.alert("Папки не найдены", "Нет доступных альбомов в медиа-библиотеке.");
        return;
      }
      setAlbumList(albums);
    } finally {
      setAlbumLoading(false);
    }
  }, [app]);

  const importAlbum = useCallback(async (album: MediaLibrary.Album) => {
    setAlbumList(null);
    const r = await MediaLibrary.getAssetsAsync({
      album: album.id,
      mediaType: ["photo", "video"],
      first: 500,
    });
    const items: MediaItem[] = r.assets.map((x) => ({
      uri: x.uri,
      type: x.mediaType === "video" ? "video" : "image",
      name: x.filename,
    }));
    app.addMedia(items);
    Alert.alert("Добавлено", `${items.length} файлов из «${album.title}» добавлены в библиотеку.`);
  }, [app]);

  /**
   * Import only the Google Photos tiles the user explicitly checked. We
   * download each image into the app cache so the wallpaper engine can open
   * them as local file URIs (remote URIs would require network access every
   * time the wallpaper redraws, which breaks lock-screen use).
   */
  const importSelectedGP = useCallback(async () => {
    if (!gpSelected.size) return Alert.alert("Google Photos", "Ничего не выбрано.");
    const dir = FileSystem.cacheDirectory + "gp/";
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
    const downloaded: MediaItem[] = [];
    for (const url of Array.from(gpSelected)) {
      const filename = url.split("/").pop()?.split("=")[0] ?? `${Date.now()}.jpg`;
      const dest = dir + filename + ".jpg";
      try {
        const r = await FileSystem.downloadAsync(url, dest);
        downloaded.push({ uri: r.uri, type: "image" });
      } catch {}
    }
    if (downloaded.length) {
      app.addMedia(downloaded);
      setGpSelected(new Set());
      Alert.alert("Google Photos", `Импортировано ${downloaded.length}.`);
    } else {
      Alert.alert("Google Photos", "Не удалось скачать.");
    }
  }, [gpSelected, app]);

  const toggleGpSel = (u: string) => {
    setGpSelected((prev) => {
      const next = new Set(prev);
      next.has(u) ? next.delete(u) : next.add(u);
      return next;
    });
  };

  const toggleLibSel = (uri: string) => {
    setLibSelected((prev) => {
      const next = new Set(prev);
      next.has(uri) ? next.delete(uri) : next.add(uri);
      return next;
    });
  };

  const deleteSelectedLib = () => {
    if (!libSelected.size) return;
    Alert.alert("Удалить", `Удалить выбранные файлы (${libSelected.size}) из библиотеки?`, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => {
          app.removeMediaMany(Array.from(libSelected));
          setLibSelected(new Set());
        },
      },
    ]);
  };

  const intervalPreset = [10, 30, 60, 300, 900, 3600];

  return (
    <BackgroundGradient>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 130 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View>
            <Text style={styles.brandH1}>NINSET</Text>
            <Text style={styles.brandSub}>Nature Engine v2.4</Text>
          </View>
          <View style={styles.brandIcon}>
            <Ionicons name="leaf" size={22} color={theme.colors.accent} />
          </View>
        </View>

        <View style={styles.statRow}>
          <GlassCard padding={12} style={{ flex: 1, marginRight: 4 }}>
            <View style={styles.statItem}>
              <Ionicons name="water-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.statLabel}>FLUIDITY</Text>
            </View>
            <Text style={styles.statValue}>{app.fps} FPS</Text>
          </GlassCard>
          <GlassCard padding={12} style={{ flex: 1, marginLeft: 4 }}>
            <View style={styles.statItem}>
              <Ionicons name="flash-outline" size={18} color={theme.colors.accent} />
              <Text style={styles.statLabel}>POWER</Text>
            </View>
            <Text style={styles.statValue}>
              {app.perfMode === "eco" ? "ECO-MODE" : app.perfMode === "high" ? "HIGH" : "BALANCED"}
            </Text>
          </GlassCard>
        </View>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("home.addPhotos")}</Text>
          <Text style={styles.sectionBody}>{t("home.addPhotosHint")}</Text>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton label={t("common.chooseAll")} icon="images-outline" onPress={pickMedia} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton label={t("home.pickFolder")} icon="folder-outline" variant="secondary" onPress={pickFolder} style={{ flex: 1 }} />
          </View>

          {app.mediaLibrary.length > 0 && (
            <>
              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <Text style={styles.subHeader}>Ваши файлы ({app.mediaLibrary.length})</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {libSelected.size > 0 && (
                    <Pressable onPress={deleteSelectedLib} style={styles.smallDanger}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.smallDangerText}>Удалить ({libSelected.size})</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {/* removeClippedSubviews + lazy thumbnails keeps this list
                  smooth even with 100+ entries. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={{ paddingVertical: 8 }}>
                {app.mediaLibrary.slice(0, 60).map((m, i) => {
                  const sel = libSelected.has(m.uri);
                  return (
                    <Pressable key={i} style={styles.thumbLarge} onLongPress={() => toggleLibSel(m.uri)} onPress={() => toggleLibSel(m.uri)}>
                      {m.type === "image" ? (
                        <Image source={{ uri: m.uri }} style={StyleSheet.absoluteFillObject} />
                      ) : (
                        <View style={[StyleSheet.absoluteFillObject, styles.videoBadge]}>
                          <Ionicons name="videocam" size={26} color={theme.colors.accent} />
                        </View>
                      )}
                      <View style={[styles.checkDot, sel && styles.checkDotOn]}>
                        {sel && <Ionicons name="checkmark" size={14} color="#0b1f14" />}
                      </View>
                      <Pressable
                        style={styles.xBtn}
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert("Удалить", "Удалить файл из библиотеки?", [
                            { text: "Отмена", style: "cancel" },
                            { text: "Удалить", style: "destructive", onPress: () => app.removeMedia(m.uri) },
                          ])
                        }
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </GlassCard>

        <GlassCard>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{t("home.googlePhotos")}</Text>
            <Text style={styles.subDim}>
              {gpLoading ? "…" : `${gpPhotos.length} фото${gpSelected.size ? ` • выбрано ${gpSelected.size}` : ""}`}
            </Text>
          </View>
          <Text style={styles.sectionBody}>{t("home.googlePhotosHint")}</Text>
          <View style={[styles.row, { marginTop: 10, gap: 8 }]}>
            <PrimaryButton
              label={gpFullscreen ? "Скрыть" : `Открыть (${gpPhotos.length || "…"})`}
              icon="images-outline"
              variant="secondary"
              onPress={() => setGpFullscreen(true)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={gpSelected.size > 0 ? `Импорт (${gpSelected.size})` : "Импорт"}
              icon="cloud-download-outline"
              variant={gpSelected.size > 0 ? "primary" : "secondary"}
              onPress={importSelectedGP}
              style={{ flex: 1 }}
              disabled={gpSelected.size === 0}
            />
          </View>
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
          <Text style={[styles.label, { marginTop: 10 }]}>
            {t("home.interval")}: {app.autoChangeSec < 60 ? `${app.autoChangeSec} ${t("common.seconds")}` : `${Math.round(app.autoChangeSec / 60)} мин`}
          </Text>
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
                <Text style={styles.chipText}>{s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`}</Text>
              </Pressable>
            ))}
          </View>
          <Hint text="Работает с фото; для видео используйте один ролик в библиотеке." />
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("home.setWallpaper")}</Text>
          <Text style={styles.sectionBody}>
            Видео со звуком: {app.videoAudio ? "вкл" : "выкл"}. Радио приглушится пока видео играет.
          </Text>
          <View style={[styles.row, { marginTop: 8, gap: 8 }]}>
            <PrimaryButton label={t("home.setHome")} icon="home-outline" onPress={() => app.applyLiveWallpaper("home")} style={{ flex: 1 }} />
            <PrimaryButton label={t("home.setLock")} icon="lock-closed-outline" variant="secondary" onPress={() => app.applyLiveWallpaper("lock")} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton label={t("home.setBoth")} icon="phone-portrait-outline" variant="secondary" onPress={() => app.applyLiveWallpaper("both")} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <PrimaryButton
              label={app.videoAudio ? "Звук видео: вкл" : "Звук видео: выкл"}
              icon={app.videoAudio ? "volume-high-outline" : "volume-mute-outline"}
              variant={app.videoAudio ? "primary" : "secondary"}
              onPress={() => app.setVideoAudio(!app.videoAudio)}
              style={{ flex: 1 }}
            />
          </View>
          <Hint text="Обои подгоняются по заполнению экрана (center-crop), а не растягиваются." />
        </GlassCard>
      </ScrollView>

      {/* Fullscreen Google Photos viewer with lazy-loaded grid (FlatList
          virtualization keeps scroll fluid across hundreds of tiles). */}
      <Modal visible={gpFullscreen} animationType="slide" onRequestClose={() => setGpFullscreen(false)} transparent={false}>
        <BackgroundGradient>
          <View style={{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 12 }}>
            <View style={[styles.rowBetween, { marginBottom: 10 }]}>
              <View>
                <Text style={styles.h2}>Google Photos</Text>
                <Text style={styles.subDim}>
                  {gpPhotos.length} фото{gpSelected.size ? ` • выбрано ${gpSelected.size}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => setGpFullscreen(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={gpPhotos}
              keyExtractor={(u) => u}
              numColumns={3}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              columnWrapperStyle={{ gap: 6 }}
              contentContainerStyle={{ gap: 6, paddingBottom: 120 }}
              renderItem={({ item }) => {
                const sel = gpSelected.has(item);
                const tileW = (Dimensions.get("window").width - 24 - 12) / 3;
                return (
                  <Pressable onPress={() => toggleGpSel(item)} style={{ width: tileW, height: tileW, borderRadius: 14, overflow: "hidden", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: sel ? theme.colors.accent : theme.colors.border }}>
                    <Image source={{ uri: item }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    <View style={[styles.checkDot, sel && styles.checkDotOn]}>
                      {sel && <Ionicons name="checkmark" size={14} color="#0b1f14" />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={() => (
                <Text style={[styles.emptyText, { textAlign: "center", marginTop: 40 }]}>
                  {gpLoading ? "Загружается..." : "Альбом пуст или недоступен."}
                </Text>
              )}
            />
            <View style={{ position: "absolute", bottom: 24, left: 12, right: 12 }}>
              <PrimaryButton
                label={gpSelected.size > 0 ? `Импортировать (${gpSelected.size})` : "Выберите фото"}
                icon="cloud-download-outline"
                onPress={async () => { await importSelectedGP(); setGpFullscreen(false); }}
                disabled={gpSelected.size === 0}
              />
            </View>
          </View>
        </BackgroundGradient>
      </Modal>

      {/* Album picker modal — replaces the old Alert.alert with 3-button cap */}
      <Modal
        visible={albumList !== null}
        animationType="slide"
        onRequestClose={() => setAlbumList(null)}
        transparent
      >
        <View style={styles.modalBg}>
          <View style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 20 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>Выберите альбом</Text>
              <Pressable onPress={() => setAlbumList(null)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
              Все фото и видео из выбранного альбома будут добавлены в библиотеку.
            </Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
              {(albumList ?? []).map((a) => (
                <Pressable key={a.id} onPress={() => importAlbum(a)} style={styles.albumRow}>
                  <Ionicons name="folder-outline" size={20} color={theme.colors.accent} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.albumTitle}>{a.title}</Text>
                    <Text style={styles.albumCount}>{a.assetCount} файлов</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  brand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  brandH1: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "800", letterSpacing: 2 },
  brandSub: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  brandIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,227,161,0.1)", borderWidth: 1, borderColor: theme.colors.border },
  statRow: { flexDirection: "row" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statLabel: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  statValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 4 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.lg, fontWeight: "700" },
  sectionBody: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
  subHeader: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  thumb: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: theme.colors.surface,
    marginRight: 8, marginTop: 8, overflow: "hidden",
  },
  thumbLarge: {
    width: 110, height: 130, borderRadius: 16, backgroundColor: theme.colors.surface,
    marginRight: 10, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border,
  },
  gpTile: {
    width: 130, height: 150, borderRadius: 16, overflow: "hidden",
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  checkDot: {
    position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(11,31,20,0.7)", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
  },
  checkDotOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  xBtn: {
    position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)",
  },
  videoBadge: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,227,161,0.1)" },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 8 },
  label: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm, marginTop: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(17,227,161,0.12)", borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 6, marginTop: 6,
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.accent, fontSize: theme.font.size.xs, textTransform: "capitalize" },
  chipTextActive: { color: "#0b1f14", fontWeight: "700" },
  subDim: { color: theme.colors.textMuted, fontSize: theme.font.size.xs },
  linkText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  smallDanger: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.danger,
  },
  smallDangerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)" },
  h2: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700", textTransform: "capitalize" },
  albumRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  albumTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "600" },
  albumCount: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
});
