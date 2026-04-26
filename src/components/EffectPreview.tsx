import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, Animated, Easing } from "react-native";
import Svg, { Circle, Line, Path, Rect, G, Defs, RadialGradient, Stop } from "react-native-svg";
import { EffectKind } from "@/contexts/AppContext";
import { theme } from "@/theme/theme";

/**
 * In-app preview of the current wallpaper effect. Renders a small particle
 * simulation on the JS thread using SVG and a single rAF loop so the UI and
 * the native wallpaper engine produce visually similar output (the native
 * engine uses the same effect name + intensity + speed knobs).
 *
 * This is intentionally lightweight — ~80 particles max, recomputed on each
 * animation frame. The actual wallpaper renderer runs natively with a
 * Canvas pipeline for much higher quality.
 */
export const EffectPreview: React.FC<{
  effect: EffectKind;
  intensity: number;
  speed: number;
  width?: number;
  height?: number;
  transparent?: boolean;
  fps?: number;
}> = ({ effect, intensity, speed, width, height, transparent, fps }) => {
  const screen = Dimensions.get("window");
  const W = width ?? Math.min(screen.width - 32, 700);
  const H = height ?? 360;
  const [tick, setTick] = useState(0);
  const particlesRef = useRef<Particle[]>([]);

  // When effect is "none", the native wallpaper engine skips overlay draw
  // entirely — mirror that behavior here so preview and real output match.
  const targetCount =
    effect === "none" ? 0 : Math.max(10, Math.min(80, Math.round(intensity * 80)));

  useEffect(() => {
    // Reset particles whenever the effect changes so old particles don't
    // visually "leak" into the new scene.
    particlesRef.current = [];
  }, [effect]);

  useEffect(() => {
    let mounted = true;
    let raf: number;
    let lastTs = 0;
    let worldT = 0;
    // Throttle to the user's chosen FPS (respect slider 10-120). When fps
    // is undefined we fall back to free-running rAF (display refresh).
    const minFrameMs = fps ? Math.max(1000 / 120, 1000 / Math.max(10, Math.min(120, fps))) : 0;
    const gravityFor = (e: EffectKind): number =>
      e === "rain" ? 28
      : e === "snow" ? 4
      : e === "leaves" || e === "flowers" || e === "cherryblossom" ? 3.2
      : e === "bubbles" ? -3.5
      : 0;
    const loop = (ts: number) => {
      if (!mounted) return;
      // Skip frames that arrive faster than the configured FPS budget.
      if (minFrameMs > 0 && lastTs && ts - lastTs < minFrameMs) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const p = particlesRef.current;
      while (p.length < targetCount) p.push(spawn(effect, W, H));
      // Frame-rate independent stepping — actual elapsed delta keeps
      // motion smooth regardless of JS thread jitter (req #5).
      const dt = lastTs ? Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000)) : 0.016;
      lastTs = ts;
      const step = dt * Math.max(0.2, Math.min(3, speed));
      worldT += step;
      // Same physics (gravity + slow wind oscillation) the native
      // EffectRenderer applies (req #4 — in-app effect must mirror the
      // live-wallpaper engine).
      const wind = Math.sin(worldT * 0.4) * 0.5 + Math.cos(worldT * 0.17) * 0.3;
      const gravity = gravityFor(effect);
      for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        q.vx += wind * step * 0.6;
        q.vy += gravity * step;
        q.vx *= 0.995;
        q.vy *= effect === "bubbles" ? 0.997 : 0.999;
        q.x += q.vx * step * 60;
        q.y += q.vy * step * 60;
        q.life -= step;
        q.phase += step * 2;
        if (q.life <= 0 || q.y > H + 40 || q.y < -40 || q.x < -40 || q.x > W + 40) p.splice(i, 1);
      }
      setTick((t) => (t + 1) % 10000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [effect, speed, W, H, targetCount, fps]);

  return (
    <View style={[styles.wrap, { width: W, height: H, backgroundColor: transparent ? "transparent" : "#0b1f14" }]}>
      <Svg width={W} height={H}>
        {!transparent && (
          <>
            <Defs>
              <RadialGradient id="bg" cx="50%" cy="40%" r="70%">
                <Stop offset="0%" stopColor="#163b2a" stopOpacity="1" />
                <Stop offset="100%" stopColor="#0b1f14" stopOpacity="1" />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill="url(#bg)" />
          </>
        )}
        {particlesRef.current.map((p, i) => renderParticle(effect, p, i))}
      </Svg>
    </View>
  );
};

