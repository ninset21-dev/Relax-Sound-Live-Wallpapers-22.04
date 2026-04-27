import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import { EffectPreview } from "@/components/EffectPreview";
import { useApp } from "@/contexts/AppContext";

/**
 * Full-screen particle layer that renders the currently selected wallpaper
 * effect across the whole app (not a boxed preview). Uses the existing
 * EffectPreview SVG simulator at device-size and pins it behind all UI
 * so the app mirrors what the user sees on their home screen.
 *
 * Pointer events pass through (`pointerEvents="none"`) so the effect
 * doesn't block taps on buttons/cards above it.
 */
export const GlobalEffectLayer: React.FC = () => {
  const app = useApp();
  const { width, height } = Dimensions.get("window");
  if (app.effect === "none") return null;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <EffectPreview
        effect={app.effect}
        intensity={app.intensity}
        speed={app.speed}
        fps={app.fps}
        width={width}
        height={height}
        transparent
      />
    </View>
  );
};
