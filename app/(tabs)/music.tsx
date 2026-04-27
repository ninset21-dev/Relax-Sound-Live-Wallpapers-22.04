import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScrollView, View, Text, StyleSheet, Pressable, Alert, TextInput } from "react-native";
import { SmoothSlider } from "@/components/SmoothSlider";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/theme/theme";
import { useApp, Track } from "@/contexts/AppContext";
import { GENRES, popularByGenre, probeStations, Station, randomFromAllGenres, searchStations } from "@/services/radio";
import { Audio } from "@/native";

const FAV_STORAGE_KEY = "relax.favorites.v1";

export default function MusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [genre, setGenre] = useState("relax");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trackSel, setTrackSel] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Station[]>([]);
  const [showFavOnly, setShowFavOnly] = useState(false);
  // currentStationUrl reflects the URL we attempted to play last; used for
  // highlighting the active row regardless of how the engine renamed it.
  const currentStationUrl = app.currentTrack?.uri ?? null;
  // Collapsible state for radio/my-music sections (req #2).
  const [radioOpen, setRadioOpen] = useState(true);
  const [musicOpen, setMusicOpen] = useState(true);
  // genreRef + loadIdRef are updated synchronously inside loadGenre so the
  // stale-result guard works even if React hasn't committed the render yet
  // (e.g. user rapidly taps multiple genres).
  const genreRef = useRef(genre);
  const loadIdRef = useRef(0);

  const pickTracks = useCallback(async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: false });
    if (!r.canceled) {
      const t: Track[] = r.assets.map((a) => ({ uri: a.uri, title: a.name ?? "Track" }));
      app.setTracks([...app.tracks, ...t]);
    }
  }, [app]);

  const loadGenre = useCallback(async (g: string, q?: typeof app.quality) => {
    // Update refs SYNCHRONOUSLY (not via useEffect) so stale-result guards
    // work even when the user rapidly taps a different genre before React
    // commits the previous render.
    const myId = ++loadIdRef.current;
    genreRef.current = g;
    setLoading(true); setGenre(g);
    try {
      const fetched = await popularByGenre(g, q ?? app.quality);
      if (loadIdRef.current !== myId) return;
      setStations(fetched);
      // Probe reachability using the already-fetched list (no duplicate API
      // call). Keep `loading` true through the probe so users see a spinner
      // instead of stations silently disappearing seconds later.
      try {
        const alive = await probeStations(fetched.slice(0, 30));
        if (loadIdRef.current !== myId) return;
        const aliveUrls = new Set(alive.map((a) => a.url_resolved || a.url));
        setStations((prev) => prev.filter((p) => aliveUrls.has(p.url_resolved || p.url) || prev.indexOf(p) >= 30));
      } catch {}
    } finally {
      // Only the most recent loadGenre call should clear the spinner — older
      // calls finishing late must not stomp on a fresh in-flight load.
      if (loadIdRef.current === myId) setLoading(false);
    }
  }, [app.quality]);

  useEffect(() => { loadGenre(genre); }, []);

  // Debounced radio name search (req: "Поиск радиостанций"). When the user
  // types a query, we hit the Radio Browser /search endpoint with name= and
  // replace the current list. Empty query restores the genre list.
  const runSearch = useCallback(async (q: string) => {
    const myId = ++loadIdRef.current;
    if (!q.trim()) {
      // Restore current genre's list.
      loadGenre(genreRef.current);
      return;
    }
    setLoading(true);
    try {
      const fetched = await searchStations({ name: q.trim(), limit: 80 });
      if (loadIdRef.current !== myId) return;
      setStations(fetched);
    } catch {
      if (loadIdRef.current !== myId) return;
      setStations([]);
    } finally {
      if (loadIdRef.current === myId) setLoading(false);
    }
  }, [loadGenre]);

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(text), 350);
  };

  // Load favorites from AsyncStorage once on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAV_STORAGE_KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const persistFavorites = useCallback(async (next: Station[]) => {
    setFavorites(next);
    try { await AsyncStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const isFavorite = (s: Station) => favorites.some((f) => f.stationuuid === s.stationuuid);

  const toggleFavorite = useCallback((s: Station) => {
    if (favorites.some((f) => f.stationuuid === s.stationuuid)) {
      persistFavorites(favorites.filter((f) => f.stationuuid !== s.stationuuid));
    } else {
      persistFavorites([s, ...favorites].slice(0, 200));
    }
  }, [favorites, persistFavorites]);

  // Random across all genres — fetches a curated random pool and starts one.
  const playRandomAcrossGenres = useCallback(async () => {
    setLoading(true);
    try {
      const pool = await randomFromAllGenres(40);
      if (pool.length === 0) return Alert.alert(t("music.radio"), t("music.noStations", { genre: "…" }));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setStations(pool);
      setGenre("✨");
      const items = pool.map((st) => ({ uri: st.url_resolved || st.url, title: st.name.trim() }));
      const idx = Math.max(0, items.findIndex((it) => it.uri === (pick.url_resolved || pick.url)));
      Audio.setPlaylist(items, idx).catch(() => {});
      app.play({ uri: pick.url_resolved || pick.url, title: pick.name.trim() });
    } finally { setLoading(false); }
  }, [app, t]);

  const playStation = (s: Station) => {
    // Replace the native "playlist" with the currently visible station list
    // so widget NEXT/PREV step through radio stations instead of local files.
    // Without this, tapping NEXT on a widget while listening to radio would
    // jump into the local-tracks list (or no-op), which was the source of
    // "on widgets radio stations can't be switched" glitches.
    const url = s.url_resolved || s.url;
    const title = s.name.trim();
    const items = stations
      .filter((st) => st.url_resolved || st.url)
      .map((st) => ({ uri: st.url_resolved || st.url, title: st.name.trim() }));
    const idx = Math.max(0, items.findIndex((it) => it.uri === url));
    Audio.setPlaylist(items, idx).catch(() => {});
    app.play({ uri: url, title });
  };

  const current = app.currentTrack;

  return (
    <BackgroundGradient>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 110 }]}>
        <Text style={styles.h1}>{t("music.title")}</Text>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("music.nowPlaying")}</Text>
          <Text style={styles.body}>{current?.title ?? t("music.noTrack")}</Text>
          {/* Compact transport (req #14). */}
          <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
            <PrimaryButton label={t("music.prev")} icon="play-skip-back" variant="secondary" onPress={() => app.prevTrack()} style={{ flex: 1 }} compact />
            <PrimaryButton label={app.isPlaying ? t("music.pause") : t("music.play")}
              icon={app.isPlaying ? "pause" : "play"} onPress={() => app.togglePlay()} style={{ flex: 1 }} compact />
            <PrimaryButton label={t("music.next")} icon="play-skip-forward" variant="secondary" onPress={() => app.nextTrack()} style={{ flex: 1 }} compact />
            <PrimaryButton
              label={
                app.repeatMode === "off" ? t("music.repeatOff")
                : app.repeatMode === "all" ? t("music.repeatAll")
                : t("music.repeatOne")
              }
              icon={app.repeatMode === "one" ? "repeat" : app.repeatMode === "all" ? "repeat-outline" : "refresh-outline"}
              variant={app.repeatMode === "off" ? "secondary" : "primary"}
              onPress={() => app.toggleRepeat()}
              style={{ flex: 1 }}
              compact
            />
          </View>
          <Text style={[styles.label, { marginTop: 10 }]}>{t("music.volume")}: {Math.round(app.volume * 100)}%</Text>
          <SmoothSlider minimumValue={0} maximumValue={1} value={app.volume} step={0.01}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onSlidingComplete={(v) => app.setVolume(v)}/>
          <Text style={styles.label}>{t("music.fadeIn")}: {Math.round(app.fadeMs / 100) / 10}s</Text>
          <SmoothSlider minimumValue={200} maximumValue={10000} value={app.fadeMs} step={100}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onSlidingComplete={(v) => app.setFadeMs(Math.round(v))}/>

          {/* Playback policy (req #2). "Without pause" keeps audio going
              through screen-off / other apps; "With pause" pauses on
              SCREEN_OFF and when another app takes the foreground, then
              auto-resumes on unlock / return to home. */}
          <Text style={[styles.label, { marginTop: 12 }]}>{t("music.playbackMode")}</Text>
          <View style={[styles.row, { gap: 6, marginTop: 6, flexWrap: "wrap" }]}>
            <Pressable
              onPress={() => app.setPlaybackMode("alwaysPlay")}
              style={[styles.modeChip, app.playbackMode === "alwaysPlay" && styles.modeChipActive]}
            >
              <Ionicons name="infinite-outline" size={14} color={app.playbackMode === "alwaysPlay" ? "#0b1f14" : theme.colors.accent} />
              <Text style={[styles.modeChipText, app.playbackMode === "alwaysPlay" && styles.modeChipTextActive]}>
                {t("music.modeAlwaysPlay")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => app.setPlaybackMode("pauseAware")}
              style={[styles.modeChip, app.playbackMode === "pauseAware" && styles.modeChipActive]}
            >
              <Ionicons name="pause-circle-outline" size={14} color={app.playbackMode === "pauseAware" ? "#0b1f14" : theme.colors.accent} />
              <Text style={[styles.modeChipText, app.playbackMode === "pauseAware" && styles.modeChipTextActive]}>
                {t("music.modePauseAware")}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.body, { marginTop: 4, fontSize: 12, opacity: 0.8 }]}>
            {app.playbackMode === "alwaysPlay" ? t("music.modeAlwaysPlayHint") : t("music.modePauseAwareHint")}
          </Text>
        </GlassCard>

        <GlassCard>
          <Pressable onPress={() => setMusicOpen(!musicOpen)} style={styles.collapseHead}>
            <Text style={styles.sectionTitle}>{t("music.local")}</Text>
            <Ionicons name={musicOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.accent} />
          </Pressable>
          {musicOpen && <>
          <Text style={styles.body}>{t("music.pickHint")}</Text>
          <PrimaryButton label={t("music.pick")} icon="folder-open-outline" onPress={pickTracks} style={{ marginTop: 6 }} compact />
          {app.tracks.length > 0 && (
            <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
              <Pressable
                style={styles.ghostBtn}
                onPress={() =>
                  setTrackSel(
                    trackSel.size === app.tracks.length
                      ? new Set()
                      : new Set(app.tracks.map((tr) => tr.uri))
                  )
                }
              >
                <Ionicons name="checkmark-done" size={14} color={theme.colors.accentGlow} />
                <Text style={styles.ghostBtnText}>
                  {trackSel.size === app.tracks.length && app.tracks.length > 0
                    ? t("home.deselectAll")
                    : t("music.selectAll")}
                </Text>
              </Pressable>
              {trackSel.size > 0 && (
                <Pressable
                  style={[styles.ghostBtn, { backgroundColor: "rgba(255, 107, 107, 0.18)" }]}
                  onPress={() => {
                    Alert.alert(
                      t("common.confirm"),
                      `${t("music.deleteSelected")} (${trackSel.size})?`,
                      [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: t("common.delete"),
                          style: "destructive",
                          onPress: () => {
                            const keep = app.tracks.filter((tr) => !trackSel.has(tr.uri));
                            app.setTracks(keep);
                            setTrackSel(new Set());
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={14} color={theme.colors.danger} />
                  <Text style={styles.ghostBtnText}>{t("music.deleteSelected")} ({trackSel.size})</Text>
                </Pressable>
              )}
            </View>
          )}
          <View style={{ marginTop: 6 }}>
            {app.tracks.map((tr, i) => {
              const sel = trackSel.has(tr.uri);
              return (
                <View key={i} style={[styles.trackRow, sel && { borderColor: theme.colors.accentGlow }]}>
                  <Pressable
                    onPress={() =>
                      setTrackSel((prev) => {
                        const next = new Set(prev);
                        next.has(tr.uri) ? next.delete(tr.uri) : next.add(tr.uri);
                        return next;
                      })
                    }
                    hitSlop={8}
                    style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: sel ? theme.colors.accentGlow : theme.colors.border, alignItems: "center", justifyContent: "center", backgroundColor: sel ? theme.colors.accentGlow : "transparent", marginRight: 8 }}
                  >
                    {sel && <Ionicons name="checkmark" size={14} color="#0b1f14" />}
                  </Pressable>
                  <Pressable onPress={() => app.play(tr)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={app.currentTrack?.uri === tr.uri ? "musical-notes" : "musical-note"} size={16} color={theme.colors.accent} />
                    <Text style={styles.trackName} numberOfLines={1}>{tr.title}</Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => app.removeTrack(tr.uri)}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              );
            })}
            {app.tracks.length === 0 && <Text style={styles.body}>{t("music.pickHint")}</Text>}
          </View>
          </>}
        </GlassCard>

        <GlassCard>
          <Pressable onPress={() => setRadioOpen(!radioOpen)} style={styles.collapseHead}>
            <Text style={styles.sectionTitle}>{t("music.radio")}</Text>
            <Ionicons name={radioOpen ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.accent} />
          </Pressable>
          {radioOpen && <>
          <Text style={styles.body}>{t("music.radioHint")}</Text>
          {/* Radio name search (user req): debounced query against the
              Radio Browser /search endpoint. Empty → restore genre list. */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={theme.colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={t("music.searchPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable hitSlop={10} onPress={() => onSearchChange("")}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            )}
          </View>
          {/* Quality chips moved into radio menu (req #15). */}
          <View style={[styles.row, { flexWrap: "wrap", marginTop: 4 }]}>
            {(["auto", "low", "med", "high"] as const).map((q) => (
              <Pressable key={q} onPress={() => { app.setQuality(q); loadGenre(genre, q); }} style={[styles.chip, app.quality === q && styles.chipActive]}>
                <Text style={[styles.chipText, app.quality === q && styles.chipTextActive]}>
                  {q === "auto" ? t("music.qualityAuto") : q === "low" ? t("music.qualityLow") : q === "med" ? t("music.qualityMed") : t("music.qualityHigh")}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
            {GENRES.map((g) => (
              <Pressable key={g} onPress={() => loadGenre(g)} style={[styles.chip, genre === g && styles.chipActive, { marginRight: 6 }]}>
                <Text style={[styles.chipText, genre === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {loading && <Text style={styles.body}>…</Text>}
          {/* Random + favorites toggle row (req #16). */}
          <View style={[styles.row, { gap: 6, marginTop: 6, flexWrap: "wrap" }]}>
            <PrimaryButton
              label={t("music.randomAll")}
              icon="shuffle"
              variant="secondary"
              onPress={playRandomAcrossGenres}
              compact
            />
            <Pressable
              onPress={() => setShowFavOnly((v) => !v)}
              style={[styles.chip, showFavOnly && styles.chipActive]}
            >
              <Ionicons
                name={showFavOnly ? "star" : "star-outline"}
                size={14}
                color={showFavOnly ? "#0b1f14" : theme.colors.accent}
              />
              <Text style={[styles.chipText, showFavOnly && styles.chipTextActive, { marginLeft: 4 }]}>
                {t("music.favorites")} ({favorites.length})
              </Text>
            </Pressable>
          </View>
          {!loading && (showFavOnly ? favorites : stations).map((s) => {
            const url = s.url_resolved || s.url;
            const active = currentStationUrl === url;
            const fav = isFavorite(s);
            // Status indicator (req #4): playing / paused / stalled. Stalled
            // means we asked to play it but isPlaying is false — i.e. the
            // stream stopped delivering audio (network/server issue).
            const status = active
              ? app.isPlaying ? t("music.statusPlaying") : t("music.statusStalled")
              : null;
            return (
              <Pressable
                key={s.stationuuid}
                style={[styles.station, active && styles.stationActive]}
                onPress={() => playStation(s)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trackName, active && { color: theme.colors.accentGlow }]} numberOfLines={1}>
                    {s.name.trim()}
                  </Text>
                  <Text style={styles.body} numberOfLines={1}>
                    {s.country} • {s.codec} • {s.bitrate}kbps
                    {status ? `  •  ${status}` : ""}
                  </Text>
                </View>
                <Pressable hitSlop={10} onPress={() => toggleFavorite(s)} style={{ paddingHorizontal: 6 }}>
                  <Ionicons
                    name={fav ? "star" : "star-outline"}
                    size={20}
                    color={fav ? theme.colors.accentGlow : theme.colors.textSecondary}
                  />
                </Pressable>
                <Ionicons
                  name={active && app.isPlaying ? "radio" : "play"}
                  size={20}
                  color={active ? theme.colors.accentGlow : theme.colors.accent}
                />
              </Pressable>
            );
          })}
          {!loading && !showFavOnly && stations.length === 0 && <Text style={styles.body}>{t("music.noStations", { genre })}</Text>}
          {!loading && showFavOnly && favorites.length === 0 && <Text style={styles.body}>{t("music.noFavorites")}</Text>}
          </>}
        </GlassCard>
      </ScrollView>
    </BackgroundGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  h1: { color: theme.colors.textPrimary, fontSize: theme.font.size.xxl, fontWeight: "700", marginBottom: 8 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: theme.font.size.lg, fontWeight: "600" },
  body: { color: theme.colors.textSecondary, fontSize: theme.font.size.xs, marginTop: 4 },
  row: { flexDirection: "row" },
  label: { color: theme.colors.textSecondary, fontSize: theme.font.size.sm, marginTop: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(17,227,161,0.12)", borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 6, marginTop: 6
  },
  chipActive: { backgroundColor: theme.colors.accent },
  chipText: { color: theme.colors.accent, fontSize: theme.font.size.xs },
  chipTextActive: { color: "#0b1f14", fontWeight: "700" },
  trackRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: "transparent", borderRadius: 10, paddingHorizontal: 6 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderWidth: 1, borderColor: theme.colors.border,
  },
  ghostBtnText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  trackName: { color: theme.colors.textPrimary, fontSize: theme.font.size.sm, flex: 1 },
  station: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  stationActive: { backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 10 },
  collapseHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    marginTop: 8
  },
  searchInput: { flex: 1, color: theme.colors.textPrimary, fontSize: 14, paddingVertical: 0 },
  modeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: "rgba(17,227,161,0.12)", borderWidth: 1, borderColor: theme.colors.border
  },
  modeChipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  modeChipText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  modeChipTextActive: { color: "#0b1f14", fontWeight: "700" }
});
