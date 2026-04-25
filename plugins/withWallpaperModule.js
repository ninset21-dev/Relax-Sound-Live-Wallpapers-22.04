const { withDangerousMod, withAppBuildGradle, withMainApplication } = require("@expo/config-plugins");
const { writeNativeSource, PKG } = require("./utils");

const PACKAGE_KT = `package ${PKG}.native

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import ${PKG}.wallpaper.RelaxWallpaperService

class RelaxWallpaperModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "RelaxWallpaperModule"

    private val prefs = reactContext.getSharedPreferences("relax_wallpaper_prefs", Context.MODE_PRIVATE)

    @ReactMethod
    fun setStaticWallpaper(uri: String, target: String, promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val bmp = ctx.contentResolver.openInputStream(Uri.parse(uri))?.use {
                BitmapFactory.decodeStream(it)
            } ?: return promise.reject("DECODE", "Cannot decode image")
            val wm = WallpaperManager.getInstance(ctx)
            val flag = when (target) {
                "home" -> if (Build.VERSION.SDK_INT >= 24) WallpaperManager.FLAG_SYSTEM else 0
                "lock" -> if (Build.VERSION.SDK_INT >= 24) WallpaperManager.FLAG_LOCK else 0
                else -> if (Build.VERSION.SDK_INT >= 24)
                    WallpaperManager.FLAG_SYSTEM or WallpaperManager.FLAG_LOCK else 0
            }
            if (Build.VERSION.SDK_INT >= 24 && flag != 0) {
                wm.setBitmap(bmp, null, true, flag)
            } else {
                wm.setBitmap(bmp)
            }
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("SET_WALLPAPER_FAILED", t)
        }
    }

    /**
     * For live wallpaper, we store chosen media in prefs then open the system picker for our service.
     * Android enforces one live wallpaper at a time; HOME vs LOCK distinction is honored by the OS —
     * static wallpaper on LOCK + our live on HOME is the recommended split.
     */
    /**
     * Copy a content:// video to the app's private storage so the live
     * wallpaper service — which runs in a separate window-manager context —
     * can always read it. Without this, content URIs from MediaLibrary or
     * DocumentPicker frequently come back as "Permission Denial" inside the
     * wallpaper engine (req #5 -- "video wallpaper not installing"). Returns
     * the absolute file path on success or null to fall back to the
     * original URI.
     */
    private fun materializeVideo(srcUri: String): String? {
        return try {
            val ctx = reactApplicationContext
            if (srcUri.startsWith("file://") || srcUri.startsWith("/")) return srcUri
            // Use a hash-suffixed filename so applying a *different* video
            // produces a different file path — the wallpaper engine caches
            // by URI string, so reusing the same path would let the old
            // clip keep playing (req #11 regression: video wallpaper not
            // updating). Also forces a fresh file even if the previous
            // copy was partial / truncated by a crash.
            val hash = Integer.toHexString(srcUri.hashCode())
            val dest = File(ctx.filesDir, "wallpaper_video_$hash.mp4")
            dest.parentFile?.mkdirs()
            if (!dest.exists() || dest.length() == 0L) {
                val input = ctx.contentResolver.openInputStream(Uri.parse(srcUri)) ?: return null
                input.use { i -> dest.outputStream().use { o -> i.copyTo(o) } }
            }
            if (!dest.exists() || dest.length() == 0L) return null
            "file://" + dest.absolutePath
        } catch (_: Throwable) { null }
    }

    private fun materializeImage(srcUri: String): String? {
        return try {
            val ctx = reactApplicationContext
            if (srcUri.startsWith("file://") || srcUri.startsWith("/")) return srcUri
            val hash = Integer.toHexString(srcUri.hashCode())
            val dest = File(ctx.filesDir, "wallpaper_image_$hash.bin")
            dest.parentFile?.mkdirs()
            if (!dest.exists() || dest.length() == 0L) {
                val input = ctx.contentResolver.openInputStream(Uri.parse(srcUri)) ?: return null
                input.use { i -> dest.outputStream().use { o -> i.copyTo(o) } }
            }
            if (!dest.exists() || dest.length() == 0L) return null
            "file://" + dest.absolutePath
        } catch (_: Throwable) { null }
    }

    @ReactMethod
    fun setLiveWallpaper(params: ReadableMap, promise: Promise) {
        try {
            val rawVideo = if (params.hasKey("videoUri")) params.getString("videoUri") else null
            val rawImage = if (params.hasKey("imageUri")) params.getString("imageUri") else null
            val effect = if (params.hasKey("effect")) params.getString("effect") else "none"
            val intensity = if (params.hasKey("intensity")) params.getDouble("intensity").toFloat() else 0.5f
            val speed = if (params.hasKey("speed")) params.getDouble("speed").toFloat() else 1.0f
            val fps = if (params.hasKey("fps")) params.getInt("fps") else 30
            val videoAudio = if (params.hasKey("videoAudio")) params.getBoolean("videoAudio") else false
            // Materialize content:// URIs to app-private file paths so the
            // wallpaper service can always read them.
            val video = rawVideo?.takeIf { it.isNotBlank() }?.let { materializeVideo(it) ?: it }
            val image = rawImage?.takeIf { it.isNotBlank() }?.let { materializeImage(it) ?: it }
            prefs.edit()
                .putString("wallpaper_video_uri", video)
                .putString("wallpaper_image_uri", image)
                .putString("effect_type", effect)
                .putFloat("effect_intensity", intensity)
                .putFloat("effect_speed", speed)
                .putInt("effect_fps", fps)
                .putBoolean("wallpaper_video_audio", videoAudio)
                .apply()
            val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
                putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    ComponentName(reactApplicationContext, RelaxWallpaperService::class.java)
                )
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val act = currentActivity
            if (act != null) act.startActivityForResult(intent, 9871)
            else reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (t: Throwable) {
            promise.reject("SET_LIVE_WALLPAPER_FAILED", t)
        }
    }

    /** Update wallpaper parameters without re-opening the system picker (when wallpaper already set). */
    @ReactMethod
    fun updateWallpaperParams(params: ReadableMap, promise: Promise) {
        try {
            val e = prefs.edit()
            if (params.hasKey("videoUri")) e.putString("wallpaper_video_uri", params.getString("videoUri"))
            if (params.hasKey("imageUri")) e.putString("wallpaper_image_uri", params.getString("imageUri"))
            if (params.hasKey("effect")) e.putString("effect_type", params.getString("effect"))
            if (params.hasKey("intensity")) e.putFloat("effect_intensity", params.getDouble("intensity").toFloat())
            if (params.hasKey("speed")) e.putFloat("effect_speed", params.getDouble("speed").toFloat())
            if (params.hasKey("fps")) e.putInt("effect_fps", params.getInt("fps"))
            if (params.hasKey("videoAudio")) e.putBoolean("wallpaper_video_audio", params.getBoolean("videoAudio"))
            e.apply()
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("UPDATE_PARAMS_FAILED", t) }
    }

    @ReactMethod
    fun isLiveWallpaperActive(promise: Promise) {
        try {
            val wm = WallpaperManager.getInstance(reactApplicationContext)
            val info = wm.wallpaperInfo
            val active = info != null && info.packageName == reactApplicationContext.packageName
            promise.resolve(active)
        } catch (t: Throwable) { promise.resolve(false) }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
`;

