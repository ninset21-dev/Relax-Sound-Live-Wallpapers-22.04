import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop, G } from "react-native-svg";
import { theme } from "@/theme/theme";

/**
 * Animated splash / loading preview rendered while the app hydrates state
 * from AsyncStorage and registers native modules. Shows a pulsing leaf
 * icon over a soft particle field — matches the relaxing aesthetic. Auto
 * fades out after `durationMs` (default 1.4s).
 *
 * req #13: красивое анимационное превью при загрузке приложения.
 */
export const AnimatedSplash: React.FC<{ onDone: () => void; durationMs?: number }> = ({
  onDone,
  durationMs = 1400,
}) => {
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(durationMs - 320),
        Animated.timing(fade, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        { iterations: -1 }
      ),
    ]).start(() => onDone());
  }, [durationMs, fade, pulse, onDone]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity: fade }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Defs>
            <RadialGradient id="g" cx="50%" cy="50%" r="60%">
              <Stop offset="0%" stopColor={theme.colors.accentGlow} stopOpacity={0.95} />
              <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity={0.05} />
            </RadialGradient>
          </Defs>
          <G>
            <Circle cx={70} cy={70} r={62} fill="url(#g)" />
            <Circle cx={70} cy={70} r={36} fill="none" stroke={theme.colors.accentGlow} strokeOpacity={0.6} strokeWidth={1.5} />
            <Circle cx={70} cy={70} r={20} fill={theme.colors.accent} fillOpacity={0.55} />
          </G>
        </Svg>
      </Animated.View>
      <Text style={styles.title}>Relax Sound</Text>
      <Text style={styles.sub}>Live Wallpapers</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0b1f14",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999
  },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: 1, marginTop: 18 },
  sub: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4, opacity: 0.8 }
});
