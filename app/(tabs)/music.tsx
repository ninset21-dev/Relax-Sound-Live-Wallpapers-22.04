import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Hint } from "@/components/Hint";
import { theme } from "@/theme/theme";
import { useApp, Track } from "@/contexts/AppContext";
import { GENRES, popularByGenre, probeStations, Station } from "@/services/radio";
import { Audio } from "@/native";

export default function MusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [genre, setGenre] = useState("relax");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [trackSel, setTrackSel] = useState<Set<string>>(new Set());
  const genreRef = useRef(genre);
  useEffect(() => { genreRef.current = genre; }, [genre]);

  const pickTracks = useCallback(async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: false });
    if (!r.canceled) {
      const t: Track[] = r.assets.map((a) => ({ uri: a.uri, title: a.name ?? "Track" }));
      app.setTracks([...app.tracks, ...t]);
    }
  }, [app]);

  const loadGenre = useCallback(async (g: string, q?: typeof app.quality) => {
    setLoading(true); setGenre(g);
    try {
      const fetched = await popularByGenre(g, q ?? app.quality);
      setStations(fetched);
      // Probe reachability using the already-fetched list (no duplicate API
      // call). Keep `loading` true through the probe so users see a spinner
      // instead of stations silently disappearing seconds later.
      try {
        const alive = await probeStations(fetched.slice(0, 30));
        if (genreRef.current !== g) return;
        const aliveUrls = new Set(alive.map((a) => a.url_resolved || a.url));
        setStations((prev) => prev.filter((p) => aliveUrls.has(p.url_resolved || p.url) || prev.indexOf(p) >= 30));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [app.quality]);

  useEffect(() => { loadGenre(genre); }, []);

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
          <View style={[styles.row, { marginTop: 10, gap: 8 }]}>
            <PrimaryButton label={t("music.prev")} icon="play-skip-back" variant="secondary" onPress={() => app.prevTrack()} style={{ flex: 1 }} />
            <PrimaryButton label={app.isPlaying ? t("music.pause") : t("music.play")}
              icon={app.isPlaying ? "pause" : "play"} onPress={() => app.togglePlay()} style={{ flex: 1 }} />
            <PrimaryButton label={t("music.next")} icon="play-skip-forward" variant="secondary" onPress={() => app.nextTrack()} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
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
            />
          </View>
          <Text style={[styles.label, { marginTop: 10 }]}>{t("music.volume")}: {Math.round(app.volume * 100)}%</Text>
          <Slider minimumValue={0} maximumValue={1} value={app.volume} step={0.01}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setVolume(v)}/>
          <Text style={styles.label}>{t("music.fadeIn")}: {Math.round(app.fadeMs / 100) / 10}s</Text>
          <Slider minimumValue={200} maximumValue={10000} value={app.fadeMs} step={100}
            minimumTrackTintColor={theme.colors.accent} maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.accent}
            onValueChange={(v) => app.setFadeMs(Math.round(v))}/>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("music.startupSource")}</Text>
          <View style={[styles.row, { marginTop: 6, gap: 8 }]}>
            <PrimaryButton label={t("music.startupRadio")}
              variant={app.startup === "radio" ? "primary" : "secondary"}
              onPress={() => app.setStartup("radio")} style={{ flex: 1 }} />
            <PrimaryButton label={t("music.startupLocal")}
              variant={app.startup === "local" ? "primary" : "secondary"}
              onPress={() => app.setStartup("local")} style={{ flex: 1 }} />
          </View>
          <Text style={[styles.label, { marginTop: 12 }]}>{t("music.quality")}</Text>
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            {(["auto", "low", "med", "high"] as const).map((q) => (
              <Pressable key={q} onPress={() => { app.setQuality(q); loadGenre(genre, q); }} style={[styles.chip, app.quality === q && styles.chipActive]}>
                <Text style={[styles.chipText, app.quality === q && styles.chipTextActive]}>
                  {q === "auto" ? t("music.qualityAuto") : q === "low" ? t("music.qualityLow") : q === "med" ? t("music.qualityMed") : t("music.qualityHigh")}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("music.local")}</Text>
          <Text style={styles.body}>{t("music.pickHint")}</Text>
          <PrimaryButton label={t("music.pick")} icon="folder-open-outline" onPress={pickTracks} style={{ marginTop: 8 }} />
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
          <View style={{ marginTop: 8 }}>
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
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>{t("music.radio")}</Text>
          <Text style={styles.body}>{t("music.radioHint")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
            {GENRES.map((g) => (
              <Pressable key={g} onPress={() => loadGenre(g)} style={[styles.chip, genre === g && styles.chipActive, { marginRight: 6 }]}>
                <Text style={[styles.chipText, genre === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {loading && <Text style={styles.body}>…</Text>}
          {!loading && stations.map((s) => (
            <Pressable key={s.stationuuid} style={styles.station} onPress={() => playStation(s)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackName} numberOfLines={1}>{s.name.trim()}</Text>
                <Text style={styles.body} numberOfLines={1}>{s.country} • {s.codec} • {s.bitrate}kbps</Text>
              </View>
              <Ionicons name="play" size={20} color={theme.colors.accent} />
            </Pressable>
          ))}
          {!loading && stations.length === 0 && <Text style={styles.body}>{t("music.noStations", { genre })}</Text>}
          <Hint text={t("music.qualityHint")} />
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
  station: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }
});