const PACKAGE_REG_KT = `package ${PKG}.native

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RelaxNativePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(
            RelaxWallpaperModule(ctx),
            RelaxAudioModule(ctx),
            RelaxWidgetModule(ctx),
            RelaxFloatingModule(ctx),
            RelaxAccessibilityModule(ctx)
        )
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;

const withWallpaperModule = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "native/RelaxWallpaperModule.kt", PACKAGE_KT);
      writeNativeSource(root, "native/RelaxNativePackage.kt", PACKAGE_REG_KT);
      return config;
    }
  ]);

const withRegisterPackage = (config) =>
  withMainApplication(config, (config) => {
    let src = config.modResults.contents;
    const imp = `import ${PKG}.native.RelaxNativePackage`;
    if (!src.includes(imp)) {
      src = src.replace(
        /package [^\n]+\n/,
        (m) => m + "\n" + imp + "\n"
      );
    }
    // Kotlin MainApplication uses PackageList; add our package into getPackages() override.
    if (!src.includes("RelaxNativePackage()")) {
      if (src.includes("val packages = PackageList(this).packages")) {
        // Insert registration right before the `return packages` line.
        src = src.replace(
          /(\n(\s*)return packages\b)/,
          `\n$2(packages as MutableList<ReactPackage>).add(RelaxNativePackage())$1`
        );
      } else {
        src = src.replace(
          /(return PackageList\(this\)\.packages)\b/,
          `$1.toMutableList().apply { add(RelaxNativePackage()) }`
        );
      }
    }
    config.modResults.contents = src;
    return config;
  });

const withAppBuildGradleTweaks = (config) =>
  withAppBuildGradle(config, (config) => {
    let src = config.modResults.contents;
    if (!src.includes("// RELAX_EXOPLAYER")) {
      src = src.replace(
        /dependencies\s*\{/,
        `dependencies {\n    // RELAX_EXOPLAYER\n    implementation "androidx.media3:media3-exoplayer:1.4.1"\n    implementation "androidx.media3:media3-exoplayer-dash:1.4.1"\n    implementation "androidx.media3:media3-exoplayer-hls:1.4.1"\n    implementation "androidx.media3:media3-ui:1.4.1"\n    implementation "androidx.media3:media3-session:1.4.1"\n    implementation "androidx.work:work-runtime-ktx:2.9.1"`
      );
    }
    config.modResults.contents = src;
    return config;
  });

module.exports = (config) =>
  withAppBuildGradleTweaks(withRegisterPackage(withWallpaperModule(config)));
