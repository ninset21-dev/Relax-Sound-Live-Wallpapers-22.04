const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, writeResource, PKG } = require("./utils");

const PROVIDER_KT = `package ${PKG}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import ${PKG}.R
import ${PKG}.audio.RelaxAudioService

open class RelaxWidgetBase(private val size: String) : AppWidgetProvider() {

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> updateWidget(ctx, mgr, id, size) }
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        when (intent.action) {
            ACTION_TOGGLE -> startAudio(ctx, RelaxAudioService.ACTION_TOGGLE)
            ACTION_NEXT -> startAudio(ctx, RelaxAudioService.ACTION_NEXT)
            ACTION_PREV -> startAudio(ctx, RelaxAudioService.ACTION_PREV)
            ACTION_CYCLE_MODE -> cycleEffect(ctx)
            ACTION_CHANGE_WALLPAPER -> shuffleWallpaper(ctx)
            ACTION_VOL_UP -> adjustVolume(ctx, +0.08f)
            ACTION_VOL_DOWN -> adjustVolume(ctx, -0.08f)
            RelaxAudioService.ACTION_STATE -> refreshAll(ctx)
        }
    }

    /**
     * Cycle the live wallpaper effect without needing the RN runtime: advance
     * through a fixed set, persist the new value directly to the wallpaper
     * prefs, and notify the engine via a broadcast. The engine re-reads prefs
     * on every frame tick so the change is visible immediately.
     */
    private fun cycleEffect(ctx: Context) {
        val wp = ctx.getSharedPreferences("relax_wallpaper_prefs", Context.MODE_PRIVATE)
        val order = listOf("none", "snow", "rain", "bubbles", "leaves", "flowers", "particles", "fireflies", "stars", "cherryblossom", "plasma")
        val cur = wp.getString("effect_type", "none") ?: "none"
        val next = order[(order.indexOf(cur).coerceAtLeast(0) + 1) % order.size]
        wp.edit().putString("effect_type", next).apply()
        ctx.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
            .edit().putString("mode", next).apply()
        ctx.sendBroadcast(Intent("${PKG}.EFFECT_CHANGED").setPackage(ctx.packageName).putExtra("effect", next))
        refreshAll(ctx)
    }

    /**
     * Pick a random item (image OR video) from the user's saved library
     * (persisted by JS as a JSON array under key "wallpaper_library_json")
     * and install it as the current live-wallpaper backdrop. Keeps working
     * when the RN app is dead. Writes the correct key and clears the opposite
     * one so the wallpaper engine picks the right media source.
     */
    private fun shuffleWallpaper(ctx: Context) {
        val widgetPrefs = ctx.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
        val raw = widgetPrefs.getString("wallpaper_library_json", null) ?: return
        try {
            val arr = org.json.JSONArray(raw)
            if (arr.length() == 0) return
            val idx = (Math.random() * arr.length()).toInt().coerceIn(0, arr.length() - 1)
            val obj = arr.getJSONObject(idx)
            val uri = obj.optString("uri", "")
            val type = obj.optString("type", "image")
            if (uri.isBlank()) return
            val wp = ctx.getSharedPreferences("relax_wallpaper_prefs", Context.MODE_PRIVATE)
            val key = if (type == "video") "wallpaper_video_uri" else "wallpaper_image_uri"
            val clearKey = if (type == "video") "wallpaper_image_uri" else "wallpaper_video_uri"
            wp.edit().putString(key, uri).remove(clearKey).apply()
            ctx.sendBroadcast(Intent("${PKG}.WALLPAPER_CHANGED").setPackage(ctx.packageName).putExtra("uri", uri).putExtra("type", type))
        } catch (_: Throwable) {}
    }

    private fun adjustVolume(ctx: Context, delta: Float) {
        val prefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
        val v = (prefs.getFloat("vol", 0.7f) + delta).coerceIn(0f, 1f)
        prefs.edit().putFloat("vol", v).apply()
        val i = Intent(ctx, RelaxAudioService::class.java).apply {
            action = RelaxAudioService.ACTION_VOLUME
            putExtra(RelaxAudioService.EXTRA_VOLUME, v)
        }
        if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        refreshAll(ctx)
    }

    private fun startAudio(ctx: Context, action: String) {
        val i = Intent(ctx, RelaxAudioService::class.java).apply { this.action = action }
        if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
    }

    private fun refreshAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        // Large widget removed per req #9 — only Small + Medium are available.
        listOf(RelaxWidgetSmall::class.java, RelaxWidgetMedium::class.java)
            .forEach { clz ->
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, clz))
                val sz = when (clz.simpleName) { "RelaxWidgetSmall" -> "small"; else -> "medium" }
                ids.forEach { id -> updateWidget(ctx, mgr, id, sz) }
            }
    }

    companion object {
        const val ACTION_TOGGLE = "${PKG}.widget.TOGGLE"
        const val ACTION_NEXT = "${PKG}.widget.NEXT"
        const val ACTION_PREV = "${PKG}.widget.PREV"
        const val ACTION_CYCLE_MODE = "${PKG}.widget.CYCLE_MODE"
        const val ACTION_CHANGE_WALLPAPER = "${PKG}.widget.CHANGE_WP"
        const val ACTION_VOL_UP = "${PKG}.widget.VOL_UP"
        const val ACTION_VOL_DOWN = "${PKG}.widget.VOL_DOWN"

        fun updateWidget(ctx: Context, mgr: AppWidgetManager, id: Int, size: String) {
            val layout = when (size) {
                "small" -> R.layout::class.java.getField("relax_widget_small").getInt(null)
                else -> R.layout::class.java.getField("relax_widget_medium").getInt(null)
            }
            val views = RemoteViews(ctx.packageName, layout)
            val audioPrefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
            val widgetPrefs = ctx.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
            val title = audioPrefs.getString("title", "Relax Sound") ?: "Relax Sound"
            val mode = widgetPrefs.getString("mode", "video") ?: "video"
            // Reflect the real player state (is_playing, populated by the
            // service's broadcastState/persistPrefs) so the widget icon
            // doesn't flash Pause during a focus loss when was_playing is
            // still true.
            val isPlaying = audioPrefs.getBoolean("is_playing", audioPrefs.getBoolean("was_playing", false))

            try { views.setTextViewText(R.id::class.java.getField("title").getInt(null), title) } catch (_: Throwable) {}
            try { views.setTextViewText(R.id::class.java.getField("mode_label").getInt(null), mode.uppercase()) } catch (_: Throwable) {}
            // Apply user-configured accent + widget opacity (req #9). Default
            // teal #0EA5A4 if the user hasn't picked one yet. Opacity 0..1
            // multiplies the alpha channel of the widget container.
            try {
                val themePrefs = ctx.getSharedPreferences("relax_theme", Context.MODE_PRIVATE)
                val accent = themePrefs.getString("accent_color", "#0EA5A4") ?: "#0EA5A4"
                val opacity = themePrefs.getFloat("widget_opacity", 0.85f).coerceIn(0.2f, 1f)
                val argb = run {
                    val color = android.graphics.Color.parseColor(accent)
                    android.graphics.Color.argb(
                        (opacity * 255f).toInt().coerceIn(0, 255),
                        // Darken the accent so widget text stays legible.
                        (android.graphics.Color.red(color) * 0.35f).toInt().coerceIn(0, 255),
                        (android.graphics.Color.green(color) * 0.35f).toInt().coerceIn(0, 255),
                        (android.graphics.Color.blue(color) * 0.35f).toInt().coerceIn(0, 255)
                    )
                }
                val containerId = R.id::class.java.getField("widget_root").getInt(null)
                views.setInt(containerId, "setBackgroundColor", argb)
            } catch (_: Throwable) {}
            // Toggle the play/pause icon on the widget so it reflects the
            // actual playback state — req #1 / #11.
            try {
                val tid = R.id::class.java.getField("btn_toggle").getInt(null)
                views.setImageViewResource(tid, if (isPlaying)
                    android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play)
            } catch (_: Throwable) {}

            // Always target ONE concrete receiver (Small) so the action is
            // delivered exactly once — otherwise all 3 widget receivers would
            // handle it (volume 3×delta, cycle 3 positions, etc).
            val pi = { action: String ->
                val i = Intent(ctx, RelaxWidgetSmall::class.java).apply { this.action = action }
                PendingIntent.getBroadcast(ctx, action.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            }

            // Volume controls live on the floating widget only — req #8
            // ("remove the volume slider everywhere except the floating
            // widget"). The volume actions remain registered but the
            // home-screen widgets no longer surface them.
            listOf(
                "btn_toggle" to ACTION_TOGGLE,
                "btn_next" to ACTION_NEXT,
                "btn_prev" to ACTION_PREV,
                "btn_mode" to ACTION_CYCLE_MODE,
                "btn_change_wp" to ACTION_CHANGE_WALLPAPER
            ).forEach { (viewName, action) ->
                try {
                    val vid = R.id::class.java.getField(viewName).getInt(null)
                    views.setOnClickPendingIntent(vid, pi(action))
                } catch (_: Throwable) {}
            }

            mgr.updateAppWidget(id, views)
        }
    }
}

class RelaxWidgetSmall : RelaxWidgetBase("small")
class RelaxWidgetMedium : RelaxWidgetBase("medium")
`;

