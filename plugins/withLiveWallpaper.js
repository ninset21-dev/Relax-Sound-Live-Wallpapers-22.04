const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, writeResource, PKG } = require("./utils");
const { liveWallpaperServiceKt } = require("./native/LiveWallpaperService.kt.js");
const { effectRendererKt } = require("./native/EffectRenderer.kt.js");
const { wallpaperEngineKt } = require("./native/WallpaperEngine.kt.js");

const withLiveWallpaperManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["service"] = app["service"] || [];
    const already = app["service"].some(
      (s) => s.$["android:name"] === ".wallpaper.RelaxWallpaperService"
    );
    if (!already) {
      app["service"].push({
        $: {
          "android:name": ".wallpaper.RelaxWallpaperService",
          "android:exported": "true",
          "android:label": "Relax Sound Live Wallpapers",
          "android:permission": "android.permission.BIND_WALLPAPER",
          "android:foregroundServiceType": "mediaPlayback"
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.service.wallpaper.WallpaperService" } }]
          }
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.service.wallpaper",
              "android:resource": "@xml/relax_wallpaper"
            }
          }
        ]
      });
    }
    return config;
  });

const withLiveWallpaperFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeResource(root, "xml/relax_wallpaper.xml", RELAX_WALLPAPER_XML);
      writeNativeSource(root, "wallpaper/RelaxWallpaperService.kt", liveWallpaperServiceKt(PKG));
      writeNativeSource(root, "wallpaper/RelaxWallpaperEngine.kt", wallpaperEngineKt(PKG));
      writeNativeSource(root, "wallpaper/EffectRenderer.kt", effectRendererKt(PKG));
      return config;
    }
  ]);

const RELAX_WALLPAPER_XML = `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:thumbnail="@mipmap/ic_launcher" />
`;

module.exports = (config) => withLiveWallpaperFiles(withLiveWallpaperManifest(config));
