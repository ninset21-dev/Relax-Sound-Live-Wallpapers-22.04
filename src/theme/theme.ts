export const theme = {
  colors: {
    bg: "#0b1f14",
    bgAlt: "#0f2a1c",
    surface: "rgba(14, 36, 26, 0.55)",
    surfaceStrong: "rgba(10, 28, 20, 0.85)",
    border: "rgba(158, 226, 184, 0.22)",
    accent: "#11E3A1",
    accentDim: "#0b9b70",
    textPrimary: "#E8FFEF",
    textSecondary: "#9EE2B8",
    textMuted: "#6fa98a",
    danger: "#ff6b6b",
    overlay: "rgba(0,0,0,0.35)"
  },
  radii: { xs: 10, sm: 16, md: 22, lg: 28, xl: 36, pill: 999 },
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
