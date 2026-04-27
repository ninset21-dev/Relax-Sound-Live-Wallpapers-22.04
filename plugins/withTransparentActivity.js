const { withAndroidStyles, withMainActivity } = require("@expo/config-plugins");

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
      ensureItem("android:windowNoTitle", "true");
      ensureItem("android:windowDrawsSystemBarBackgrounds", "true");
      ensureItem("android:statusBarColor", "@android:color/transparent");
      ensureItem("android:navigationBarColor", "@android:color/transparent");
      // No system dim behind a translucent activity — without this the
      // launcher beneath us is darkened by ~50% and looks "almost black"
      // even when our windowBackground is transparent.
      ensureItem("android:backgroundDimEnabled", "false");
      ensureItem("android:colorBackgroundCacheHint", "@null");
      // CRITICAL: without windowShowWallpaper=true, a translucent activity
      // shows BLACK behind the app instead of the user's actual home-screen
      // wallpaper / launcher. This single flag is the difference between
      // "see-through to launcher" and "black void". The user reported the
      // app looking pitch-black even though the activity is translucent —
      // this is the fix.
      ensureItem("android:windowShowWallpaper", "true");
    }
    return cfg;
  });

  // NOTE: we deliberately do NOT add android:showWallpaper="true" to the
  // <activity> element — that attribute is private (NOT part of the public
  // Android SDK), so AAPT2 rejects it with "attribute android:showWallpaper
  // is private" and the build fails. The theme item
  // android:windowShowWallpaper=true (above) is the public, supported way
  // to mark the window as wallpaper-backed and works on all API levels.

  // Set the React root view + decor view backgrounds to transparent in
  // MainActivity.kt so the user's launcher actually shows through when
  // BackgroundGradient is at uiOpacity=0. Without this, RN paints its
  // root container with the activity's default white/black before
  // BackgroundGradient renders and the translucent theme has nothing to
  // reveal.
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    const isKotlin = cfg.modResults.language === "kt";
    const importColor = isKotlin
      ? "import android.graphics.Color"
      : "import android.graphics.Color;";
    const importWmlp = isKotlin
      ? "import android.view.WindowManager"
      : "import android.view.WindowManager;";
    if (!src.includes("import android.graphics.Color")) {
      src = src.replace(/(package [^\n]+\n)/, `$1\n${importColor}\n`);
    }
    if (!src.includes("import android.view.WindowManager")) {
      src = src.replace(/(package [^\n]+\n)/, `$1\n${importWmlp}\n`);
    }
    const marker = "// withTransparentActivity";
    if (!src.includes(marker)) {
      if (isKotlin) {
        src = src.replace(
          /(super\.onCreate\([^)]*\))/,
          `$1
        ${marker}: paint Activity decor + future React root view transparent
        try { window.decorView.setBackgroundColor(Color.TRANSPARENT) } catch (_: Throwable) {}
        try { window.setBackgroundDrawable(null) } catch (_: Throwable) {}
        // Public Android API equivalent of theme item windowShowWallpaper=true.
        // We set it on the window flag at runtime so the user's home screen
        // wallpaper is composited behind us regardless of OEM theme stripping.
        try { window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER) } catch (_: Throwable) {}
        // Disable system dim behind the translucent window, otherwise the
        // launcher under us looks ~50% darker than the actual wallpaper.
        try { window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND) } catch (_: Throwable) {}`
        );
      } else {
        src = src.replace(
          /(super\.onCreate\([^)]*\);)/,
          `$1
        ${marker} – paint Activity decor + future React root view transparent
        try { getWindow().getDecorView().setBackgroundColor(Color.TRANSPARENT); } catch (Throwable t) {}
        try { getWindow().setBackgroundDrawable(null); } catch (Throwable t) {}
        try { getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WALLPAPER); } catch (Throwable t) {}
        try { getWindow().clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND); } catch (Throwable t) {}`
        );
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};

module.exports = withTransparentActivity;
