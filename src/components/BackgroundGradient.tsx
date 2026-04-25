import React, { useContext } from "react";
import { StyleSheet, View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { theme } from "@/theme/theme";
import { useApp } from "@/contexts/AppContext";
import { GlobalEffectLayer } from "@/components/GlobalEffectLayer";

// Tracks whether we're already inside a BackgroundGradient — when true, the
// nested instance suppresses its own GlobalEffectLayer so we don't run the
// particle simulation twice when a Modal renders its own BackgroundGradient
// over the parent screen.
const BackgroundNestedCtx = React.createContext<boolean>(false);

/**
 * App-wide wallpaper background. Renders the user's currently selected
 * wallpaper (if any) as a blurred, dimmed full-screen layer behind every
 * screen so the app blends into the user's chosen aesthetic — matching
 * the design mockups where frosted content cards sit over a forest photo.
 *
 * Falls back to a dark forest gradient when no wallpaper is set.
 */
export const BackgroundGradient: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isNested = useContext(BackgroundNestedCtx);
  const app = useApp();
  // Prefer an explicit "applied" wallpaper. If missing, fall back to the
  // first image in the media library so users see their picked art
  // immediately even before they hit Apply.
  const bgUri = app.currentWallpaperUri ?? app.mediaLibrary.find((m) => m.type === "image")?.uri;
  const showEffect = app.effect !== "none" && !isNested;
  return (
    <BackgroundNestedCtx.Provider value={true}>
    <View style={styles.wrap}>
      {/* Base solid colour so transparent cards still have something behind. */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.bg }]} />

      {/* Blurred photo layer — the user's actual wallpaper behind everything. */}
      {bgUri ? (
        <>
          <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFillObject} blurRadius={25} resizeMode="cover" />
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          {/* Subtle forest tint on top of the photo so greens stay consistent. */}
          <LinearGradient
            colors={["rgba(7,18,13,0.55)", "rgba(12,28,20,0.35)", "rgba(7,18,13,0.75)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      ) : (
        <LinearGradient
          colors={[theme.colors.bg, "#081711", "#0d2a1d", theme.colors.bg]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Global fullscreen effect layer — renders the selected wallpaper
          effect (rain/snow/fireflies/etc.) across every screen so the app
          mirrors what the live wallpaper shows on the home screen. */}
      {showEffect ? <GlobalEffectLayer /> : null}

      {children}
    </View>
    </BackgroundNestedCtx.Provider>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 }
});
