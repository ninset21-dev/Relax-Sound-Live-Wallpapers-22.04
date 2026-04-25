export const theme = {
  colors: {
    // Base background (when no wallpaper is set). Dark forest.
    bg: "#0b1a13",
    bgAlt: "#0e2419",
    // Glass card surfaces (semi-transparent over wallpaper/blur).
    surface: "rgba(14, 30, 22, 0.62)",
    surfaceStrong: "rgba(10, 22, 16, 0.85)",
    surfaceLight: "rgba(170, 210, 185, 0.12)",
    border: "rgba(180, 230, 200, 0.14)",
    borderStrong: "rgba(180, 230, 200, 0.28)",
    // Forest green accents matching the design mockups. `accent` is the
    // bright readable green used for buttons / icons / active chips. The
    // darker `accentDark` variants are for backgrounds that still need to
    // feel like the same family.
    accent: "#22c55e",
    accentGlow: "#22c55e",
    accentDim: "#163024",
    accentStrong: "#2b5a40",
    accentDark: "#1e3a2a",
    textPrimary: "#f3f7f5",
    textSecondary: "#c6d4cc",
    textMuted: "#8fa698",
    danger: "#ff6b6b",
    overlay: "rgba(0,0,0,0.45)"
  },
  radii: { xs: 10, sm: 14, md: 20, lg: 26, xl: 34, pill: 999 },
  spacing: (n: number) => n * 4,
  font: {
    size: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28 }
  },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8
    }
  }
};
export type Theme = typeof theme;
