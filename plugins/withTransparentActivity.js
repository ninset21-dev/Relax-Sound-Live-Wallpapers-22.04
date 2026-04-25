const { withAndroidStyles, withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Makes MainActivity translucent so the user's actual home-screen / live
 * wallpaper shows through whenever BackgroundGradient renders at <100%
 * uiOpacity. The Activity itself remains opaque from the system's point of
 * view (so input/focus work normally) — only the windowBackground is set to
 * @android:color/transparent and windowIsTranslucent=true so the
 * compositor doesn't paint a solid color underneath the React root view.
 */
const withTransparentActivity = (config) => {
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;
    styles.resources = styles.resources || {};
    styles.resources.style = styles.resources.style || [];
    // Find AppTheme (created by Expo) and add the translucency items.
    const appTheme = styles.resources.style.find(
      (s) => s.$ && s.$.name === "AppTheme"
    );
    if (appTheme) {
      appTheme.item = appTheme.item || [];
      const ensureItem = (name, value) => {
        const existing = appTheme.item.find((i) => i.$ && i.$.name === name);
        if (existing) existing._ = value;
        else appTheme.item.push({ $: { name }, _: value });
      };
      ensureItem("android:windowBackground", "@android:color/transparent");
      ensureItem("android:windowIsTranslucent", "true");
      ensureItem("android:windowDrawsSystemBarBackgrounds", "true");
      ensureItem("android:statusBarColor", "@android:color/transparent");
      ensureItem("android:navigationBarColor", "@android:color/transparent");
    }
    return cfg;
  });

  // Belt-and-braces: also set hardware acceleration and exclude from recents
  // tweaks aren't needed — the translucency comes from the theme above.
  return config;
};

module.exports = withTransparentActivity;