type Particle = {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; maxLife: number; phase: number;
};

function spawn(effect: EffectKind, w: number, h: number): Particle {
  const rnd = Math.random;
  const common = (over: Partial<Particle>) => ({
    x: rnd() * w, y: -10, vx: 0, vy: 0, size: 4, life: 6, maxLife: 6, phase: rnd() * 6, ...over,
  });
  switch (effect) {
    case "rain":
      return common({ vy: 18 + rnd() * 10, size: 2 + rnd() * 2, life: 4, maxLife: 4 });
    case "snow":
      return common({ vx: (rnd() - 0.5) * 1.5, vy: 1.2 + rnd() * 1.8, size: 4 + rnd() * 6, life: 10, maxLife: 10 });
    case "bubbles":
      return common({ y: h + 10, vx: (rnd() - 0.5) * 0.8, vy: -(1.5 + rnd() * 1.8), size: 10 + rnd() * 18, life: 8, maxLife: 8 });
    case "leaves":
      return common({ y: -20, vx: (rnd() - 0.5) * 2.5, vy: 1.5 + rnd() * 1.5, size: 12 + rnd() * 8, life: 12, maxLife: 12 });
    case "flowers":
      return common({ y: -20, vx: (rnd() - 0.5) * 1.8, vy: 1.2 + rnd() * 1.2, size: 14 + rnd() * 10, life: 14, maxLife: 14 });
    case "fireflies":
      return common({ x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.5) * 0.8, vy: (rnd() - 0.5) * 0.8, size: 4 + rnd() * 4, life: 6, maxLife: 6 });
    case "stars":
      return common({ x: rnd() * w, y: rnd() * h, size: 1.5 + rnd() * 3, life: 20, maxLife: 20 });
    case "cherryblossom":
      return common({ y: -20, vx: (rnd() - 0.5) * 2.2, vy: 1.4 + rnd() * 1.3, size: 8 + rnd() * 6, life: 14, maxLife: 14 });
    case "plasma":
      return common({ x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, size: 20 + rnd() * 30, life: 10, maxLife: 10 });
    default:
      return common({ vx: (rnd() - 0.5) * 2, vy: 2 + rnd() * 3, size: 3 + rnd() * 5, life: 6, maxLife: 6 });
  }
}

function renderParticle(effect: EffectKind, p: Particle, i: number) {
  const a = Math.max(0.12, Math.min(1, p.life / p.maxLife));
  switch (effect) {
    case "rain":
      return <Line key={i} x1={p.x} y1={p.y} x2={p.x} y2={p.y + 14} stroke={`rgba(180,220,255,${a})`} strokeWidth={p.size} />;
    case "snow":
      return <Circle key={i} cx={p.x + Math.sin(p.phase) * 2} cy={p.y} r={p.size} fill={`rgba(255,255,255,${a})`} />;
    case "bubbles":
      return <Circle key={i} cx={p.x + Math.sin(p.phase) * 4} cy={p.y} r={p.size} fill="transparent" stroke={`rgba(180,220,255,${a})`} strokeWidth={2} />;
    case "leaves":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size * 0.6} fill={`rgba(${120 + Math.round(Math.sin(p.phase) * 40)},180,80,${a})`} />;
    case "flowers":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size * 0.6} fill={`rgba(240,180,220,${a})`} />;
    case "fireflies": {
      const pulse = Math.sin(p.phase * 3) * 0.5 + 0.5;
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size * (1.2 + pulse * 0.4)} fill={`rgba(255,255,180,${a * pulse})`} />;
    }
    case "stars": {
      const pulse = Math.sin(p.phase * 2) * 0.5 + 0.5;
      return (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={p.size * 3} fill={`rgba(255,220,180,${0.08 + pulse * 0.05})`} />
          <Circle cx={p.x} cy={p.y} r={p.size + pulse * 1.5} fill={`rgba(255,240,200,${a * pulse})`} />
        </G>
      );
    }
    case "cherryblossom":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size * 0.7} fill={`rgba(255,${190 + Math.round(Math.sin(p.phase) * 15)},215,${a})`} />;
    case "plasma": {
      const hue = Math.round(((p.phase * 40) % 360 + 360) % 360);
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size} fill={`hsla(${hue}, 75%, 60%, 0.35)`} />;
    }
    default:
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size} fill={`rgba(160,240,200,${a})`} />;
  }
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    backgroundColor: "#0b1f14",
  },
});