const MODULE_KT = `package ${PKG}.native

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import ${PKG}.widget.*

class RelaxWidgetModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RelaxWidgetModule"

    @ReactMethod
    fun updateWidgetState(title: String, volume: Double, mode: String, promise: Promise) {
        val c = reactApplicationContext
        c.getSharedPreferences("relax_audio", Context.MODE_PRIVATE).edit()
            .putString("title", title).putFloat("vol", volume.toFloat()).apply()
        c.getSharedPreferences("relax_widget", Context.MODE_PRIVATE).edit()
            .putString("mode", mode).apply()
        val mgr = AppWidgetManager.getInstance(c)
        listOf(RelaxWidgetSmall::class.java, RelaxWidgetMedium::class.java)
            .forEach { clz ->
                val ids = mgr.getAppWidgetIds(ComponentName(c, clz))
                val sz = when (clz.simpleName) { "RelaxWidgetSmall" -> "small"; else -> "medium" }
                ids.forEach { id -> RelaxWidgetBase.updateWidget(c, mgr, id, sz) }
            }
        promise.resolve(true)
    }

    /**
     * Persist the user's image library so the Small/Medium/Large widgets can
     * shuffle wallpaper offline (native code only, no JS round-trip).
     */
    @ReactMethod
    fun setMediaLibrary(items: ReadableArray, promise: Promise) {
        try {
            val arr = org.json.JSONArray()
            for (i in 0 until items.size()) {
                val m = items.getMap(i) ?: continue
                val type = m.getString("type") ?: "image"
                arr.put(org.json.JSONObject().apply {
                    put("uri", m.getString("uri") ?: "")
                    put("type", type)
                })
            }
            reactApplicationContext.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
                .edit().putString("wallpaper_library_json", arr.toString()).apply()
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("MEDIA_LIB_FAIL", t) }
    }

    /**
     * Persist auto-change settings into the shared "relax_widget" prefs so the
     * native LiveWallpaperService engine can perform the periodic swap itself
     * (works even when the JS bundle is not running — e.g. phone rebooted and
     * user never opened the app again).
     */
    @ReactMethod
    fun setAutoChange(enabled: Boolean, seconds: Int, promise: Promise) {
        try {
            reactApplicationContext.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("autochange_enabled", enabled)
                .putInt("autochange_sec", seconds.coerceAtLeast(10))
                .apply()
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("AUTOCHANGE_FAIL", t) }
    }

    /**
     * Persist the user's accent colour and widget/floating opacity so the
     * widget RemoteViews and the floating bubble can repaint with the same
     * theme on the next refresh tick (req #9).
     */
    @ReactMethod
    fun setTheme(accentHex: String, widgetOpacity: Double, floatingOpacity: Double, promise: Promise) {
        try {
            val c = reactApplicationContext
            c.getSharedPreferences("relax_theme", Context.MODE_PRIVATE).edit()
                .putString("accent_color", accentHex)
                .putFloat("widget_opacity", widgetOpacity.toFloat().coerceIn(0.2f, 1f))
                .putFloat("floating_opacity", floatingOpacity.toFloat().coerceIn(0.2f, 1f))
                .apply()
            // Trigger a refresh of all home widgets so the new colour is
            // applied immediately rather than at the next 60s system tick.
            val mgr = AppWidgetManager.getInstance(c)
            listOf(RelaxWidgetSmall::class.java, RelaxWidgetMedium::class.java)
                .forEach { clz ->
                    val ids = mgr.getAppWidgetIds(ComponentName(c, clz))
                    val sz = when (clz.simpleName) { "RelaxWidgetSmall" -> "small"; else -> "medium" }
                    ids.forEach { id -> RelaxWidgetBase.updateWidget(c, mgr, id, sz) }
                }
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("THEME_FAIL", t) }
    }

    @ReactMethod fun addListener(n: String) {}
    @ReactMethod fun removeListeners(n: Int) {}
}
`;

