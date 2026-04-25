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
}> = ({ effect, intensity, speed, width, height }) => {
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
    const loop = () => {
      if (!mounted) return;
      // Step particles
      const p = particlesRef.current;
      while (p.length < targetCount) p.push(spawn(effect, W, H));
      const step = 0.016 * Math.max(0.2, Math.min(3, speed));
      for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
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
  }, [effect, speed, W, H, targetCount]);

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="40%" r="70%">
            <Stop offset="0%" stopColor="#163b2a" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0b1f14" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#bg)" />
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
    case "fog":
      return common({ x: rnd() * w, y: rnd() * h, vx: (rnd() - 0.4) * 0.7, vy: (rnd() - 0.5) * 0.15, size: 80 + rnd() * 100, life: 14, maxLife: 14 });
    case "frost":
      return common({ x: rnd() * w, y: rnd() * h, size: 8 + rnd() * 14, life: 18, maxLife: 18 });
    case "stars":
      return common({ x: rnd() * w, y: rnd() * h, size: 1.5 + rnd() * 3, life: 20, maxLife: 20 });
    case "aurora":
      return common({ x: rnd() * w, y: rnd() * h * 0.6, vx: (rnd() - 0.5) * 0.4, size: 60 + rnd() * 120, life: 16, maxLife: 16 });
    case "meteor": {
      const fromLeft = rnd() > 0.5;
      return common({
        x: fromLeft ? -10 : w + 10,
        y: rnd() * h * 0.5,
        vx: fromLeft ? 18 + rnd() * 10 : -(18 + rnd() * 10),
        vy: 22 + rnd() * 10,
        size: 2 + rnd() * 2,
        life: 3, maxLife: 3
      });
    }
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
    case "fog":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size} fill={`rgba(200,230,210,${0.12 + Math.sin(p.phase) * 0.05})`} />;
    case "frost":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size} fill="transparent" stroke={`rgba(200,240,255,${a})`} strokeWidth={1.5} />;
    case "stars": {
      const pulse = Math.sin(p.phase * 2) * 0.5 + 0.5;
      return (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={p.size * 3} fill={`rgba(255,220,180,${0.08 + pulse * 0.05})`} />
          <Circle cx={p.x} cy={p.y} r={p.size + pulse * 1.5} fill={`rgba(255,240,200,${a * pulse})`} />
        </G>
      );
    }
    case "aurora":
      return <Circle key={i} cx={p.x} cy={p.y} r={p.size} fill={`rgba(${140 + Math.round(Math.sin(p.phase) * 60)},${200 + Math.round(Math.cos(p.phase) * 40)},${180 + Math.round(Math.sin(p.phase * 1.3) * 60)},0.18)`} />;
    case "meteor":
      return (
        <G key={i}>
          <Line x1={p.x} y1={p.y} x2={p.x - p.vx * 0.5} y2={p.y - p.vy * 0.5} stroke={`rgba(255,200,120,${a})`} strokeWidth={p.size + 1} />
          <Circle cx={p.x} cy={p.y} r={p.size + 1} fill={`rgba(255,255,220,${a})`} />
        </G>
      );
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
