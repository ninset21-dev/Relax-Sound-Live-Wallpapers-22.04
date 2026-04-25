import React, { useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp, View, StyleSheet } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

/**
 * Thumbnail for a video file URI (req #11: video wallpapers must show
 * preview). Generates a single JPG frame on first render via
 * expo-video-thumbnails and caches the result in component state.
 *
 * Falls back to a "videocam" icon while loading or on failure so the user
 * always sees a recognisable tile rather than a blank square.
 */
export const VideoThumb: React.FC<{
  uri: string;
  style?: StyleProp<ImageStyle>;
}> = ({ uri, style }) => {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { uri: t } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 1000,
          quality: 0.5
        });
        if (alive) setThumb(t);
      } catch {
        if (alive) setThumb(null);
      }
    })();
    return () => { alive = false; };
  }, [uri]);

  return (
    <View style={[styles.wrap, style as any]}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} />
      ) : null}
      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="play" size={14} color="#0b1f14" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "rgba(11,31,20,0.7)"
  },
  badge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accent
  }
});