const widgetLayout = (variant) => {
  const showPrevNext = variant !== "small";
  const showMode = variant === "medium";
  // Polished layout: title centered, controls in a single row, no volume
  // slider (per req #8). The frosty dark-green background mirrors the
  // mockups in design-screenshots.zip.
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:padding="12dp" android:orientation="vertical"
    android:background="@drawable/widget_background">
    <TextView android:id="@+id/title"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Relax Sound"
        android:textColor="#E8FFEF" android:textSize="14sp" android:textStyle="bold"
        android:singleLine="true" android:ellipsize="end" android:gravity="center_horizontal"/>
    ${showMode ? `<TextView android:id="@+id/mode_label"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="VIDEO" android:textColor="#22c55e" android:textSize="10sp"
        android:gravity="center_horizontal" android:layout_marginTop="2dp"/>` : ""}
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content"
        android:orientation="horizontal" android:layout_marginTop="8dp"
        android:gravity="center" android:weightSum="${showPrevNext ? 5 : 3}">
        ${showPrevNext ? `<ImageButton android:id="@+id/btn_prev"
            android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_previous" android:tint="#E8FFEF"
            android:scaleType="fitCenter" android:padding="6dp"/>` : ""}
        <ImageButton android:id="@+id/btn_toggle"
            android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_play" android:tint="#22c55e"
            android:scaleType="fitCenter" android:padding="4dp"/>
        ${showPrevNext ? `<ImageButton android:id="@+id/btn_next"
            android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_next" android:tint="#E8FFEF"
            android:scaleType="fitCenter" android:padding="6dp"/>` : ""}
        <ImageButton android:id="@+id/btn_mode"
            android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_menu_rotate" android:tint="#9EE2B8"
            android:scaleType="fitCenter" android:padding="6dp"/>
        <ImageButton android:id="@+id/btn_change_wp"
            android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_menu_gallery" android:tint="#9EE2B8"
            android:scaleType="fitCenter" android:padding="6dp"/>
    </LinearLayout>
</LinearLayout>
`;
};

const widgetInfo = (variant) => {
  const [minW, minH, cellW, cellH] = variant === "small"
    ? [110, 40, 2, 1]
    : [180, 110, 3, 2];
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="${minW}dp"
    android:minHeight="${minH}dp"
    android:targetCellWidth="${cellW}"
    android:targetCellHeight="${cellH}"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/relax_widget_${variant}"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen|keyguard"
    android:description="@string/app_name"/>
`;
};

