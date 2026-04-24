import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable, FlatList } from "react-native";
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
import { GENRES, popularByGenre, Station } from "@/services/radio";

export default function MusicScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [genre, setGenre] = useState("relax");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  const pickTracks = useCallback(async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: false });
    if (!r.canceled) {
      const t: Track[] = r.assets.map((a) => ({ uri: a.uri, title: a.name ?? "Track" }));
      app.setTracks([...app.tracks, ...t]);
    }
  }, [app]);

  const loadGenre = useCallback(async (g: string) => {
    setLoading(true); setGenre(g);
    try {
      const s = await popularByGenre(g, app.quality);
      setStations(s);
    } finally { setLoading(false); }
  }, [app.quality]);

  useEffect(() => { loadGenre(genre); }, []);

  const playStation = (s: Station) => {
    app.play({ uri: s.url_resolved || s.url, title: s.name.trim() });
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
            <PrimaryButton label={t("music.prev")} icon="play-skip-back" variant="secondary" onPress={() => {}} style={{ flex: 1 }} />
            <PrimaryButton label={app.isPlaying ? t("music.pause") : t("music.play")}
              icon={app.isPlaying ? "pause" : "play"} onPress={() => app.togglePlay()} style={{ flex: 1 }} />
            <PrimaryButton label={t("music.next")} icon="play-skip-forward" variant="secondary" onPress={() => {}} style={{ flex: 1 }} />
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
              <Pressable key={q} onPress={() => { app.setQuality(q); loadGenre(genre); }} style={[styles.chip, app.quality === q && styles.chipActive]}>
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
          <View style={{ marginTop: 8 }}>
            {app.tracks.slice(0, 12).map((tr, i) => (
              <Pressable key={i} style={styles.trackRow} onPress={() => app.play(tr)}>
                <Ionicons name="musical-note" size={16} color={theme.colors.accent} />
                <Text style={styles.trackName} numberOfLines={1}>{tr.title}</Text>
              </Pressable>
            ))}
            {app.tracks.length === 0 && <Text style={styles.body}>—</Text>}
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
          {!loading && stations.length === 0 && <Text style={styles.body}>Нет станций для «{genre}».</Text>}
          <Hint text="Автокачество выбирает битрейт по скорости сети: WiFi/5G — высокое, 4G — среднее, 3G/2G — низкое." />
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
  trackRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  trackName: { color: theme.colors.textPrimary, fontSize: theme.font.size.sm, flex: 1 },
  station: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }
});
