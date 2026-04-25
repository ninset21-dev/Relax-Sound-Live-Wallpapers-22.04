const { withAndroidStyles, withAndroidManifest, withMainActivity, AndroidConfig } = require("@expo/config-plugins");

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

  // Set the React root view + decor view backgrounds to transparent in
  // MainActivity.kt so the user's launcher actually shows through when
  // BackgroundGradient is at uiOpacity=0. Without this, RN paints its
  // root container with the activity's default white/black before
  // BackgroundGradient renders and the translucent theme has nothing to
  // reveal.
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    const isKotlin = cfg.modResults.language === "kt";
    const importLine = isKotlin
      ? "import android.graphics.Color"
      : "import android.graphics.Color;";
    if (!src.includes("import android.graphics.Color")) {
      src = src.replace(/(package [^\n]+\n)/, `$1\n${importLine}\n`);
    }
    const marker = "// withTransparentActivity";
    if (!src.includes(marker)) {
      if (isKotlin) {
        src = src.replace(
          /(super\.onCreate\([^)]*\))/,
          `$1
        ${marker}: paint Activity decor + future React root view transparent
        try { window.decorView.setBackgroundColor(Color.TRANSPARENT) } catch (_: Throwable) {}
        try { window.setBackgroundDrawable(null) } catch (_: Throwable) {}`
        );
      } else {
        src = src.replace(
          /(super\.onCreate\([^)]*\);)/,
          `$1
        ${marker} – paint Activity decor + future React root view transparent
        try { getWindow().getDecorView().setBackgroundColor(Color.TRANSPARENT); } catch (Throwable t) {}
        try { getWindow().setBackgroundDrawable(null); } catch (Throwable t) {}`
        );
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};

module.exports = withTransparentActivity;
