import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, StyleSheet, View, Pressable, Image, Alert, Modal, FlatList, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { VideoThumb } from "@/components/VideoThumb";
import { theme } from "@/theme/theme";
import { useApp, MediaItem } from "@/contexts/AppContext";
import { fetchGooglePhotosAlbum, GPhoto } from "@/services/googlePhotos";

export default function HomeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [gpPhotos, setGpPhotos] = useState<GPhoto[]>([]);
  const [gpLoading, setGpLoading] = useState(false);
  const [gpSelected, setGpSelected] = useState<Set<string>>(new Set()); // holds FULL URLs
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
      Alert.alert(t("common.needAccess"), t("common.needAccessGallery"));
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
          Alert.alert(t("common.added"), t("home.addedFiles", { count: items.length }));
          return;
        }
      }
    } catch {}

    // Fallback: MediaLibrary albums (no SAF, or user cancelled)
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.needAccess"), t("common.needAccessGallery"));
      return;
    }
    setAlbumLoading(true);
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      if (!albums.length) {
        Alert.alert(t("home.noFolders"), t("home.noFoldersBody"));
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
    Alert.alert(t("common.added"), t("home.addedFilesAlbum", { count: items.length, title: album.title }));
  }, [app]);

  /**
   * Import only the Google Photos tiles the user explicitly checked. We
   * download each image into the app cache so the wallpaper engine can open
   * them as local file URIs (remote URIs would require network access every
   * time the wallpaper redraws, which breaks lock-screen use).
   */
  const importSelectedGP = useCallback(async () => {
    if (!gpSelected.size) return Alert.alert("Google Photos", t("home.gpEmptySelection"));
    const dir = FileSystem.cacheDirectory + "gp/";
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {}
    const downloaded: MediaItem[] = [];
    // Parallelise downloads — previously this ran sequentially which made
    // importing 30+ items take minutes. 6 concurrent requests stays well
    // under Google's per-client rate limits.
    const selected = Array.from(gpSelected);
    const CONCURRENCY = 6;
    let cursor = 0;
    const workers = new Array(CONCURRENCY).fill(0).map(async () => {
      while (cursor < selected.length) {
        const idx = cursor++;
        const url = selected[idx];
        const filename = (url.split("/").pop()?.split("=")[0] ?? `${Date.now()}_${idx}.jpg`) + ".jpg";
        const dest = dir + filename;
        try {
          const r = await FileSystem.downloadAsync(url, dest);
          downloaded.push({ uri: r.uri, type: "image" });
        } catch {}
      }
    });
    await Promise.all(workers);
    if (downloaded.length) {
      app.addMedia(downloaded);
      setGpSelected(new Set());
      Alert.alert("Google Photos", t("home.gpImported", { count: downloaded.length }));
    } else {
      Alert.alert("Google Photos", t("home.gpDownloadFailed"));
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
    Alert.alert(t("home.deleteFromLibTitle"), t("home.deleteFromLibMany", { count: libSelected.size }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
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
          <Text style={styles.brandH1}>{t("app.name")}</Text>
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

          {/* Compact wallpaper set + target picker + auto-change.
              All controls embedded so the home screen fits without
              scroll (req #10/#11/#12). */}
          {app.mediaLibrary.length > 0 && (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={styles.subHeader}>{t("home.setWallpaper")}</Text>
              <View style={[styles.row, { flexWrap: "wrap", gap: 6, marginTop: 4 }]}>
                {(["home", "lock", "both"] as const).map((t2) => (
                  <Pressable key={t2} onPress={() => app.setWallpaperTarget(t2)} style={[styles.chip, app.wallpaperTarget === t2 && styles.chipActive]}>
                    <Ionicons
                      name={t2 === "home" ? "home-outline" : t2 === "lock" ? "lock-closed-outline" : "phone-portrait-outline"}
                      size={13}
                      color={app.wallpaperTarget === t2 ? "#0b1f14" : theme.colors.accent}
                    />
                    <Text style={[styles.chipText, app.wallpaperTarget === t2 && styles.chipTextActive]}>
                      {t2 === "home" ? t("home.targetHome") : t2 === "lock" ? t("home.targetLock") : t("home.targetBoth")}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {/* Lock-screen limitation note (req #10): Android wallpapers
                  on lock screen are static images only — videos and the
                  auto-swap timer aren't supported by the OS. */}
              {(app.wallpaperTarget === "lock" || app.wallpaperTarget === "both") && (
                <Text style={[styles.body, { marginTop: 4, fontSize: 11, opacity: 0.85 }]}>
                  {t("home.lockNote")}
                </Text>
              )}
              <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
                <PrimaryButton
                  label={t("home.applyWallpaper")}
                  icon="sparkles-outline"
                  onPress={() => app.applyLiveWallpaper(app.wallpaperTarget)}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label={app.videoAudio ? t("home.videoSoundOnShort") : t("home.videoSoundOffShort")}
                  icon={app.videoAudio ? "volume-high-outline" : "volume-mute-outline"}
                  variant={app.videoAudio ? "primary" : "secondary"}
                  onPress={() => app.setVideoAudio(!app.videoAudio)}
                  style={{ flex: 1 }}
                />
              </View>
              {/* Compact auto-change: toggle + interval chips inline. */}
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.subHeader}>{t("home.autoChange")}</Text>
                <Pressable
                  onPress={() => app.setAutoChangeEnabled(!app.autoChangeEnabled)}
                  style={[styles.smallToggle, app.autoChangeEnabled && styles.smallToggleOn]}
                >
                  <Ionicons name={app.autoChangeEnabled ? "toggle" : "toggle-outline"} size={14} color={app.autoChangeEnabled ? "#0b1f14" : theme.colors.accent} />
                  <Text style={[styles.smallToggleText, app.autoChangeEnabled && styles.smallToggleTextOn]}>
                    {app.autoChangeEnabled ? t("common.on") : t("common.off")}
                  </Text>
                </Pressable>
              </View>
              {app.autoChangeEnabled && (
                <>
                  <Text style={[styles.label, { marginTop: 2 }]}>
                    {t("home.interval")}: {app.autoChangeSec < 60 ? `${app.autoChangeSec} ${t("common.seconds")}` : `${Math.round(app.autoChangeSec / 60)} ${t("common.minutes")}`}
                  </Text>
                  <View style={[styles.row, { flexWrap: "wrap" }]}>
                    {intervalPreset.map((s) => (
                      <Pressable key={s} onPress={() => app.setAutoChangeSec(s)} style={[styles.chip, app.autoChangeSec === s && styles.chipActive]}>
                        <Text style={[styles.chipText, app.autoChangeSec === s && styles.chipTextActive]}>{s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {app.mediaLibrary.length > 0 && (
            <>
              <View style={[styles.rowBetween, { marginTop: 12 }]}>
                <Text style={styles.subHeader}>{t("home.library")} ({app.mediaLibrary.length})</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {libSelected.size > 0 && (
                    <Pressable onPress={deleteSelectedLib} style={styles.smallDanger}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.smallDangerText}>{t("home.deleteSelected")} ({libSelected.size})</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <View style={[styles.row, { marginTop: 6, gap: 6 }]}>
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() => setLibSelected(new Set(app.mediaLibrary.map((m) => m.uri)))}
                >
                  <Ionicons name="checkmark-done" size={14} color={theme.colors.accentGlow} />
                  <Text style={styles.ghostBtnText}>{t("home.selectAll")}</Text>
                </Pressable>
                {libSelected.size > 0 && (
                  <Pressable style={styles.ghostBtn} onPress={() => setLibSelected(new Set())}>
                    <Ionicons name="close-circle-outline" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.ghostBtnText}>{t("home.deselectAll")}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.ghostBtn, { backgroundColor: "rgba(34, 197, 94, 0.18)" }]}
                  onPress={() => {
                    // "Use all for wallpaper" — enables auto-change over the
                    // entire library and applies the live wallpaper. We do
                    // NOT mutate the library here: the selection is for
                    // deletion only, and silently dropping unselected media
                    // would be data-loss with no undo.
                    app.setAutoChangeEnabled(true);
                    app.applyLiveWallpaper("both");
                    setLibSelected(new Set());
                  }}
                >
                  <Ionicons name="apps-outline" size={14} color={theme.colors.accentGlow} />
                  <Text style={styles.ghostBtnText}>{t("home.openAllForWallpaper")}</Text>
                </Pressable>
              </View>
              <Text style={[styles.body, { marginTop: 4 }]}>{t("home.openAllHint")}</Text>
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
                        <VideoThumb uri={m.uri} style={StyleSheet.absoluteFillObject as any} />
                      )}
                      <View style={[styles.checkDot, sel && styles.checkDotOn]}>
                        {sel && <Ionicons name="checkmark" size={14} color="#0b1f14" />}
                      </View>
                      <Pressable
                        style={styles.xBtn}
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert(t("home.deleteFromLibTitle"), t("home.deleteFromLibOne"), [
                            { text: t("common.cancel"), style: "cancel" },
                            { text: t("common.delete"), style: "destructive", onPress: () => app.removeMedia(m.uri) },
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
              {gpLoading ? "…" : `${gpPhotos.length} ${t("home.photosLabel")}${gpSelected.size ? ` • ${t("home.gpSelectedSuffix")} ${gpSelected.size}` : ""}`}
            </Text>
          </View>
          <Text style={styles.sectionBody}>{t("home.googlePhotosHint")}</Text>
          <View style={[styles.row, { marginTop: 10, gap: 8 }]}>
            <PrimaryButton
              label={gpFullscreen ? t("home.gpHide") : t("home.gpOpen", { count: gpPhotos.length })}
              icon="images-outline"
              variant="secondary"
              onPress={() => setGpFullscreen(true)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={gpSelected.size > 0 ? t("home.gpImportBtnN", { count: gpSelected.size }) : t("home.gpImportBtn")}
              icon="cloud-download-outline"
              variant={gpSelected.size > 0 ? "primary" : "secondary"}
              onPress={importSelectedGP}
              style={{ flex: 1 }}
              disabled={gpSelected.size === 0}
            />
          </View>
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
                  {gpPhotos.length} {t("home.photosLabel")}{gpSelected.size ? ` • ${gpSelected.size} ${t("home.multiselect")}` : ""}
                </Text>
              </View>
              <Pressable onPress={() => setGpFullscreen(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <View style={[styles.row, { marginBottom: 8, gap: 6 }]}>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => setGpSelected(new Set(gpPhotos.map((p) => p.full)))}
              >
                <Ionicons name="checkmark-done" size={14} color={theme.colors.accentGlow} />
                <Text style={styles.ghostBtnText}>{t("home.selectAll")}</Text>
              </Pressable>
              <Pressable
                style={styles.ghostBtn}
                onPress={() => setGpSelected(new Set())}
              >
                <Ionicons name="close-circle-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.ghostBtnText}>{t("home.deselectAll")}</Text>
              </Pressable>
            </View>
            <FlatList
              data={gpPhotos}
              numColumns={3}
              initialNumToRender={12}
              windowSize={5}
              removeClippedSubviews
              columnWrapperStyle={{ gap: 6 }}
              contentContainerStyle={{ gap: 6, paddingBottom: 120 }}
              keyExtractor={(p) => p.full}
              renderItem={({ item }) => {
                const sel = gpSelected.has(item.full);
                const tileW = (Dimensions.get("window").width - 24 - 12) / 3;
                return (
                  <Pressable onPress={() => toggleGpSel(item.full)} style={{ width: tileW, height: tileW, borderRadius: 14, overflow: "hidden", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: sel ? theme.colors.accentGlow : theme.colors.border }}>
                    {/* Show the fast 400×400 thumbnail — NOT the 2048×2048
                        original. Downloading the full image only happens at
                        import time. */}
                    <Image source={{ uri: item.thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    <View style={[styles.checkDot, sel && styles.checkDotOn]}>
                      {sel && <Ionicons name="checkmark" size={14} color="#0b1f14" />}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={() => (
                <Text style={[styles.emptyText, { textAlign: "center", marginTop: 40 }]}>
                  {gpLoading ? t("home.gpLoading") : t("home.gpEmptyAlbum")}
                </Text>
              )}
            />
            <View style={{ position: "absolute", bottom: 24, left: 12, right: 12 }}>
              <PrimaryButton
                label={gpSelected.size > 0 ? t("home.gpImportBtnFull", { count: gpSelected.size }) : t("home.gpPickPhotos")}
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
              <Text style={styles.h2}>{t("home.pickAlbum")}</Text>
              <Pressable onPress={() => setAlbumList(null)} hitSlop={12}>
                <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
              {t("home.pickAlbumHint")}
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
  brand: { alignItems: "center", marginBottom: 10 },
  brandH1: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  smallToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radii.pill,
    borderWidth: 1, borderColor: theme.colors.accent, backgroundColor: "transparent",
  },
  smallToggleOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  smallToggleText: { color: theme.colors.accent, fontSize: theme.font.size.xs, fontWeight: "600" },
  smallToggleTextOn: { color: "#0b1f14", fontWeight: "700" },
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
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1, borderColor: theme.colors.border,
  },
  ghostBtnText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
});
