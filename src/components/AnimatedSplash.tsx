import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * Beautiful animated splash (req #11). Plays an orchestrated open animation:
 *   1. Soft radial bloom expands from centre.
 *   2. Three concentric pulse rings ripple outward.
 *   3. Title fades + scales in.
 *   4. Whole splash fades out and unmounts so the app shines through.
 *
 * The pulse loop animates indefinitely on a separate driver from the fade-out
 * so unmounting at fade=0 cleanly stops the loop (the previous version held
 * a `parallel(loop, fade)` handle that never resolved if loop never finished
 * — leaving the splash mounted permanently and burning CPU; fixed here).
 */
export const AnimatedSplash: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.85)).current;
  const ring0 = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  const W = Dimensions.get("window").width;
  const H = Dimensions.get("window").height;
  const cx = W / 2;
  const cy = H / 2;

  useEffect(() => {
    // Stage 1: backdrop fade-in.
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();

    // Stage 2: title fade + scale (slight delay).
    Animated.parallel([
      Animated.timing(titleFade, { toValue: 1, duration: 540, delay: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(titleScale, { toValue: 1, duration: 600, delay: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true })
    ]).start();

    // Stage 3: ring pulses (staggered loops).
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
    const r0 = pulse(ring0, 0);
    const r1 = pulse(ring1, 380);
    const r2 = pulse(ring2, 760);
    r0.start(); r1.start(); r2.start();

    // Stage 4: minimum-display timer (1.6s), then fade out.
    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 480,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      }).start(() => {
        // Stop the pulse loops here, AFTER fade-out completes, so they
        // don't continue forever (and pin the JS thread).
        r0.stop(); r1.stop(); r2.stop();
        setDone(true);
        onDone();
      });
    }, 1600);

    return () => {
      clearTimeout(t);
      r0.stop(); r1.stop(); r2.stop();
    };
  }, []);

  if (done) return null;

  const ringStyle = (val: Animated.Value) => ({
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }) }],
    opacity: val.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] })
  });

  return (
    <Animated.View pointerEvents={done ? "none" : "auto"} style={[StyleSheet.absoluteFillObject, { opacity: fade, backgroundColor: "#0b1f14" }]}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
            <Stop offset="55%" stopColor="#0e3320" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#0b1f14" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={Math.max(W, H)} fill="url(#bloom)" />
      </Svg>
      {/* Pulse rings */}
      {[ring0, ring1, ring2].map((r, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ringWrap,
            { left: cx - 90, top: cy - 90 },
            ringStyle(r)
          ]}
        >
          <View style={styles.ring} />
        </Animated.View>
      ))}
      {/* Title */}
      <Animated.View style={[styles.titleWrap, { opacity: titleFade, transform: [{ scale: titleScale }], left: 0, right: 0, top: cy - 60 }]}>
        <Text style={styles.appTitle}>Relax</Text>
        <Text style={styles.appSubtitle}>Sound · Live Wallpapers</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  ringWrap: { position: "absolute", width: 180, height: 180, alignItems: "center", justifyContent: "center" },
  ring: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, borderColor: "rgba(34,197,94,0.55)" },
  titleWrap: { position: "absolute", alignItems: "center" },
  appTitle: { color: "#E8FFEF", fontSize: 44, fontWeight: "800", letterSpacing: 2, textShadowColor: "rgba(34,197,94,0.6)", textShadowRadius: 14 },
  appSubtitle: { color: "#9EE2B8", fontSize: 13, letterSpacing: 4, marginTop: 4, textTransform: "uppercase" }
});