// Translucent glassmorphic background — matches the in-app GlassCard look
// (req #2: widgets must visually align with the app theme, more
// transparent). The layer-list creates a soft outer glow around a
// semi-transparent forest body so the user's home wallpaper bleeds through.
const WIDGET_BG = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <shape android:shape="rectangle">
      <solid android:color="#3322c55e"/>
      <corners android:radius="26dp"/>
    </shape>
  </item>
  <item android:left="2dp" android:top="2dp" android:right="2dp" android:bottom="2dp">
    <shape android:shape="rectangle">
      <gradient
        android:startColor="#990b1f14"
        android:endColor="#660b1f14"
        android:angle="270"/>
      <corners android:radius="24dp"/>
      <stroke android:width="1dp" android:color="#5522c55e"/>
    </shape>
  </item>
</layer-list>
`;

const withAppWidgetManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["receiver"] = app["receiver"] || [];
    [["small", "RelaxWidgetSmall"], ["medium", "RelaxWidgetMedium"]].forEach(
      ([size, cls]) => {
        if (!app["receiver"].some((r) => r.$["android:name"] === `.widget.${cls}`)) {
          app["receiver"].push({
            $: { "android:name": `.widget.${cls}`, "android:exported": "true" },
            "intent-filter": [
              { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.TOGGLE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.NEXT" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.PREV" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.CYCLE_MODE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.CHANGE_WP" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.VOL_UP" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.VOL_DOWN" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.audio.STATE" } }] }
            ],
            "meta-data": [
              {
                $: {
                  "android:name": "android.appwidget.provider",
                  "android:resource": `@xml/relax_widget_${size}_info`
                }
              }
            ]
          });
        }
      }
    );
    return config;
  });

const withAppWidgetFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "widget/RelaxWidget.kt", PROVIDER_KT);
      writeNativeSource(root, "native/RelaxWidgetModule.kt", MODULE_KT);
      ["small", "medium"].forEach((v) => {
        writeResource(root, `layout/relax_widget_${v}.xml`, widgetLayout(v));
        writeResource(root, `xml/relax_widget_${v}_info.xml`, widgetInfo(v));
      });
      writeResource(root, "drawable/widget_background.xml", WIDGET_BG);
      return config;
    }
  ]);

module.exports = (config) => withAppWidgetFiles(withAppWidgetManifest(config));
